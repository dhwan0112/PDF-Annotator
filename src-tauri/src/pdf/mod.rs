// PDF processing module
use lopdf::Document;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct ExtendedPdfMetadata {
    pub title: Option<String>,
    pub author: Option<String>,
    pub subject: Option<String>,
    pub keywords: Option<String>,
    pub creator: Option<String>,
    pub producer: Option<String>,
    pub creation_date: Option<String>,
    pub modification_date: Option<String>,
    pub page_count: u32,
}

/// Read PDF metadata using lopdf
pub fn read_pdf_metadata_lopdf(file_path: &str) -> Result<ExtendedPdfMetadata, String> {
    let doc = Document::load(file_path).map_err(|e| format!("Failed to load PDF: {}", e))?;

    let page_count = doc.get_pages().len() as u32;

    // Get document info dictionary
    let mut metadata = ExtendedPdfMetadata {
        title: None,
        author: None,
        subject: None,
        keywords: None,
        creator: None,
        producer: None,
        creation_date: None,
        modification_date: None,
        page_count,
    };

    // Try to get info from trailer
    if let Ok(info_ref) = doc.trailer.get(b"Info") {
        if let Ok(info_id) = info_ref.as_reference() {
            if let Ok(info_dict) = doc.get_dictionary(info_id) {
                metadata.title = get_string_from_dict(info_dict, b"Title");
                metadata.author = get_string_from_dict(info_dict, b"Author");
                metadata.subject = get_string_from_dict(info_dict, b"Subject");
                metadata.keywords = get_string_from_dict(info_dict, b"Keywords");
                metadata.creator = get_string_from_dict(info_dict, b"Creator");
                metadata.producer = get_string_from_dict(info_dict, b"Producer");
                metadata.creation_date = get_string_from_dict(info_dict, b"CreationDate");
                metadata.modification_date = get_string_from_dict(info_dict, b"ModDate");
            }
        }
    }

    Ok(metadata)
}

/// Extract string from PDF dictionary
fn get_string_from_dict(
    dict: &lopdf::Dictionary,
    key: &[u8],
) -> Option<String> {
    dict.get(key).ok().and_then(|obj| {
        match obj {
            lopdf::Object::String(bytes, _) => decode_pdf_string(bytes),
            lopdf::Object::Name(bytes) => String::from_utf8(bytes.clone()).ok(),
            _ => None,
        }
    })
}

/// Decode PDF string (handling different encodings)
fn decode_pdf_string(bytes: &[u8]) -> Option<String> {
    // Check for UTF-16BE BOM
    if bytes.len() >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF {
        // UTF-16 Big Endian
        let utf16: Vec<u16> = bytes[2..]
            .chunks(2)
            .filter_map(|chunk| {
                if chunk.len() == 2 {
                    Some(u16::from_be_bytes([chunk[0], chunk[1]]))
                } else {
                    None
                }
            })
            .collect();
        return String::from_utf16(&utf16).ok();
    }

    // Try UTF-8 first
    if let Ok(s) = String::from_utf8(bytes.to_vec()) {
        return Some(s);
    }

    // Try Latin-1 (ISO-8859-1) as fallback
    Some(
        bytes
            .iter()
            .map(|&b| b as char)
            .collect()
    )
}

/// Extract text content from specified pages
pub fn extract_text_from_pdf(file_path: &str, page_numbers: &[u32]) -> Result<String, String> {
    let doc = Document::load(file_path).map_err(|e| format!("Failed to load PDF: {}", e))?;

    let pages = doc.get_pages();
    let mut all_text = String::new();

    for &page_num in page_numbers {
        if let Some(&page_id) = pages.get(&page_num) {
            if let Ok(text) = extract_page_text(&doc, page_id) {
                if !all_text.is_empty() {
                    all_text.push_str("\n\n--- Page ");
                    all_text.push_str(&page_num.to_string());
                    all_text.push_str(" ---\n\n");
                }
                all_text.push_str(&text);
            }
        }
    }

    Ok(all_text)
}

/// Extract text from a single page
fn extract_page_text(doc: &Document, page_id: lopdf::ObjectId) -> Result<String, String> {
    let mut text = String::new();

    // Get page dictionary
    let page_dict = doc
        .get_dictionary(page_id)
        .map_err(|e| format!("Failed to get page dictionary: {}", e))?;

    // Get contents
    let contents = match page_dict.get(b"Contents") {
        Ok(obj) => obj,
        Err(_) => return Ok(String::new()),
    };

    // Contents can be a single stream or an array of streams
    let content_streams: Vec<lopdf::ObjectId> = match contents {
        lopdf::Object::Reference(id) => vec![*id],
        lopdf::Object::Array(arr) => arr
            .iter()
            .filter_map(|obj| {
                if let lopdf::Object::Reference(id) = obj {
                    Some(*id)
                } else {
                    None
                }
            })
            .collect(),
        _ => return Ok(String::new()),
    };

    // Extract text from each content stream
    for stream_id in content_streams {
        if let Ok(stream) = doc.get_object(stream_id) {
            if let Ok(stream_obj) = stream.as_stream() {
                if let Ok(content) = stream_obj.decompressed_content() {
                    let extracted = extract_text_from_content(&content);
                    text.push_str(&extracted);
                }
            }
        }
    }

    // Clean up the text
    let cleaned = clean_extracted_text(&text);
    Ok(cleaned)
}

/// Extract text strings from PDF content stream
fn extract_text_from_content(content: &[u8]) -> String {
    let mut text = String::new();
    let content_str = String::from_utf8_lossy(content);

    // Simple text extraction from PDF content stream
    // Looking for text between parentheses () or angle brackets <>

    let mut in_text = false;
    let mut current_text = String::new();
    let mut escape_next = false;
    let mut paren_depth = 0;

    for ch in content_str.chars() {
        if escape_next {
            current_text.push(ch);
            escape_next = false;
            continue;
        }

        match ch {
            '\\' if in_text => {
                escape_next = true;
            }
            '(' => {
                if in_text {
                    paren_depth += 1;
                    current_text.push(ch);
                } else {
                    in_text = true;
                    paren_depth = 1;
                }
            }
            ')' => {
                if in_text {
                    paren_depth -= 1;
                    if paren_depth == 0 {
                        in_text = false;
                        if !current_text.is_empty() {
                            text.push_str(&current_text);
                            text.push(' ');
                        }
                        current_text.clear();
                    } else {
                        current_text.push(ch);
                    }
                }
            }
            _ if in_text => {
                current_text.push(ch);
            }
            _ => {}
        }
    }

    text
}

/// Clean up extracted text
fn clean_extracted_text(text: &str) -> String {
    let mut result = String::new();
    let mut last_was_space = false;

    for ch in text.chars() {
        // Replace control characters and normalize whitespace
        if ch.is_control() || ch == '\r' {
            if !last_was_space {
                result.push(' ');
                last_was_space = true;
            }
        } else if ch.is_whitespace() {
            if !last_was_space {
                result.push(' ');
                last_was_space = true;
            }
        } else {
            result.push(ch);
            last_was_space = false;
        }
    }

    result.trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_pdf_string() {
        // Test UTF-8
        let utf8 = b"Hello World";
        assert_eq!(decode_pdf_string(utf8), Some("Hello World".to_string()));

        // Test Latin-1
        let latin1 = [0x48, 0x65, 0x6C, 0x6C, 0x6F]; // "Hello"
        assert_eq!(decode_pdf_string(&latin1), Some("Hello".to_string()));
    }
}
