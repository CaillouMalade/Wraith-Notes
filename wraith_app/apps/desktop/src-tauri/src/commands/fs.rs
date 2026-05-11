use crate::error::AppError;
use crate::ignore::WorkspaceIgnore;
use crate::state::{AppState, WorkspaceState};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::Manager;

#[derive(Debug, Clone, Serialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_markdown: bool,
    pub file_kind: String,
    pub modified_at: u64,
    /// Document title extracted from frontmatter `title:` or leading `# ` heading.
    /// `None` for directories or files without a recognizable title.
    pub title: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FileContent {
    pub path: String,
    pub content: String,
    pub modified_at: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct WriteResult {
    pub path: String,
    pub modified_at: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ImportResult {
    pub path: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ResolveAssetResult {
    pub path: String,
    pub relative_path: String,
    pub file_kind: String,
}

async fn blocking<T: Send + 'static>(
    f: impl FnOnce() -> Result<T, AppError> + Send + 'static,
) -> Result<T, AppError> {
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| AppError::Io(e.to_string()))?
}

/// Extract a document title from a markdown file by reading its first few KB.
/// Priority: YAML frontmatter `title:` field, then leading `# ` heading.
fn extract_title(path: &Path) -> Option<String> {
    use std::io::Read;

    let mut file = fs::File::open(path).ok()?;
    let mut buf = vec![0u8; 4096];
    let n = file.read(&mut buf).ok()?;
    let text = std::str::from_utf8(&buf[..n]).ok()?;

    // Check for YAML frontmatter (--- delimited)
    if let Some(rest) = text
        .strip_prefix("---\n")
        .or_else(|| text.strip_prefix("---\r\n"))
    {
        // Find the closing ---
        if let Some(end_pos) = rest.find("\n---\n").or_else(|| rest.find("\n---\r\n")) {
            let yaml_block = &rest[..end_pos];
            // Look for title: in the YAML
            for line in yaml_block.lines() {
                let trimmed = line.trim();
                if let Some(value) = trimmed.strip_prefix("title:") {
                    let value = value.trim();
                    // Strip surrounding quotes
                    let title = value
                        .strip_prefix('"')
                        .and_then(|v| v.strip_suffix('"'))
                        .or_else(|| value.strip_prefix('\'').and_then(|v| v.strip_suffix('\'')))
                        .unwrap_or(value);
                    if !title.is_empty() {
                        return Some(title.to_string());
                    }
                }
            }
            // No frontmatter title — check for H1 in the body after frontmatter
            let body_start = end_pos + "\n---\n".len();
            return extract_leading_h1(&rest[body_start..]);
        }
    }

    // No frontmatter — check for H1 heading
    extract_leading_h1(text)
}

/// Extract a title from the first `# ` heading, which must be the first
/// non-blank line in the text.
fn extract_leading_h1(text: &str) -> Option<String> {
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Some(heading) = trimmed.strip_prefix("# ") {
            let title = heading.trim();
            if !title.is_empty() {
                return Some(title.to_string());
            }
        }
        // First non-blank line is not an H1
        return None;
    }
    None
}

fn modified_time(path: &std::path::Path) -> u64 {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .map(|t| {
            t.duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs()
        })
        .unwrap_or(0)
}

fn safe_import_name(name: &str) -> String {
    let cleaned = name
        .replace(['/', '\\', ':'], "-")
        .trim()
        .trim_start_matches('.')
        .to_string();
    if cleaned.is_empty() {
        "Imported file".to_string()
    } else {
        cleaned
    }
}

fn unique_child_path(parent: &Path, name: &str) -> PathBuf {
    let safe_name = safe_import_name(name);
    let first = parent.join(&safe_name);
    if !first.exists() {
        return first;
    }

    let path = Path::new(&safe_name);
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Imported file");
    let ext = path.extension().and_then(|e| e.to_str());

    for n in 2..1000 {
        let candidate_name = match ext {
            Some(ext) => format!("{stem} {n}.{ext}"),
            None => format!("{stem} {n}"),
        };
        let candidate = parent.join(candidate_name);
        if !candidate.exists() {
            return candidate;
        }
    }

    parent.join(format!("{} {}", safe_name, uuid::Uuid::new_v4()))
}

