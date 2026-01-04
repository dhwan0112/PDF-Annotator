mod commands;
mod pdf;
mod storage;
mod sync;

use commands::file;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            file::open_file_dialog,
            file::read_pdf_metadata,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
