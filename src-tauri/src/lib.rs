mod commands;
mod pdf;
mod storage;
mod sync;

use commands::{file, library};
use std::sync::Mutex;

fn log_error_to_file(message: &str) {
    #[cfg(target_os = "windows")]
    {
        if let Some(home) = std::env::var_os("USERPROFILE") {
            let log_path = std::path::PathBuf::from(home).join("pdf-annotator-crash.log");
            if let Ok(mut file) = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_path)
            {
                use std::io::Write;
                let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
                let _ = writeln!(file, "[{}] {}", timestamp, message);
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        eprintln!("{}", message);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    log_error_to_file("Application starting...");

    let result = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(library::DatabaseState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            // File commands
            file::open_file_dialog,
            file::read_pdf_metadata,
            file::save_annotations,
            file::load_annotations,
            file::delete_annotations,
            file::save_bookmarks,
            file::load_bookmarks,
            file::delete_bookmarks,
            // Library commands
            library::init_database,
            library::add_document_to_library,
            library::get_all_documents,
            library::get_documents_by_project,
            library::update_document_progress,
            library::set_document_project,
            library::delete_document_from_library,
            library::search_documents,
            library::add_project,
            library::get_all_projects,
            library::update_project,
            library::delete_project,
            library::add_tag,
            library::get_all_tags,
            library::delete_tag,
            library::add_document_tag,
            library::remove_document_tag,
            library::get_document_tags,
            library::get_documents_by_tag,
        ])
        .run(tauri::generate_context!());

    if let Err(e) = result {
        log_error_to_file(&format!("Tauri error: {}", e));
        panic!("error while running tauri application: {}", e);
    }
}
