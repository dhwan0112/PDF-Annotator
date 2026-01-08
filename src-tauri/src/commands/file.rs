use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use tauri_plugin_dialog::DialogExt;
use crate::pdf::{read_pdf_metadata_lopdf, extract_text_from_pdf, ExtendedPdfMetadata};

#[derive(Debug, Serialize, Deserialize)]
pub struct PdfMetadata {
    pub path: String,
    pub file_name: String,
    pub page_count: Option<u32>,
    pub title: Option<String>,
    pub author: Option<String>,
}

/// Get the central data directory for Marginalia
fn get_data_dir() -> Result<std::path::PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let data_dir = home.join(".marginalia").join("data");

    // Create directory if it doesn't exist
    if !data_dir.exists() {
        fs::create_dir_all(&data_dir)
            .map_err(|e| format!("Failed to create data directory: {}", e))?;
    }

    Ok(data_dir)
}

/// Generate a unique filename hash from PDF path
fn hash_path(path: &str) -> String {
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

#[tauri::command]
pub async fn open_file_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("PDF Files", &["pdf"])
        .blocking_pick_file();

    match file_path {
        Some(path) => Ok(Some(path.to_string())),
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn read_pdf_metadata(file_path: String) -> Result<PdfMetadata, String> {
    let path = std::path::Path::new(&file_path);
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Unknown".to_string());

    // Try to read metadata using lopdf
    match read_pdf_metadata_lopdf(&file_path) {
        Ok(extended) => Ok(PdfMetadata {
            path: file_path,
            file_name,
            page_count: Some(extended.page_count),
            title: extended.title,
            author: extended.author,
        }),
        Err(_) => {
            // Fallback to basic metadata
            Ok(PdfMetadata {
                path: file_path,
                file_name,
                page_count: None,
                title: None,
                author: None,
            })
        }
    }
}

/// Get extended PDF metadata including all info fields
#[tauri::command]
pub async fn read_pdf_metadata_extended(file_path: String) -> Result<ExtendedPdfMetadata, String> {
    read_pdf_metadata_lopdf(&file_path)
}

/// Extract text from specified pages of a PDF
#[tauri::command]
pub async fn extract_pdf_text(file_path: String, page_numbers: Vec<u32>) -> Result<String, String> {
    extract_text_from_pdf(&file_path, &page_numbers)
}

/// Get the annotation file path for a PDF (stored in central data directory)
fn get_annotation_path(pdf_path: &str) -> Result<std::path::PathBuf, String> {
    let data_dir = get_data_dir()?;
    let hash = hash_path(pdf_path);
    Ok(data_dir.join(format!("{}.annotations.json", hash)))
}

/// Get the legacy annotation file path (PDF directory)
fn get_legacy_annotation_path(pdf_path: &str) -> String {
    format!("{}.annotations.json", pdf_path)
}

#[tauri::command]
pub async fn save_annotations(pdf_path: String, annotations_json: String) -> Result<(), String> {
    let annotation_path = get_annotation_path(&pdf_path)?;
    fs::write(&annotation_path, &annotations_json)
        .map_err(|e| format!("Failed to save annotations: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn load_annotations(pdf_path: String) -> Result<Option<String>, String> {
    // First try central data directory
    let annotation_path = get_annotation_path(&pdf_path)?;

    if annotation_path.exists() {
        let content = fs::read_to_string(&annotation_path)
            .map_err(|e| format!("Failed to load annotations: {}", e))?;
        return Ok(Some(content));
    }

    // Fallback to legacy path (for migration)
    let legacy_path = get_legacy_annotation_path(&pdf_path);
    let legacy = Path::new(&legacy_path);

    if legacy.exists() {
        let content = fs::read_to_string(&legacy_path)
            .map_err(|e| format!("Failed to load annotations: {}", e))?;

        // Migrate to new location
        fs::write(&annotation_path, &content)
            .map_err(|e| format!("Failed to migrate annotations: {}", e))?;

        // Delete legacy file
        let _ = fs::remove_file(&legacy_path);

        return Ok(Some(content));
    }

    Ok(None)
}

#[tauri::command]
pub async fn delete_annotations(pdf_path: String) -> Result<(), String> {
    let annotation_path = get_annotation_path(&pdf_path)?;

    if annotation_path.exists() {
        fs::remove_file(&annotation_path)
            .map_err(|e| format!("Failed to delete annotations: {}", e))?;
    }

    // Also delete legacy file if exists
    let legacy_path = get_legacy_annotation_path(&pdf_path);
    let legacy = Path::new(&legacy_path);
    if legacy.exists() {
        let _ = fs::remove_file(&legacy_path);
    }

    Ok(())
}

/// Get the bookmark file path for a PDF (stored in central data directory)
fn get_bookmark_path(pdf_path: &str) -> Result<std::path::PathBuf, String> {
    let data_dir = get_data_dir()?;
    let hash = hash_path(pdf_path);
    Ok(data_dir.join(format!("{}.bookmarks.json", hash)))
}

/// Get the legacy bookmark file path (PDF directory)
fn get_legacy_bookmark_path(pdf_path: &str) -> String {
    format!("{}.bookmarks.json", pdf_path)
}

#[tauri::command]
pub async fn save_bookmarks(pdf_path: String, bookmarks_json: String) -> Result<(), String> {
    let bookmark_path = get_bookmark_path(&pdf_path)?;
    fs::write(&bookmark_path, &bookmarks_json)
        .map_err(|e| format!("Failed to save bookmarks: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn load_bookmarks(pdf_path: String) -> Result<Option<String>, String> {
    // First try central data directory
    let bookmark_path = get_bookmark_path(&pdf_path)?;

    if bookmark_path.exists() {
        let content = fs::read_to_string(&bookmark_path)
            .map_err(|e| format!("Failed to load bookmarks: {}", e))?;
        return Ok(Some(content));
    }

    // Fallback to legacy path (for migration)
    let legacy_path = get_legacy_bookmark_path(&pdf_path);
    let legacy = Path::new(&legacy_path);

    if legacy.exists() {
        let content = fs::read_to_string(&legacy_path)
            .map_err(|e| format!("Failed to load bookmarks: {}", e))?;

        // Migrate to new location
        fs::write(&bookmark_path, &content)
            .map_err(|e| format!("Failed to migrate bookmarks: {}", e))?;

        // Delete legacy file
        let _ = fs::remove_file(&legacy_path);

        return Ok(Some(content));
    }

    Ok(None)
}

#[tauri::command]
pub async fn delete_bookmarks(pdf_path: String) -> Result<(), String> {
    let bookmark_path = get_bookmark_path(&pdf_path)?;

    if bookmark_path.exists() {
        fs::remove_file(&bookmark_path)
            .map_err(|e| format!("Failed to delete bookmarks: {}", e))?;
    }

    // Also delete legacy file if exists
    let legacy_path = get_legacy_bookmark_path(&pdf_path);
    let legacy = Path::new(&legacy_path);
    if legacy.exists() {
        let _ = fs::remove_file(&legacy_path);
    }

    Ok(())
}
