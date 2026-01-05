// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Set up panic hook to log errors to a file on Windows
    #[cfg(target_os = "windows")]
    {
        std::panic::set_hook(Box::new(|panic_info| {
            if let Some(home) = std::env::var_os("USERPROFILE") {
                let log_path = std::path::PathBuf::from(home).join("pdf-annotator-crash.log");
                if let Ok(mut file) = std::fs::OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(&log_path)
                {
                    use std::io::Write;
                    let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
                    let _ = writeln!(file, "[{}] Panic: {}", timestamp, panic_info);
                }
            }
        }));
    }

    pdf_annotator_lib::run()
}
