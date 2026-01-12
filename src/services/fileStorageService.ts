/**
 * File Storage Service - Manages local and cloud PDF storage
 *
 * Local folder structure:
 * - Documents/Marginalia/
 *   - {StudyGroupName}/file.pdf
 *   - Ungrouped/file.pdf
 *
 * Dropbox folder structure (mirrors local):
 * - /Marginalia/
 *   - {StudyGroupName}/file.pdf
 *   - Ungrouped/file.pdf
 */

import { documentDir, join } from "@tauri-apps/api/path";
import { mkdir, copyFile, exists, readFile, writeFile } from "@tauri-apps/plugin-fs";
import { dropboxService } from "./dropboxService";

const APP_FOLDER_NAME = "Marginalia";
const UNGROUPED_FOLDER = "Ungrouped";

// Get the local Marginalia folder path
export async function getAppFolderPath(): Promise<string> {
  const docDir = await documentDir();
  return await join(docDir, APP_FOLDER_NAME);
}

// Ensure the app folder and subfolders exist
export async function ensureAppFolder(): Promise<string> {
  const appFolder = await getAppFolderPath();

  try {
    const folderExists = await exists(appFolder);
    if (!folderExists) {
      await mkdir(appFolder, { recursive: true });
    }

    // Create Ungrouped folder
    const ungroupedPath = await join(appFolder, UNGROUPED_FOLDER);
    const ungroupedExists = await exists(ungroupedPath);
    if (!ungroupedExists) {
      await mkdir(ungroupedPath, { recursive: true });
    }
  } catch (err) {
    console.error("Failed to create app folder:", err);
  }

  return appFolder;
}

// Get or create a study group folder
export async function getStudyGroupFolder(studyGroupName: string | null): Promise<string> {
  const appFolder = await ensureAppFolder();
  const folderName = studyGroupName
    ? sanitizeFolderName(studyGroupName)
    : UNGROUPED_FOLDER;

  const folderPath = await join(appFolder, folderName);

  try {
    const folderExists = await exists(folderPath);
    if (!folderExists) {
      await mkdir(folderPath, { recursive: true });
    }
  } catch (err) {
    console.error("Failed to create study group folder:", err);
  }

  return folderPath;
}

// Sanitize folder name for file system
function sanitizeFolderName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim() || "Unnamed";
}

// Get filename from path
function getFileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath;
}

// Copy a PDF to the app folder (returns new path)
export async function copyPdfToAppFolder(
  sourcePath: string,
  studyGroupName: string | null
): Promise<string> {
  const targetFolder = await getStudyGroupFolder(studyGroupName);
  const fileName = getFileName(sourcePath);
  const targetPath = await join(targetFolder, fileName);

  try {
    // Check if source exists
    const sourceExists = await exists(sourcePath);
    if (!sourceExists) {
      throw new Error(`Source file not found: ${sourcePath}`);
    }

    // Check if already in app folder
    const appFolder = await getAppFolderPath();
    if (sourcePath.includes(appFolder)) {
      console.log("[FileStorage] File already in app folder:", sourcePath);
      return sourcePath;
    }

    // Check if target exists
    const targetExists = await exists(targetPath);
    if (targetExists) {
      console.log("[FileStorage] File already exists in target:", targetPath);
      return targetPath;
    }

    // Copy file
    await copyFile(sourcePath, targetPath);
    console.log("[FileStorage] Copied PDF to app folder:", targetPath);

    return targetPath;
  } catch (err) {
    console.error("[FileStorage] Failed to copy PDF:", err);
    throw err;
  }
}

// Move a PDF between study group folders
export async function movePdfToStudyGroup(
  currentPath: string,
  newStudyGroupName: string | null
): Promise<string> {
  const targetFolder = await getStudyGroupFolder(newStudyGroupName);
  const fileName = getFileName(currentPath);
  const targetPath = await join(targetFolder, fileName);

  if (currentPath === targetPath) {
    return currentPath;
  }

  try {
    // Read source file
    const data = await readFile(currentPath);

    // Write to new location
    await writeFile(targetPath, data);

    // Delete is not critical, skip for now (Tauri doesn't have remove in plugin-fs)
    console.log("[FileStorage] Moved PDF to:", targetPath);

    return targetPath;
  } catch (err) {
    console.error("[FileStorage] Failed to move PDF:", err);
    return currentPath; // Keep original path on failure
  }
}

// Upload a PDF to Dropbox
export async function uploadPdfToDropbox(
  localPath: string,
  studyGroupName: string | null
): Promise<string | null> {
  try {
    if (!dropboxService.isConnected()) {
      console.log("[FileStorage] Dropbox not connected, skipping upload");
      return null;
    }

    const fileName = getFileName(localPath);
    const folderName = studyGroupName
      ? sanitizeFolderName(studyGroupName)
      : UNGROUPED_FOLDER;

    // Read file data
    const fileData = await readFile(localPath);

    // Create Dropbox path
    const dropboxPath = `/${APP_FOLDER_NAME}/${folderName}/${fileName}`;

    // Ensure folders exist
    await dropboxService.createFolder(`/${APP_FOLDER_NAME}`);
    await dropboxService.createFolder(`/${APP_FOLDER_NAME}/${folderName}`);

    // Upload
    await dropboxService.uploadFile(dropboxPath, fileData.buffer);
    console.log("[FileStorage] Uploaded to Dropbox:", dropboxPath);

    return dropboxPath;
  } catch (err) {
    console.error("[FileStorage] Failed to upload to Dropbox:", err);
    return null;
  }
}