fn supported_file_kind(path: &Path) -> Option<&'static str> {
    let extension = path.extension().and_then(|e| e.to_str())?.to_lowercase();
    match extension.as_str() {
        "md" | "markdown" | "mdx" => Some("markdown"),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp" | "tiff" => Some("image"),
        "pdf" => Some("pdf"),
        _ => None,
    }
}

fn normalize_rel(path: &Path, root: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn collect_supported_assets(root: &Path) -> Vec<PathBuf> {
    let mut assets = Vec::new();
    let Ok(entries) = fs::read_dir(root) else {
        return assets;
    };

    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || name == "node_modules" {
            continue;
        }
        if file_type.is_dir() {
            assets.extend(collect_supported_assets(&path));
        } else if file_type.is_file() && matches!(supported_file_kind(&path), Some("image" | "pdf"))
        {
            assets.push(path);
        }
    }

    assets
}

/// Recursively checks if a directory contains at least one visible supported file.
/// Used as fallback before the index is ready. Skips paths matched by the
/// workspace ignore matcher so ignored directories don't resurrect their
/// parent in the sidebar.
fn dir_contains_supported_file_recursive(path: &Path, ignore: Option<&WorkspaceIgnore>) -> bool {
    let Ok(entries) = fs::read_dir(path) else {
        return false;
    };
    for entry in entries.flatten() {
        let ft = entry.file_type();
        let Ok(ft) = ft else { continue };
        let entry_path = entry.path();

        if let Some(ignore) = ignore {
            if ignore.is_ignored(&entry_path, ft.is_dir()) {
                continue;
            }
        }

        if ft.is_file() {
            if supported_file_kind(&entry_path).is_some() {
                return true;
            }
        } else if ft.is_dir() && dir_contains_supported_file_recursive(&entry_path, ignore) {
            return true;
        }
    }
    false
}

/// O(1) check via the pre-built set, with recursive fallback during initial indexing.
fn dir_contains_supported_file(path: &Path, state: Option<&WorkspaceState>) -> bool {
    if let Some(state) = state {
        if state.index_ready.load(Ordering::Relaxed) {
            if state.dirs_with_markdown.read().contains(path) {
                return true;
            }
            let ignore_arc: Option<Arc<WorkspaceIgnore>> =
                state.workspace_ignore.read().as_ref().map(Arc::clone);
            return dir_contains_supported_file_recursive(path, ignore_arc.as_deref());
        }
        // Snapshot the `Arc<WorkspaceIgnore>` under a brief read lock and
        // release immediately — the recursive fallback below does file I/O
        // and must not hold the RwLock across syscalls (it would block a
        // concurrent workspace switch's `workspace_ignore.write()`).
        let ignore_arc: Option<Arc<WorkspaceIgnore>> =
            state.workspace_ignore.read().as_ref().map(Arc::clone);
        return dir_contains_supported_file_recursive(path, ignore_arc.as_deref());
    }
    dir_contains_supported_file_recursive(path, None)
}

/// Empty folders are first-class organization targets: a newly created folder
/// needs to stay visible so the sidebar can enter inline rename mode before the
/// folder contains its first supported file.
fn dir_is_visible_empty(path: &Path, ignore: Option<&WorkspaceIgnore>) -> bool {
    let Ok(entries) = fs::read_dir(path) else {
        return false;
    };
    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        let entry_path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if name.starts_with('.') {
            continue;
        }
        if let Some(ignore) = ignore {
            if ignore.is_ignored(&entry_path, file_type.is_dir()) {
                continue;
            }
        }
        return false;
    }
    true
}

