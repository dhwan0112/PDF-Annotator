use crate::storage::{create_document, create_project, create_tag, Database, Document, Project, Tag};
use chrono::Utc;
use std::sync::Mutex;
use tauri::State;

pub struct DatabaseState(pub Mutex<Option<Database>>);

#[tauri::command]
pub fn init_database(state: State<'_, DatabaseState>, app_data_dir: String) -> Result<(), String> {
    let db = Database::new(app_data_dir.into()).map_err(|e| e.to_string())?;
    *state.0.lock().unwrap() = Some(db);
    Ok(())
}

// Document commands

#[tauri::command]
pub fn add_document_to_library(
    state: State<'_, DatabaseState>,
    file_path: String,
    file_name: String,
    title: Option<String>,
    author: Option<String>,
    page_count: Option<i32>,
) -> Result<Document, String> {
    let guard = state.0.lock().unwrap();
    let db = guard.as_ref().ok_or("Database not initialized")?;

    // Check if document already exists
    if let Ok(Some(existing)) = db.get_document_by_path(&file_path) {
        // Update last opened
        db.update_document_last_opened(&existing.id, existing.last_page)
            .map_err(|e| e.to_string())?;
        return Ok(existing);
    }

    let mut doc = create_document(file_path, file_name);
    doc.title = title;
    doc.author = author;
    doc.page_count = page_count;

    db.add_document(&doc).map_err(|e| e.to_string())?;
    Ok(doc)
}

#[tauri::command]
pub fn get_all_documents(state: State<'_, DatabaseState>) -> Result<Vec<Document>, String> {
    let guard = state.0.lock().unwrap();
    let db = guard.as_ref().ok_or("Database not initialized")?;
    db.get_all_documents().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_documents_by_project(
    state: State<'_, DatabaseState>,
    project_id: Option<String>,
) -> Result<Vec<Document>, String> {
    let guard = state.0.lock().unwrap();
    let db = guard.as_ref().ok_or("Database not initialized")?;
    db.get_documents_by_project(project_id.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_document_progress(
    state: State<'_, DatabaseState>,
    document_id: String,
    page: i32,
) -> Result<(), String> {
    let guard = state.0.lock().unwrap();
    let db = guard.as_ref().ok_or("Database not initialized")?;
    db.update_document_last_opened(&document_id, page)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_document_project(
    state: State<'_, DatabaseState>,
    document_id: String,
    project_id: Option<String>,
) -> Result<(), String> {
    let guard = state.0.lock().unwrap();
    let db = guard.as_ref().ok_or("Database not initialized")?;

    if let Ok(Some(mut doc)) = db.get_document(&document_id) {
        doc.project_id = project_id;
        doc.updated_at = Utc::now();
        db.add_document(&doc).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn delete_document_from_library(
    state: State<'_, DatabaseState>,
    document_id: String,
) -> Result<(), String> {
    let guard = state.0.lock().unwrap();
    let db = guard.as_ref().ok_or("Database not initialized")?;
    db.delete_document(&document_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_documents(
    state: State<'_, DatabaseState>,
    query: String,
) -> Result<Vec<Document>, String> {
    let guard = state.0.lock().unwrap();
    let db = guard.as_ref().ok_or("Database not initialized")?;
    db.search_documents(&query).map_err(|e| e.to_string())
}

// Project commands

#[tauri::command]
pub fn add_project(state: State<'_, DatabaseState>, name: String) -> Result<Project, String> {
    let guard = state.0.lock().unwrap();
    let db = guard.as_ref().ok_or("Database not initialized")?;

    let project = create_project(name);
    db.add_project(&project).map_err(|e| e.to_string())?;
    Ok(project)
}

#[tauri::command]
pub fn get_all_projects(state: State<'_, DatabaseState>) -> Result<Vec<Project>, String> {
    let guard = state.0.lock().unwrap();
    let db = guard.as_ref().ok_or("Database not initialized")?;
    db.get_all_projects().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_project(
    state: State<'_, DatabaseState>,
    id: String,
    name: String,
    description: Option<String>,
    color: Option<String>,
) -> Result<(), String> {
    let guard = state.0.lock().unwrap();
    let db = guard.as_ref().ok_or("Database not initialized")?;

    let project = Project {
        id,
        name,
        description,
        color,
        created_at: Utc::now(), // Will be ignored in update
        updated_at: Utc::now(),
    };
    db.update_project(&project).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_project(state: State<'_, DatabaseState>, project_id: String) -> Result<(), String> {
    let guard = state.0.lock().unwrap();
    let db = guard.as_ref().ok_or("Database not initialized")?;
    db.delete_project(&project_id).map_err(|e| e.to_string())
}

// Tag commands

#[tauri::command]
pub fn add_tag(
    state: State<'_, DatabaseState>,
    name: String,
    color: Option<String>,
) -> Result<Tag, String> {
    let guard = state.0.lock().unwrap();
    let db = guard.as_ref().ok_or("Database not initialized")?;

    let tag = create_tag(name, color);
    db.add_tag(&tag).map_err(|e| e.to_string())?;
    Ok(tag)
}

#[tauri::command]
pub fn get_all_tags(state: State<'_, DatabaseState>) -> Result<Vec<Tag>, String> {
    let guard = state.0.lock().unwrap();
    let db = guard.as_ref().ok_or("Database not initialized")?;
    db.get_all_tags().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_tag(state: State<'_, DatabaseState>, tag_id: String) -> Result<(), String> {
    let guard = state.0.lock().unwrap();
    let db = guard.as_ref().ok_or("Database not initialized")?;
    db.delete_tag(&tag_id).map_err(|e| e.to_string())
}

// Document-Tag commands

#[tauri::command]
pub fn add_document_tag(
    state: State<'_, DatabaseState>,
    document_id: String,
    tag_id: String,
) -> Result<(), String> {
    let guard = state.0.lock().unwrap();
    let db = guard.as_ref().ok_or("Database not initialized")?;
    db.add_document_tag(&document_id, &tag_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_document_tag(
    state: State<'_, DatabaseState>,
    document_id: String,
    tag_id: String,
) -> Result<(), String> {
    let guard = state.0.lock().unwrap();
    let db = guard.as_ref().ok_or("Database not initialized")?;
    db.remove_document_tag(&document_id, &tag_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_document_tags(
    state: State<'_, DatabaseState>,
    document_id: String,
) -> Result<Vec<Tag>, String> {
    let guard = state.0.lock().unwrap();
    let db = guard.as_ref().ok_or("Database not initialized")?;
    db.get_document_tags(&document_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_documents_by_tag(
    state: State<'_, DatabaseState>,
    tag_id: String,
) -> Result<Vec<Document>, String> {
    let guard = state.0.lock().unwrap();
    let db = guard.as_ref().ok_or("Database not initialized")?;
    db.get_documents_by_tag(&tag_id).map_err(|e| e.to_string())
}
