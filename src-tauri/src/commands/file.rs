use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri_plugin_dialog::DialogExt;

#[derive(Debug, Serialize, Deserialize)]
pub struct PdfMetadata {
    pub path: String,
    pub file_name: String,
    pub page_count: Option<u32>,
    pub title: Option<String>,
    pub author: Option<String>,
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

    // TODO: Implement actual PDF metadata reading with a PDF library
    Ok(PdfMetadata {
        path: file_path,
        file_name,
        page_count: None,
        title: None,
        author: None,
    })
}

/// Get the annotation file path for a PDF
fn get_annotation_path(pdf_path: &str) -> String {
    format!("{}.annotations.json", pdf_path)
}

#[tauri::command]
pub async fn save_annotations(pdf_path: String, annotations_json: String) -> Result<(), String> {
    let annotation_path = get_annotation_path(&pdf_path);
    fs::write(&annotation_path, &annotations_json)
        .map_err(|e| format!("Failed to save annotations: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn load_annotations(pdf_path: String) -> Result<Option<String>, String> {
    let annotation_path = get_annotation_path(&pdf_path);
    let path = Path::new(&annotation_path);

    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&annotation_path)
        .map_err(|e| format!("Failed to load annotations: {}", e))?;

    Ok(Some(content))
}

#[tauri::command]
pub async fn delete_annotations(pdf_path: String) -> Result<(), String> {
    let annotation_path = get_annotation_path(&pdf_path);
    let path = Path::new(&annotation_path);

    if path.exists() {
        fs::remove_file(&annotation_path)
            .map_err(|e| format!("Failed to delete annotations: {}", e))?;
    }

    Ok(())
}

/// Get the bookmark file path for a PDF
fn get_bookmark_path(pdf_path: &str) -> String {
    format!("{}.bookmarks.json", pdf_path)
}

#[tauri::command]
pub async fn save_bookmarks(pdf_path: String, bookmarks_json: String) -> Result<(), String> {
    let bookmark_path = get_bookmark_path(&pdf_path);
    fs::write(&bookmark_path, &bookmarks_json)
        .map_err(|e| format!("Failed to save bookmarks: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn load_bookmarks(pdf_path: String) -> Result<Option<String>, String> {
    let bookmark_path = get_bookmark_path(&pdf_path);
    let path = Path::new(&bookmark_path);

    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&bookmark_path)
        .map_err(|e| format!("Failed to load bookmarks: {}", e))?;

    Ok(Some(content))
}

#[tauri::command]
pub async fn delete_bookmarks(pdf_path: String) -> Result<(), String> {
    let bookmark_path = get_bookmark_path(&pdf_path);
    let path = Path::new(&bookmark_path);

    if path.exists() {
        fs::remove_file(&bookmark_path)
            .map_err(|e| format!("Failed to delete bookmarks: {}", e))?;
    }

    Ok(())
}