pub fn read_directory_impl(
    path: &str,
    state: Option<&WorkspaceState>,
) -> Result<Vec<DirEntry>, AppError> {
    let dir_path = PathBuf::from(path);
    if !dir_path.exists() {
        return Err(AppError::NotFound(path.to_string()));
    }

    // Snapshot the `Arc<WorkspaceIgnore>` under a brief read lock and release
    // immediately — we must NOT hold the RwLock across the per-file I/O
    // below. `extract_title` can block for seconds on iCloud placeholders or
    // slow disks; if the guard were still held, a concurrent workspace
    // switch's `workspace_ignore.write()` in `prepare_workspace_state` would
    // be blocked, freezing the switch IPC.
    let ignore_arc: Option<Arc<WorkspaceIgnore>> =
        state.and_then(|s| s.workspace_ignore.read().as_ref().map(Arc::clone));
    let ignore_matcher: Option<&WorkspaceIgnore> = ignore_arc.as_deref();

    let mut dirs = Vec::new();
    let mut files = Vec::new();

    for entry in fs::read_dir(&dir_path)?.flatten() {
        let file_type = entry.file_type()?;
        let entry_path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/dirs (the workspace `.gitignore` stays available
        // because `read_directory` only surfaces markdown files and
        // directories, never dotfiles — see the sidebar spec).
        if name.starts_with('.') {
            continue;
        }

        if let Some(ignore) = ignore_matcher {
            if ignore.is_ignored(&entry_path, file_type.is_dir()) {
                continue;
            }
        }

        if file_type.is_dir() {
            if dir_contains_supported_file(&entry_path, state)
                || dir_is_visible_empty(&entry_path, ignore_matcher)
            {
                dirs.push(DirEntry {
                    name,
                    path: entry_path.to_string_lossy().to_string(),
                    is_dir: true,
                    is_markdown: false,
                    file_kind: "directory".to_string(),
                    modified_at: modified_time(&entry_path),
                    title: None,
                });
            }
        } else if file_type.is_file() {
            if let Some(file_kind) = supported_file_kind(&entry_path) {
                let is_markdown = file_kind == "markdown";
                let title = if is_markdown {
                    extract_title(&entry_path)
                } else {
                    None
                };
                files.push(DirEntry {
                    name,
                    path: entry_path.to_string_lossy().to_string(),
                    is_dir: false,
                    is_markdown,
                    file_kind: file_kind.to_string(),
                    modified_at: modified_time(&entry_path),
                    title,
                });
            }
        }
    }

    // Sort dirs-first, then alphabetical within each group
    dirs.sort_by_key(|a| a.name.to_lowercase());
    files.sort_by_key(|a| a.name.to_lowercase());
    dirs.extend(files);
    Ok(dirs)
}

#[tauri::command]
pub async fn read_directory(
    path: String,
    webview: tauri::Webview,
    app: tauri::AppHandle,
) -> Result<Vec<DirEntry>, AppError> {
    let state = app.state::<AppState>().get_or_create(webview.label());
    blocking(move || read_directory_impl(&path, Some(&state))).await
}

pub fn read_file_impl(path: &str) -> Result<FileContent, AppError> {
    let file_path = PathBuf::from(path);
    if !file_path.exists() {
        return Err(AppError::NotFound(path.to_string()));
    }
    let content = fs::read_to_string(&file_path)?;
    Ok(FileContent {
        path: path.to_string(),
        content,
        modified_at: modified_time(&file_path),
    })
}

#[tauri::command]
pub async fn read_file(path: String) -> Result<FileContent, AppError> {
    blocking(move || read_file_impl(&path)).await
}

pub fn write_file_impl(path: &str, content: &str) -> Result<WriteResult, AppError> {
    let file_path = PathBuf::from(path);

    // Atomic write: write to temp file, then rename
    let dir = file_path
        .parent()
        .ok_or_else(|| AppError::Io("No parent directory".into()))?;
    let temp_path = dir.join(format!(".~{}", uuid::Uuid::new_v4()));
    fs::write(&temp_path, content)?;
    fs::rename(&temp_path, &file_path)?;

    Ok(WriteResult {
        path: path.to_string(),
        modified_at: modified_time(&file_path),
    })
}

#[tauri::command]
pub async fn write_file(
    path: String,
    content: String,
    webview: tauri::Webview,
    app: tauri::AppHandle,
) -> Result<WriteResult, AppError> {
    // Record self-write before spawning (fast, just a HashMap insert).
    // The record is per-window so only this window's watcher suppresses
    // the echo — if another window is watching the same workspace it
    // still sees a genuine file-changed event.
    let state = app.state::<AppState>().get_or_create(webview.label());
    crate::watcher::record_write(&state, &PathBuf::from(&path));

    blocking(move || write_file_impl(&path, &content)).await
}

pub fn create_file_impl(path: &str) -> Result<FileContent, AppError> {
    let file_path = PathBuf::from(path);
    if file_path.exists() {
        return Err(AppError::AlreadyExists(path.to_string()));
    }
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let default_content = "# ";
    fs::write(&file_path, default_content)?;
    Ok(FileContent {
        path: path.to_string(),
        content: default_content.to_string(),
        modified_at: modified_time(&file_path),
    })
}

#[tauri::command]
pub async fn create_file(path: String) -> Result<FileContent, AppError> {
    blocking(move || create_file_impl(&path)).await
}

pub fn create_directory_impl(path: &str) -> Result<DirEntry, AppError> {
    let dir_path = PathBuf::from(path);
    if dir_path.exists() {
        return Err(AppError::AlreadyExists(path.to_string()));
    }
    fs::create_dir_all(&dir_path)?;
    let name = dir_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    Ok(DirEntry {
        name,
        path: path.to_string(),
        is_dir: true,
        is_markdown: false,
        file_kind: "directory".to_string(),
        modified_at: modified_time(&dir_path),
        title: None,
    })
}

#[tauri::command]
pub async fn create_directory(path: String) -> Result<DirEntry, AppError> {
    blocking(move || create_directory_impl(&path)).await
}

pub fn rename_entry_impl(old_path: &str, new_path: &str) -> Result<(), AppError> {
    let old = PathBuf::from(old_path);
    if !old.exists() {
        return Err(AppError::NotFound(old_path.to_string()));
    }
    let new = PathBuf::from(new_path);
    if new.exists() {
        return Err(AppError::AlreadyExists(new_path.to_string()));
    }
    fs::rename(old, new)?;
    Ok(())
}

#[tauri::command]
pub async fn rename_entry(old_path: String, new_path: String) -> Result<(), AppError> {
    blocking(move || rename_entry_impl(&old_path, &new_path)).await
}

pub fn copy_file_impl(source_path: &str, target_path: &str) -> Result<(), AppError> {
    let source = PathBuf::from(source_path);
    if !source.exists() {
        return Err(AppError::NotFound(source_path.to_string()));
    }
    if !source.is_file() {
        return Err(AppError::Io(format!("Not a file: {}", source_path)));
    }

    let target = PathBuf::from(target_path);
    if target.exists() {
        return Err(AppError::AlreadyExists(target_path.to_string()));
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(source, target)?;
    Ok(())
}

#[tauri::command]
pub async fn copy_file(source_path: String, target_path: String) -> Result<(), AppError> {
    blocking(move || copy_file_impl(&source_path, &target_path)).await
}

pub fn import_file_impl(
    target_dir: &str,
    file_name: &str,
    data: Vec<u8>,
) -> Result<ImportResult, AppError> {
    let dir = PathBuf::from(target_dir);
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    if !dir.is_dir() {
        return Err(AppError::Io(format!("Not a directory: {}", target_dir)));
    }

    let path = unique_child_path(&dir, file_name);
    fs::write(&path, data)?;
    Ok(ImportResult {
        name: path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| file_name.to_string()),
        path: path.to_string_lossy().to_string(),
    })
}

fn copy_dir_recursive(source: &Path, target: &Path) -> Result<(), AppError> {
    fs::create_dir_all(target)?;

    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        let file_type = entry.file_type()?;

        if file_type.is_dir() {
            copy_dir_recursive(&source_path, &target_path)?;
        } else if file_type.is_file() {
            fs::copy(&source_path, &target_path)?;
        }
    }

    Ok(())
}

