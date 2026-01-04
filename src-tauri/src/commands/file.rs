use serde::{Deserialize, Serialize};
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
