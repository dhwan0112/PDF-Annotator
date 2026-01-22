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

import {
  collectSyncData,
  applySyncData,
  mergeSyncData,
  applyConflictResolutions,
  type SyncData,
  type MergeResult,
} from "./syncService";
import type { ConflictItem } from "../types/sync";

// Dropbox OAuth configuration
const DROPBOX_AUTH_URL = "https://www.dropbox.com/oauth2/authorize";
const DROPBOX_TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
const DROPBOX_CONTENT_URL = "https://content.dropboxapi.com/2";
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
  conflicts?: ConflictItem[];
  changes?: {
    uploaded: number;
    downloaded: number;
    merged: number;
  };
}

class DropboxService {
  private config: DropboxConfig | null = null;
  private codeVerifier: string | null = null;
  private pendingMergeResult: MergeResult | null = null;

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

    // For desktop apps, don't use redirect_uri - user will copy the code manually
    const params = new URLSearchParams({
      client_id: this.config.appKey,
      response_type: "code",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
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

    // For desktop apps without redirect_uri, don't include it in token exchange
    const response = await fetch(DROPBOX_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: this.config.appKey,
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

  // Perform full sync with conflict detection
  async sync(): Promise<DropboxSyncResult> {
    try {
      // Collect local data
      const localData = collectSyncData();

      // Download remote data
      const remoteData = await this.download();

      if (remoteData) {
        // Merge data with conflict detection
        const mergeResult = mergeSyncData(localData, remoteData);

        // Check for conflicts
        if (mergeResult.hasConflicts) {
          // Store pending merge for resolution
          this.pendingMergeResult = mergeResult;

          return {
            success: false,
            error: `${mergeResult.conflicts.length} conflict(s) detected`,
            conflicts: mergeResult.conflicts,
          };
        }

        // No conflicts - apply and upload
        applySyncData(mergeResult.data);
        await this.upload(mergeResult.data);

        return {
          success: true,
          lastSync: new Date().toISOString(),
          changes: {
            uploaded: 1,
            downloaded: 1,
            merged: 1,
          },
        };
      } else {
        // First sync - just upload local data
        await this.upload(localData);

        return {
          success: true,
          lastSync: new Date().toISOString(),
          changes: {
            uploaded: 1,
            downloaded: 0,
            merged: 0,
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Sync failed",
      };
    }
  }

  // Apply conflict resolutions and complete sync
  async applyConflictResolutions(resolvedConflicts: ConflictItem[]): Promise<void> {
    if (!this.pendingMergeResult) {
      throw new Error("No pending merge to resolve");
    }

    // Apply resolutions to merged data
    const resolvedData = applyConflictResolutions(
      this.pendingMergeResult.data,
      resolvedConflicts
    );

    // Apply locally
    applySyncData(resolvedData);

    // Upload resolved data
    await this.upload(resolvedData);

    // Clear pending merge
    this.pendingMergeResult = null;
  }

  // Create a folder in Dropbox
  async createFolder(path: string): Promise<void> {
    await this.refreshTokenIfNeeded();

    if (!this.config?.accessToken) {
      throw new Error("Not authenticated");
    }

    const response = await fetch("https://api.dropboxapi.com/2/files/create_folder_v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path,
        autorename: false,
      }),
    });

    // Ignore error if folder already exists
    if (!response.ok && response.status !== 409) {
      const error = await response.text();
      throw new Error(`Create folder failed: ${error}`);
    }
  }

  // Upload a PDF file to Dropbox
  async uploadFile(dropboxPath: string, fileData: ArrayBuffer): Promise<void> {
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
          path: dropboxPath,
          mode: "overwrite",
          autorename: false,
          mute: true,
        }),
      },
      body: fileData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Upload file failed: ${error}`);
    }
  }

  // Download a file from Dropbox
  async downloadFile(dropboxPath: string): Promise<ArrayBuffer | null> {
    await this.refreshTokenIfNeeded();

    if (!this.config?.accessToken) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(`${DROPBOX_CONTENT_URL}/files/download`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Dropbox-API-Arg": JSON.stringify({
          path: dropboxPath,
        }),
      },
    });

    if (response.status === 409) {
      // File not found
      return null;
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Download file failed: ${error}`);
    }

    return await response.arrayBuffer();
  }

  // List files in a folder
  async listFolder(path: string): Promise<DropboxFileEntry[]> {
    await this.refreshTokenIfNeeded();

    if (!this.config?.accessToken) {
      throw new Error("Not authenticated");
    }

    const response = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: path || "",
        recursive: false,
        include_deleted: false,
      }),
    });

    if (response.status === 409) {
      // Folder not found
      return [];
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`List folder failed: ${error}`);
    }

    const data = await response.json();
    return data.entries.map((entry: { name: string; path_lower: string; ".tag": string }) => ({
      name: entry.name,
      path: entry.path_lower,
      isFolder: entry[".tag"] === "folder",
    }));
  }

  // Upload PDF for a study group
  async uploadStudyGroupPdf(studyGroupName: string, fileName: string, fileData: ArrayBuffer): Promise<string> {
    // Sanitize folder name
    const safeName = studyGroupName.replace(/[<>:"/\\|?*]/g, "_");
    const folderPath = `/Marginalia/${safeName}`;
    const filePath = `${folderPath}/${fileName}`;

    // Create folder if needed
    await this.createFolder("/Marginalia");
    await this.createFolder(folderPath);

    // Upload file
    await this.uploadFile(filePath, fileData);

    return filePath;
  }

  // Get all PDFs for a study group
  async getStudyGroupPdfs(studyGroupName: string): Promise<DropboxFileEntry[]> {
    const safeName = studyGroupName.replace(/[<>:"/\\|?*]/g, "_");
    const folderPath = `/Marginalia/${safeName}`;

    const files = await this.listFolder(folderPath);
    return files.filter((f) => !f.isFolder && f.name.toLowerCase().endsWith(".pdf"));
  }

  // Disconnect from Dropbox
  disconnect(): void {
    this.config = null;
    this.pendingMergeResult = null;
    this.saveConfig();
  }
}

// File entry type
export interface DropboxFileEntry {
  name: string;
  path: string;
  isFolder: boolean;
}

// Singleton instance
export const dropboxService = new DropboxService();