pub fn import_paths_impl(
    target_dir: &str,
    source_paths: Vec<String>,
) -> Result<Vec<ImportResult>, AppError> {
    let dir = PathBuf::from(target_dir);
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    if !dir.is_dir() {
        return Err(AppError::Io(format!("Not a directory: {}", target_dir)));
    }

    let target_canonical = fs::canonicalize(&dir)?;
    let mut results = Vec::new();

    for source in source_paths {
        let source_path = PathBuf::from(&source);
        if !source_path.exists() {
            return Err(AppError::NotFound(source));
        }

        let source_canonical = fs::canonicalize(&source_path)?;
        if source_canonical == target_canonical || target_canonical.starts_with(&source_canonical) {
            return Err(AppError::Io(format!(
                "Cannot import a folder into itself: {}",
                source_path.to_string_lossy()
            )));
        }

        let name = source_path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("Imported file");
        let target_path = unique_child_path(&dir, name);

        if source_path.is_dir() {
            copy_dir_recursive(&source_path, &target_path)?;
        } else if source_path.is_file() {
            fs::copy(&source_path, &target_path)?;
        } else {
            continue;
        }

        results.push(ImportResult {
            name: target_path
                .file_name()
                .map(|name| name.to_string_lossy().to_string())
                .unwrap_or_else(|| name.to_string()),
            path: target_path.to_string_lossy().to_string(),
        });
    }

    Ok(results)
}

