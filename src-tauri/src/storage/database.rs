use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use uuid::Uuid;

/// Database manager for the PDF library
pub struct Database {
    conn: Mutex<Connection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: String,
    pub file_path: String,
    pub file_name: String,
    pub title: Option<String>,
    pub author: Option<String>,
    pub page_count: Option<i32>,
    pub project_id: Option<String>,
    pub last_opened_at: Option<DateTime<Utc>>,
    pub last_page: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentTag {
    pub document_id: String,
    pub tag_id: String,
}

impl Database {
    pub fn new(app_data_dir: PathBuf) -> SqlResult<Self> {
        std::fs::create_dir_all(&app_data_dir).ok();
        let db_path = app_data_dir.join("library.db");
        let conn = Connection::open(db_path)?;

        let db = Self {
            conn: Mutex::new(conn),
        };

        db.init_tables()?;
        Ok(db)
    }

    fn init_tables(&self) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();

        // Create documents table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                file_path TEXT NOT NULL UNIQUE,
                file_name TEXT NOT NULL,
                title TEXT,
                author TEXT,
                page_count INTEGER,
                project_id TEXT,
                last_opened_at TEXT,
                last_page INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
            )",
            [],
        )?;

        // Create projects table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                color TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )?;

        // Create tags table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS tags (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                color TEXT
            )",
            [],
        )?;

        // Create document_tags junction table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS document_tags (
                document_id TEXT NOT NULL,
                tag_id TEXT NOT NULL,
                PRIMARY KEY (document_id, tag_id),
                FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // Create indexes
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_documents_last_opened ON documents(last_opened_at DESC)",
            [],
        )?;

        Ok(())
    }

    // Document CRUD operations

    pub fn add_document(&self, doc: &Document) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO documents
             (id, file_path, file_name, title, author, page_count, project_id, last_opened_at, last_page, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                doc.id,
                doc.file_path,
                doc.file_name,
                doc.title,
                doc.author,
                doc.page_count,
                doc.project_id,
                doc.last_opened_at.map(|dt| dt.to_rfc3339()),
                doc.last_page,
                doc.created_at.to_rfc3339(),
                doc.updated_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    pub fn get_document(&self, id: &str) -> SqlResult<Option<Document>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, file_path, file_name, title, author, page_count, project_id,
             last_opened_at, last_page, created_at, updated_at FROM documents WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(self.row_to_document(row)?))
        } else {
            Ok(None)
        }
    }

    pub fn get_document_by_path(&self, file_path: &str) -> SqlResult<Option<Document>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, file_path, file_name, title, author, page_count, project_id,
             last_opened_at, last_page, created_at, updated_at FROM documents WHERE file_path = ?1",
        )?;

        let mut rows = stmt.query(params![file_path])?;
        if let Some(row) = rows.next()? {
            Ok(Some(self.row_to_document(row)?))
        } else {
            Ok(None)
        }
    }

    pub fn get_all_documents(&self) -> SqlResult<Vec<Document>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, file_path, file_name, title, author, page_count, project_id,
             last_opened_at, last_page, created_at, updated_at FROM documents
             ORDER BY last_opened_at DESC NULLS LAST, updated_at DESC",
        )?;

        let rows = stmt.query_map([], |row| self.row_to_document(row))?;

        let mut documents = Vec::new();
        for doc in rows {
            documents.push(doc?);
        }
        Ok(documents)
    }

    pub fn get_documents_by_project(&self, project_id: Option<&str>) -> SqlResult<Vec<Document>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = if project_id.is_some() {
            conn.prepare(
                "SELECT id, file_path, file_name, title, author, page_count, project_id,
                 last_opened_at, last_page, created_at, updated_at FROM documents
                 WHERE project_id = ?1 ORDER BY last_opened_at DESC NULLS LAST",
            )?
        } else {
            conn.prepare(
                "SELECT id, file_path, file_name, title, author, page_count, project_id,
                 last_opened_at, last_page, created_at, updated_at FROM documents
                 WHERE project_id IS NULL ORDER BY last_opened_at DESC NULLS LAST",
            )?
        };

        let rows = if let Some(pid) = project_id {
            stmt.query_map(params![pid], |row| self.row_to_document(row))?
        } else {
            stmt.query_map([], |row| self.row_to_document(row))?
        };

        let mut documents = Vec::new();
        for doc in rows {
            documents.push(doc?);
        }
        Ok(documents)
    }

    pub fn update_document_last_opened(&self, id: &str, page: i32) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE documents SET last_opened_at = ?1, last_page = ?2, updated_at = ?1 WHERE id = ?3",
            params![now, page, id],
        )?;
        Ok(())
    }

    pub fn delete_document(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM documents WHERE id = ?1", params![id])?;
        Ok(())
    }

    fn row_to_document(&self, row: &rusqlite::Row) -> SqlResult<Document> {
        let last_opened_str: Option<String> = row.get(7)?;
        let created_str: String = row.get(9)?;
        let updated_str: String = row.get(10)?;

        Ok(Document {
            id: row.get(0)?,
            file_path: row.get(1)?,
            file_name: row.get(2)?,
            title: row.get(3)?,
            author: row.get(4)?,
            page_count: row.get(5)?,
            project_id: row.get(6)?,
            last_opened_at: last_opened_str
                .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
                .map(|dt| dt.with_timezone(&Utc)),
            last_page: row.get(8)?,
            created_at: DateTime::parse_from_rfc3339(&created_str)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
            updated_at: DateTime::parse_from_rfc3339(&updated_str)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
        })
    }

    // Project CRUD operations

    pub fn add_project(&self, project: &Project) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO projects (id, name, description, color, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                project.id,
                project.name,
                project.description,
                project.color,
                project.created_at.to_rfc3339(),
                project.updated_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    pub fn get_all_projects(&self) -> SqlResult<Vec<Project>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, description, color, created_at, updated_at FROM projects ORDER BY name",
        )?;

        let rows = stmt.query_map([], |row| {
            let created_str: String = row.get(4)?;
            let updated_str: String = row.get(5)?;

            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                color: row.get(3)?,
                created_at: DateTime::parse_from_rfc3339(&created_str)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now()),
                updated_at: DateTime::parse_from_rfc3339(&updated_str)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now()),
            })
        })?;

        let mut projects = Vec::new();
        for project in rows {
            projects.push(project?);
        }
        Ok(projects)
    }

    pub fn update_project(&self, project: &Project) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE projects SET name = ?1, description = ?2, color = ?3, updated_at = ?4 WHERE id = ?5",
            params![
                project.name,
                project.description,
                project.color,
                project.updated_at.to_rfc3339(),
                project.id,
            ],
        )?;
        Ok(())
    }

    pub fn delete_project(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM projects WHERE id = ?1", params![id])?;
        Ok(())
    }

    // Tag CRUD operations

    pub fn add_tag(&self, tag: &Tag) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO tags (id, name, color) VALUES (?1, ?2, ?3)",
            params![tag.id, tag.name, tag.color],
        )?;
        Ok(())
    }

    pub fn get_all_tags(&self) -> SqlResult<Vec<Tag>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, color FROM tags ORDER BY name")?;

        let rows = stmt.query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
            })
        })?;

        let mut tags = Vec::new();
        for tag in rows {
            tags.push(tag?);
        }
        Ok(tags)
    }

    pub fn delete_tag(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM tags WHERE id = ?1", params![id])?;
        Ok(())
    }

    // Document-Tag operations

    pub fn add_document_tag(&self, document_id: &str, tag_id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO document_tags (document_id, tag_id) VALUES (?1, ?2)",
            params![document_id, tag_id],
        )?;
        Ok(())
    }

    pub fn remove_document_tag(&self, document_id: &str, tag_id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM document_tags WHERE document_id = ?1 AND tag_id = ?2",
            params![document_id, tag_id],
        )?;
        Ok(())
    }

    pub fn get_document_tags(&self, document_id: &str) -> SqlResult<Vec<Tag>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT t.id, t.name, t.color FROM tags t
             INNER JOIN document_tags dt ON t.id = dt.tag_id
             WHERE dt.document_id = ?1 ORDER BY t.name",
        )?;

        let rows = stmt.query_map(params![document_id], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
            })
        })?;

        let mut tags = Vec::new();
        for tag in rows {
            tags.push(tag?);
        }
        Ok(tags)
    }

    pub fn get_documents_by_tag(&self, tag_id: &str) -> SqlResult<Vec<Document>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT d.id, d.file_path, d.file_name, d.title, d.author, d.page_count,
             d.project_id, d.last_opened_at, d.last_page, d.created_at, d.updated_at
             FROM documents d
             INNER JOIN document_tags dt ON d.id = dt.document_id
             WHERE dt.tag_id = ?1 ORDER BY d.last_opened_at DESC NULLS LAST",
        )?;

        let rows = stmt.query_map(params![tag_id], |row| self.row_to_document(row))?;

        let mut documents = Vec::new();
        for doc in rows {
            documents.push(doc?);
        }
        Ok(documents)
    }

    // Search

    pub fn search_documents(&self, query: &str) -> SqlResult<Vec<Document>> {
        let conn = self.conn.lock().unwrap();
        let search_pattern = format!("%{}%", query);

        let mut stmt = conn.prepare(
            "SELECT id, file_path, file_name, title, author, page_count, project_id,
             last_opened_at, last_page, created_at, updated_at FROM documents
             WHERE file_name LIKE ?1 OR title LIKE ?1 OR author LIKE ?1
             ORDER BY last_opened_at DESC NULLS LAST",
        )?;

        let rows = stmt.query_map(params![search_pattern], |row| self.row_to_document(row))?;

        let mut documents = Vec::new();
        for doc in rows {
            documents.push(doc?);
        }
        Ok(documents)
    }
}

// Helper function to create a new document
pub fn create_document(file_path: String, file_name: String) -> Document {
    let now = Utc::now();
    Document {
        id: Uuid::new_v4().to_string(),
        file_path,
        file_name,
        title: None,
        author: None,
        page_count: None,
        project_id: None,
        last_opened_at: Some(now),
        last_page: 1,
        created_at: now,
        updated_at: now,
    }
}

// Helper function to create a new project
pub fn create_project(name: String) -> Project {
    let now = Utc::now();
    Project {
        id: Uuid::new_v4().to_string(),
        name,
        description: None,
        color: None,
        created_at: now,
        updated_at: now,
    }
}

// Helper function to create a new tag
pub fn create_tag(name: String, color: Option<String>) -> Tag {
    Tag {
        id: Uuid::new_v4().to_string(),
        name,
        color,
    }
}