// Download a PDF from Dropbox
export async function downloadPdfFromDropbox(
  dropboxPath: string,
  studyGroupName: string | null
): Promise<string | null> {
  try {
    if (!dropboxService.isConnected()) {
      console.log("[FileStorage] Dropbox not connected, skipping download");
      return null;
    }

    const fileName = getFileName(dropboxPath);
    const targetFolder = await getStudyGroupFolder(studyGroupName);
    const localPath = await join(targetFolder, fileName);

    // Check if already exists
    const localExists = await exists(localPath);
    if (localExists) {
      console.log("[FileStorage] File already exists locally:", localPath);
      return localPath;
    }

    // Download from Dropbox
    const fileData = await dropboxService.downloadFile(dropboxPath);
    if (!fileData) {
      console.log("[FileStorage] File not found on Dropbox:", dropboxPath);
      return null;
    }

    // Ensure folder exists
    await ensureAppFolder();
    await getStudyGroupFolder(studyGroupName);

    // Write to local
    await writeFile(localPath, new Uint8Array(fileData));
    console.log("[FileStorage] Downloaded from Dropbox:", localPath);

    return localPath;
  } catch (err) {
    console.error("[FileStorage] Failed to download from Dropbox:", err);
    return null;
  }
}

// List all PDFs in Dropbox Marginalia folder
export async function listDropboxPdfs(): Promise<{
  studyGroup: string | null;
  fileName: string;
  dropboxPath: string;
}[]> {
  try {
    if (!dropboxService.isConnected()) {
      return [];
    }

    const results: {
      studyGroup: string | null;
      fileName: string;
      dropboxPath: string;
    }[] = [];

    // List main folder
    const folders = await dropboxService.listFolder(`/${APP_FOLDER_NAME}`);

    for (const folder of folders) {
      if (folder.isFolder) {
        const studyGroup = folder.name === UNGROUPED_FOLDER ? null : folder.name;

        // List PDFs in this folder
        const files = await dropboxService.listFolder(folder.path);
        for (const file of files) {
          if (!file.isFolder && file.name.toLowerCase().endsWith(".pdf")) {
            results.push({
              studyGroup,
              fileName: file.name,
              dropboxPath: file.path,
            });
          }
        }
      }
    }

    return results;
  } catch (err) {
    console.error("[FileStorage] Failed to list Dropbox PDFs:", err);
    return [];
  }
}

// Sync all PDFs (upload local, download remote)
export interface PdfSyncResult {
  uploaded: string[];
  downloaded: string[];
  errors: string[];
}

export async function syncAllPdfs(
  localPdfs: { path: string; studyGroupName: string | null }[],
  onProgress?: (message: string) => void
): Promise<PdfSyncResult> {
  const result: PdfSyncResult = {
    uploaded: [],
    downloaded: [],
    errors: [],
  };

  if (!dropboxService.isConnected()) {
    result.errors.push("Dropbox not connected");
    return result;
  }

  try {
    // 1. Upload local PDFs to Dropbox
    onProgress?.("Uploading local PDFs...");
    for (const pdf of localPdfs) {
      try {
        const dropboxPath = await uploadPdfToDropbox(pdf.path, pdf.studyGroupName);
        if (dropboxPath) {
          result.uploaded.push(getFileName(pdf.path));
        }
      } catch (err) {
        result.errors.push(`Upload failed: ${getFileName(pdf.path)}`);
      }
    }

    // 2. List remote PDFs and download missing ones
    onProgress?.("Checking remote PDFs...");
    const remotePdfs = await listDropboxPdfs();

    // Get list of local file names
    const localFileNames = new Set(localPdfs.map(p => getFileName(p.path).toLowerCase()));

    // Download PDFs that don't exist locally
    for (const remotePdf of remotePdfs) {
      if (!localFileNames.has(remotePdf.fileName.toLowerCase())) {
        try {
          onProgress?.(`Downloading ${remotePdf.fileName}...`);
          const localPath = await downloadPdfFromDropbox(
            remotePdf.dropboxPath,
            remotePdf.studyGroup
          );
          if (localPath) {
            result.downloaded.push(remotePdf.fileName);
          }
        } catch (err) {
          result.errors.push(`Download failed: ${remotePdf.fileName}`);
        }
      }
    }

    return result;
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : "Sync failed");
    return result;
  }
}

// Get local PDF path for a file (checking if it exists in app folder)
export async function getLocalPdfPath(
  fileName: string,
  studyGroupName: string | null
): Promise<string | null> {
  const folder = await getStudyGroupFolder(studyGroupName);
  const localPath = await join(folder, fileName);

  const fileExists = await exists(localPath);
  if (fileExists) {
    return localPath;
  }

  // Also check ungrouped
  const ungroupedFolder = await getStudyGroupFolder(null);
  const ungroupedPath = await join(ungroupedFolder, fileName);
  const ungroupedExists = await exists(ungroupedPath);
  if (ungroupedExists) {
    return ungroupedPath;
  }

  return null;
}