#[tauri::command]
pub async fn import_file(
    target_dir: String,
    file_name: String,
    data: Vec<u8>,
) -> Result<ImportResult, AppError> {
    blocking(move || import_file_impl(&target_dir, &file_name, data)).await
}

#[tauri::command]
pub async fn import_paths(
    target_dir: String,
    source_paths: Vec<String>,
) -> Result<Vec<ImportResult>, AppError> {
    blocking(move || import_paths_impl(&target_dir, source_paths)).await
}

pub fn resolve_vault_asset_impl(
    workspace_root: &str,
    current_file_path: &str,
    target: &str,
) -> Result<Option<ResolveAssetResult>, AppError> {
    let root = PathBuf::from(workspace_root);
    let current_dir = PathBuf::from(current_file_path)
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| root.clone());
    let normalized = target
        .trim()
        .replace('\\', "/")
        .trim_start_matches('/')
        .to_string();
    if normalized.is_empty() {
        return Ok(None);
    }

    let mut candidates = Vec::new();
    candidates.push(root.join(&normalized));
    candidates.push(current_dir.join(&normalized));

    let target_name = Path::new(&normalized)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(&normalized);
    for dir in ["attachments", "Attachments", "assets", "Assets"] {
        candidates.push(root.join(dir).join(target_name));
    }
    if let Some(stem) = Path::new(current_file_path)
        .file_stem()
        .and_then(|stem| stem.to_str())
    {
        candidates.push(current_dir.join(format!("{stem}-assets")).join(target_name));
    }

    for candidate in candidates {
        if candidate.exists() && matches!(supported_file_kind(&candidate), Some("image" | "pdf")) {
            let kind = supported_file_kind(&candidate).unwrap_or("image");
            return Ok(Some(ResolveAssetResult {
                relative_path: normalize_rel(&candidate, &root),
                path: candidate.to_string_lossy().to_string(),
                file_kind: kind.to_string(),
            }));
        }
    }

    let normalized_lower = normalized.to_lowercase();
    let target_name_lower = target_name.to_lowercase();
    let matches: Vec<PathBuf> = collect_supported_assets(&root)
        .into_iter()
        .filter(|asset| {
            let rel = normalize_rel(asset, &root).to_lowercase();
            rel == normalized_lower
                || rel.ends_with(&format!("/{normalized_lower}"))
                || asset
                    .file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| name.to_lowercase() == target_name_lower)
        })
        .collect();

    if matches.len() == 1 {
        let path = matches[0].clone();
        let kind = supported_file_kind(&path).unwrap_or("image");
        return Ok(Some(ResolveAssetResult {
            relative_path: normalize_rel(&path, &root),
            path: path.to_string_lossy().to_string(),
            file_kind: kind.to_string(),
        }));
    }

    Ok(None)
}

#[tauri::command]
pub async fn resolve_vault_asset(
    workspace_root: String,
    current_file_path: String,
    target: String,
) -> Result<Option<ResolveAssetResult>, AppError> {
    blocking(move || resolve_vault_asset_impl(&workspace_root, &current_file_path, &target)).await
}

