/**
 * Dropbox Sync Service for Marginalia
 *
 * Setup Instructions:
 * 1. Go to https://www.dropbox.com/developers/apps
 * 2. Create a new app with "Scoped access" and "App folder"
 * 3. Enable permissions: files.metadata.read, files.content.read, files.content.write
 * 4. Copy your App Key and set it in settings
 * 5. Add redirect URI: http://localhost:8374/callback
 */

import { collectSyncData, applySyncData, mergeSyncData, type SyncData } from "./syncService";

// Dropbox OAuth configuration
const DROPBOX_AUTH_URL = "https://www.dropbox.com/oauth2/authorize";
const DROPBOX_TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
const DROPBOX_CONTENT_URL = "https://content.dropboxapi.com/2";
const REDIRECT_URI = "http://localhost:8374/callback";
const SYNC_FILE_PATH = "/marginalia-sync.json";

// PKCE helpers
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export interface DropboxConfig {
  appKey: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: number;
}

export interface DropboxSyncResult {
  success: boolean;
  error?: string;
  lastSync?: string;
  conflicts?: Array<{ field: string; resolution: string }>;
}

class DropboxService {
  private config: DropboxConfig | null = null;
  private codeVerifier: string | null = null;

  constructor() {
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      const stored = localStorage.getItem("marginalia-dropbox-config");
      if (stored) {
        this.config = JSON.parse(stored);
      }
    } catch {
      this.config = null;
    }
  }

  private saveConfig(): void {
    if (this.config) {
      localStorage.setItem("marginalia-dropbox-config", JSON.stringify(this.config));
    } else {
      localStorage.removeItem("marginalia-dropbox-config");
    }
  }

  // Check if connected to Dropbox
  isConnected(): boolean {
    return !!(this.config?.accessToken && this.config?.appKey);
  }

  // Get current config (without sensitive data)
  getStatus(): { connected: boolean; appKey?: string } {
    return {
      connected: this.isConnected(),
      appKey: this.config?.appKey ? `${this.config.appKey.slice(0, 4)}...` : undefined,
    };
  }

  // Set App Key
  setAppKey(appKey: string): void {
    this.config = {
      ...this.config,
      appKey,
    };
    this.saveConfig();
  }

  // Generate OAuth URL for authorization
  async getAuthUrl(): Promise<string> {
    if (!this.config?.appKey) {
      throw new Error("App Key not configured");
    }

    this.codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(this.codeVerifier);

    // Store verifier for later use
    sessionStorage.setItem("dropbox-code-verifier", this.codeVerifier);

    const params = new URLSearchParams({
      client_id: this.config.appKey,
      response_type: "code",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      redirect_uri: REDIRECT_URI,
      token_access_type: "offline",
    });

    return `${DROPBOX_AUTH_URL}?${params.toString()}`;
  }

  // Handle OAuth callback and exchange code for token
  async handleCallback(code: string): Promise<void> {
    if (!this.config?.appKey) {
      throw new Error("App Key not configured");
    }

    const codeVerifier = sessionStorage.getItem("dropbox-code-verifier");
    if (!codeVerifier) {
      throw new Error("Code verifier not found. Please restart authorization.");
    }

    const response = await fetch(DROPBOX_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: this.config.appKey,
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();
    this.config = {
      ...this.config,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenExpiry: Date.now() + data.expires_in * 1000,
    };

    this.saveConfig();
    sessionStorage.removeItem("dropbox-code-verifier");
  }

  // Refresh access token if expired
  private async refreshTokenIfNeeded(): Promise<void> {
    if (!this.config?.refreshToken || !this.config?.appKey) {
      throw new Error("Not authenticated");
    }

    // Check if token is expired (with 5 min buffer)
    if (this.config.tokenExpiry && Date.now() < this.config.tokenExpiry - 300000) {
      return; // Token still valid
    }

    const response = await fetch(DROPBOX_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.config.refreshToken,
        client_id: this.config.appKey,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to refresh token");
    }

    const data = await response.json();
    this.config = {
      ...this.config,
      accessToken: data.access_token,
      tokenExpiry: Date.now() + data.expires_in * 1000,
    };

    this.saveConfig();
  }

  // Upload sync data to Dropbox
  async upload(data: SyncData): Promise<void> {
    await this.refreshTokenIfNeeded();

    if (!this.config?.accessToken) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(`${DROPBOX_CONTENT_URL}/files/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path: SYNC_FILE_PATH,
          mode: "overwrite",
          autorename: false,
          mute: true,
        }),
      },
      body: JSON.stringify(data, null, 2),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Upload failed: ${error}`);
    }
  }

  // Download sync data from Dropbox
  async download(): Promise<SyncData | null> {
    await this.refreshTokenIfNeeded();

    if (!this.config?.accessToken) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(`${DROPBOX_CONTENT_URL}/files/download`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Dropbox-API-Arg": JSON.stringify({
          path: SYNC_FILE_PATH,
        }),
      },
    });

    if (response.status === 409) {
      // File not found - first sync
      return null;
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Download failed: ${error}`);
    }

    const text = await response.text();
    return JSON.parse(text) as SyncData;
  }

  // Perform full sync
  async sync(): Promise<DropboxSyncResult> {
    try {
      // Collect local data
      const localData = collectSyncData();

      // Download remote data
      const remoteData = await this.download();

      if (remoteData) {
        // Merge data
        const mergedData = mergeSyncData(localData, remoteData);

        // Apply merged data locally
        applySyncData(mergedData);

        // Upload merged data
        await this.upload(mergedData);

        return {
          success: true,
          lastSync: new Date().toISOString(),
        };
      } else {
        // First sync - just upload local data
        await this.upload(localData);

        return {
          success: true,
          lastSync: new Date().toISOString(),
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Sync failed",
      };
    }
  }

  // Disconnect from Dropbox
  disconnect(): void {
    this.config = null;
    this.saveConfig();
  }
}

// Singleton instance
export const dropboxService = new DropboxService();
