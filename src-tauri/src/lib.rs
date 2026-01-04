mod commands;
mod pdf;
mod storage;
mod sync;

use commands::{file, library};
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