pub fn delete_entry_impl(path: &str) -> Result<(), AppError> {
    let entry_path = PathBuf::from(path);
    if !entry_path.exists() {
        return Err(AppError::NotFound(path.to_string()));
    }
    trash::delete(&entry_path).map_err(|e| AppError::Io(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_entry(path: String) -> Result<(), AppError> {
    blocking(move || delete_entry_impl(&path)).await
}

#[tauri::command]
pub async fn file_exists(path: String) -> bool {
    tauri::async_runtime::spawn_blocking(move || PathBuf::from(&path).exists())
        .await
        .unwrap_or(false)
}

pub fn open_path_impl(path: &str) -> Result<(), AppError> {
    let target = PathBuf::from(path);
    if !target.exists() {
        return Err(AppError::NotFound(path.to_string()));
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&target)
            .spawn()
            .map_err(|e| AppError::Io(e.to_string()))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &target.to_string_lossy()])
            .spawn()
            .map_err(|e| AppError::Io(e.to_string()))?;
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&target)
            .spawn()
            .map_err(|e| AppError::Io(e.to_string()))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn open_path(path: String) -> Result<(), AppError> {
    blocking(move || open_path_impl(&path)).await
}

pub fn reveal_in_file_manager_impl(path: &str) -> Result<(), AppError> {
    let target = PathBuf::from(path);
    if !target.exists() {
        return Err(AppError::NotFound(path.to_string()));
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&target)
            .spawn()
            .map_err(|e| AppError::Io(e.to_string()))?;
    }

    #[cfg(target_os = "windows")]
    {
        // `explorer /select,<path>` selects the file inside its parent. The
        // comma must be part of the same argument or Windows parses it as a
        // separator.
        std::process::Command::new("explorer")
            .arg(format!("/select,{}", target.display()))
            .spawn()
            .map_err(|e| AppError::Io(e.to_string()))?;
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        // Linux: just open the parent directory with xdg-open. There is no
        // portable way to select the target file.
        let parent = target.parent().unwrap_or(&target);
        std::process::Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map_err(|e| AppError::Io(e.to_string()))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn reveal_in_file_manager(path: String) -> Result<(), AppError> {
    blocking(move || reveal_in_file_manager_impl(&path)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn setup_test_dir() -> TempDir {
        let dir = TempDir::new().unwrap();
        // Create some markdown files
        fs::write(dir.path().join("hello.md"), "# Hello").unwrap();
        fs::write(dir.path().join("world.md"), "# World").unwrap();
        fs::write(dir.path().join("image.png"), "not a real png").unwrap();
        fs::write(dir.path().join("manual.pdf"), "not a real pdf").unwrap();
        // Create a non-markdown file (should be filtered)
        fs::write(dir.path().join("readme.txt"), "text").unwrap();
        // Create a subdirectory with markdown
        fs::create_dir(dir.path().join("notes")).unwrap();
        fs::write(dir.path().join("notes").join("note.md"), "# Note").unwrap();
        // Create a subdirectory with only supported assets
        fs::create_dir(dir.path().join("assets")).unwrap();
        fs::write(
            dir.path().join("assets").join("photo.webp"),
            "not a real webp",
        )
        .unwrap();
        // Create an empty subdirectory. It should stay visible so a newly
        // created folder can be renamed before it contains notes/assets.
        fs::create_dir(dir.path().join("blank")).unwrap();
        // Create a subdirectory without supported files (should be filtered)
        fs::create_dir(dir.path().join("empty")).unwrap();
        fs::write(dir.path().join("empty").join("data.txt"), "data").unwrap();
        dir
    }

    #[test]
    fn test_read_directory_sorts_dirs_first() {
        let dir = setup_test_dir();
        let result = read_directory_impl(&dir.path().to_string_lossy(), None).unwrap();

        // First entries should be directories, then files
        assert!(result[0].is_dir);
        assert_eq!(result[0].name, "assets");
        assert!(result[0].title.is_none());
        assert!(result[1].is_dir);
        assert_eq!(result[1].name, "blank");
        assert!(result[1].title.is_none());
        assert!(result[2].is_dir);
        assert_eq!(result[2].name, "notes");
        assert!(result[2].title.is_none());
        // Remaining should be files, sorted alphabetically.
        assert!(!result[3].is_dir);
        assert_eq!(result[3].name, "hello.md");
        assert_eq!(result[3].title.as_deref(), Some("Hello"));
    }

    #[test]
    fn test_read_directory_filters_to_supported_files() {
        let dir = setup_test_dir();
        let result = read_directory_impl(&dir.path().to_string_lossy(), None).unwrap();

        // Should include supported asset files/dirs and empty dirs, but not
        // readme.txt or empty/ with only unsupported visible contents.
        assert_eq!(result.len(), 7);
        assert!(result.iter().any(|entry| entry.name == "assets"));
        assert!(result.iter().any(|entry| entry.name == "blank"));
        assert!(result.iter().any(|entry| entry.name == "notes"));
        assert!(!result.iter().any(|entry| entry.name == "empty"));
        assert!(result
            .iter()
            .any(|entry| entry.name == "image.png" && entry.file_kind == "image"));
        assert!(result
            .iter()
            .any(|entry| entry.name == "manual.pdf" && entry.file_kind == "pdf"));
        for entry in &result {
            assert!(
                entry.is_dir || matches!(entry.file_kind.as_str(), "markdown" | "image" | "pdf")
            );
        }
    }

    #[test]
    fn test_read_directory_uses_index_when_ready() {
        let dir = setup_test_dir();
        let state = WorkspaceState::default();

        // Build index
        let cancel = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let (indexed, dirs) = crate::commands::search::index_workspace_impl(dir.path(), cancel);
        *state.file_index.write() = indexed;
        *state.dirs_with_markdown.write() = dirs;
        state.index_ready.store(true, Ordering::Relaxed);

        let result = read_directory_impl(&dir.path().to_string_lossy(), Some(&state)).unwrap();

        assert_eq!(result.len(), 7);
        assert!(result.iter().any(|entry| entry.name == "notes"));
        assert!(result.iter().any(|entry| entry.name == "assets"));
        assert!(result.iter().any(|entry| entry.name == "blank"));
        assert!(result.iter().any(|entry| entry.name == "image.png"));
    }

    #[test]
    fn test_read_file_returns_content() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("test.md");
        fs::write(&path, "# Test Content").unwrap();

        let result = read_file_impl(&path.to_string_lossy()).unwrap();
        assert_eq!(result.content, "# Test Content");
    }

    #[test]
    fn test_read_file_not_found() {
        let result = read_file_impl("/nonexistent/file.md");
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::NotFound(_)));
    }

    #[test]
    fn test_resolve_vault_asset_uses_unique_suffix_fallback() {
        let dir = TempDir::new().unwrap();
        fs::create_dir_all(dir.path().join("2_PROJECTS").join("old")).unwrap();
        let note = dir.path().join("note.md");
        let image = dir
            .path()
            .join("2_PROJECTS")
            .join("old")
            .join("Pasted image.png");
        fs::write(&note, "# Note").unwrap();
        fs::write(&image, "image").unwrap();

        let result = resolve_vault_asset_impl(
            &dir.path().to_string_lossy(),
            &note.to_string_lossy(),
            "old/Pasted image.png",
        )
        .unwrap()
        .unwrap();

        assert_eq!(result.file_kind, "image");
        assert_eq!(result.relative_path, "2_PROJECTS/old/Pasted image.png");
    }

    #[test]
    fn test_import_paths_copies_existing_file_with_unique_name() {
        let source_dir = TempDir::new().unwrap();
        let target_dir = TempDir::new().unwrap();
        let source = source_dir.path().join("image.png");
        fs::write(&source, b"new image").unwrap();
        fs::write(target_dir.path().join("image.png"), b"old image").unwrap();

        let result = import_paths_impl(
            &target_dir.path().to_string_lossy(),
            vec![source.to_string_lossy().to_string()],
        )
        .unwrap();

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "image 2.png");
        assert_eq!(
            fs::read(target_dir.path().join("image 2.png")).unwrap(),
            b"new image"
        );
    }

    #[test]
    fn test_write_file_atomic() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("output.md");
        fs::write(&path, "old").unwrap();

        let result = write_file_impl(&path.to_string_lossy(), "new content").unwrap();
        assert_eq!(result.path, path.to_string_lossy().to_string());

        let content = fs::read_to_string(&path).unwrap();
        assert_eq!(content, "new content");
    }

    #[test]
    fn test_create_file_already_exists() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("exists.md");
        fs::write(&path, "").unwrap();

        let result = create_file_impl(&path.to_string_lossy());
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::AlreadyExists(_)));
    }

    #[test]
    fn test_delete_entry_moves_to_trash() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("to_delete.md");
        fs::write(&path, "delete me").unwrap();
        assert!(path.exists());

        delete_entry_impl(&path.to_string_lossy()).unwrap();
        assert!(!path.exists());
    }

    #[test]
    fn test_rename_entry() {
        let dir = TempDir::new().unwrap();
        let old_path = dir.path().join("old.md");
        let new_path = dir.path().join("new.md");
        fs::write(&old_path, "content").unwrap();

        rename_entry_impl(&old_path.to_string_lossy(), &new_path.to_string_lossy()).unwrap();

        assert!(!old_path.exists());
        assert!(new_path.exists());
        assert_eq!(fs::read_to_string(&new_path).unwrap(), "content");
    }

    #[test]
    fn test_rename_entry_not_found() {
        let result = rename_entry_impl("/nonexistent/old.md", "/nonexistent/new.md");
        assert!(matches!(result.unwrap_err(), AppError::NotFound(_)));
    }

    #[test]
    fn test_rename_entry_already_exists() {
        let dir = TempDir::new().unwrap();
        let old_path = dir.path().join("old.md");
        let new_path = dir.path().join("new.md");
        fs::write(&old_path, "old").unwrap();
        fs::write(&new_path, "new").unwrap();

        let result = rename_entry_impl(&old_path.to_string_lossy(), &new_path.to_string_lossy());
        assert!(matches!(result.unwrap_err(), AppError::AlreadyExists(_)));
    }

    #[test]
    fn test_error_serializes() {
        let err = AppError::Io("test error".to_string());
        let json = serde_json::to_string(&err).unwrap();
        assert_eq!(json, "\"IO error: test error\"");

        let err = AppError::NotFound("file.md".to_string());
        let json = serde_json::to_string(&err).unwrap();
        assert_eq!(json, "\"Not found: file.md\"");

        let err = AppError::NoWorkspace;
        let json = serde_json::to_string(&err).unwrap();
        assert_eq!(json, "\"No workspace is open\"");
    }

    #[test]
    fn test_extract_title_from_h1() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("doc.md");
        fs::write(&path, "# My Document\n\nSome content").unwrap();
        assert_eq!(extract_title(&path).as_deref(), Some("My Document"));
    }

    #[test]
    fn test_extract_title_from_frontmatter() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("doc.md");
        fs::write(&path, "---\ntitle: Front Title\n---\n\nBody").unwrap();
        assert_eq!(extract_title(&path).as_deref(), Some("Front Title"));
    }

    #[test]
    fn test_extract_title_frontmatter_quoted() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("doc.md");
        fs::write(&path, "---\ntitle: \"Quoted Title\"\n---\n\nBody").unwrap();
        assert_eq!(extract_title(&path).as_deref(), Some("Quoted Title"));
    }

    #[test]
    fn test_extract_title_frontmatter_beats_h1() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("doc.md");
        fs::write(&path, "---\ntitle: FM Title\n---\n\n# Heading").unwrap();
        assert_eq!(extract_title(&path).as_deref(), Some("FM Title"));
    }

    #[test]
    fn test_extract_title_h1_after_empty_frontmatter() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("doc.md");
        fs::write(&path, "---\ndate: 2025-01-01\n---\n\n# Fallback Heading").unwrap();
        assert_eq!(extract_title(&path).as_deref(), Some("Fallback Heading"));
    }

    #[test]
    fn test_extract_title_none_for_empty_file() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("doc.md");
        fs::write(&path, "").unwrap();
        assert_eq!(extract_title(&path), None);
    }

    #[test]
    fn test_extract_title_none_when_no_heading() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("doc.md");
        fs::write(&path, "Just a paragraph.\nAnother line.").unwrap();
        assert_eq!(extract_title(&path), None);
    }

    #[test]
    fn test_workspace_state_default() {
        let state = WorkspaceState::default();
        assert!(state.workspace_root.read().is_none());
        assert!(state.file_index.read().is_empty());
        assert!(state.dirs_with_markdown.read().is_empty());
        assert!(!state.index_ready.load(Ordering::Relaxed));
        assert!(state.watcher_handle.read().is_none());
    }
}
