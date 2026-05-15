use crate::error::AppError;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::OnceLock;
use tauri::webview::WebviewBuilder;
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Url, Webview, WebviewUrl};

const DEFAULT_BROWSER_URL: &str = "https://www.google.com";
const HIDDEN_POS: f64 = -20_000.0;

// Inject a thin overlay-style scrollbar so pages render with a tasteful gutter
// when the user has macOS set to "Show scroll bars: Always" or is on Windows.
const SCROLLBAR_POLISH_SCRIPT: &str = r#"
(function () {
  function inject() {
    if (document.getElementById('__wraith_browser_scrollbar_polish')) return;
    var style = document.createElement('style');
    style.id = '__wraith_browser_scrollbar_polish';
    style.textContent = [
      '::-webkit-scrollbar { width: 10px; height: 10px; }',
      '::-webkit-scrollbar-track { background: transparent; }',
      '::-webkit-scrollbar-thumb {',
      '  background: rgba(128,128,128,0.35);',
      '  border-radius: 6px;',
      '  border: 2px solid transparent;',
      '  background-clip: padding-box;',
      '}',
      '::-webkit-scrollbar-thumb:hover { background-color: rgba(128,128,128,0.6); background-clip: padding-box; }',
      '::-webkit-scrollbar-corner { background: transparent; }'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject, { once: true });
  } else {
    inject();
  }
})();
"#;

#[derive(Debug, Clone, Deserialize)]
pub struct BrowserBounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct BrowserSnapshot {
    url: String,
    title: Option<String>,
}

struct BrowserEntry {
    webview: Webview,
    url: String,
    title: Option<String>,
}

static BROWSERS: OnceLock<Mutex<HashMap<String, BrowserEntry>>> = OnceLock::new();

fn browsers() -> &'static Mutex<HashMap<String, BrowserEntry>> {
    BROWSERS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn percent_encode_query(input: &str) -> String {
    let mut out = String::new();
    for byte in input.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char)
            }
            b' ' => out.push('+'),
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

fn normalize_url(raw: Option<String>) -> Result<Url, AppError> {
    let input = raw
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(DEFAULT_BROWSER_URL);

    let candidate = if input.starts_with("http://") || input.starts_with("https://") {
        input.to_string()
    } else if !input.contains(' ') && input.contains('.') {
        format!("https://{input}")
    } else {
        format!(
            "https://www.google.com/search?q={}",
            percent_encode_query(input)
        )
    };

    let url = Url::parse(&candidate).map_err(|err| AppError::Io(format!("Invalid URL: {err}")))?;
    match url.scheme() {
        "http" | "https" => Ok(url),
        _ => Err(AppError::Io(
            "Browser only supports http and https URLs".to_string(),
        )),
    }
}

fn set_browser_bounds(webview: &Webview, bounds: &BrowserBounds) -> Result<(), AppError> {
    let width = bounds.width.max(1.0);
    let height = bounds.height.max(1.0);
    webview
        .set_position(LogicalPosition::new(bounds.x, bounds.y))
        .map_err(|err| AppError::Io(err.to_string()))?;
    webview
        .set_size(LogicalSize::new(width, height))
        .map_err(|err| AppError::Io(err.to_string()))?;
    Ok(())
}

fn hide_browser(webview: &Webview) -> Result<(), AppError> {
    webview
        .set_position(LogicalPosition::new(HIDDEN_POS, HIDDEN_POS))
        .map_err(|err| AppError::Io(err.to_string()))?;
    webview
        .set_size(LogicalSize::new(1.0, 1.0))
        .map_err(|err| AppError::Io(err.to_string()))?;
    Ok(())
}

fn snapshot_for(label: &str) -> Option<BrowserSnapshot> {
    browsers().lock().get(label).map(|entry| BrowserSnapshot {
        url: entry.url.clone(),
        title: entry.title.clone(),
    })
}

fn emit_snapshot(app: &AppHandle, window_label: &str) {
    if let Some(snapshot) = snapshot_for(window_label) {
        let _ = app.emit_to(window_label, "browser:state", snapshot);
    }
}

#[tauri::command]
pub async fn browser_show(
    bounds: BrowserBounds,
    url: Option<String>,
    zoom: Option<f64>,
    webview: tauri::Webview,
    app: AppHandle,
) -> Result<BrowserSnapshot, AppError> {
    let window_label = webview.label().to_string();
    let target_url = normalize_url(url)?;

    if let Some(entry) = browsers().lock().get_mut(&window_label) {
        set_browser_bounds(&entry.webview, &bounds)?;
        if entry.url != target_url.as_str() {
            entry
                .webview
                .navigate(target_url.clone())
                .map_err(|err| AppError::Io(err.to_string()))?;
            entry.url = target_url.to_string();
            entry.title = None;
        }
        if let Some(z) = zoom {
            let _ = entry.webview.set_zoom(z.clamp(0.25, 5.0));
        }
        return Ok(BrowserSnapshot {
            url: entry.url.clone(),
            title: entry.title.clone(),
        });
    }

    let window = webview.window();
    let child_label = format!("{window_label}-browser");
    let state_label_for_title = window_label.clone();
    let state_label_for_load = window_label.clone();
    let app_for_title = app.clone();
    let app_for_load = app.clone();

    let builder = WebviewBuilder::new(child_label, WebviewUrl::External(target_url.clone()))
        .accept_first_mouse(true)
        .zoom_hotkeys_enabled(true)
        .initialization_script_for_all_frames(SCROLLBAR_POLISH_SCRIPT)
        .on_document_title_changed(move |_browser, title| {
            if let Some(entry) = browsers().lock().get_mut(&state_label_for_title) {
                entry.title = Some(title);
            }
            emit_snapshot(&app_for_title, &state_label_for_title);
        })
        .on_page_load(move |browser, _event| {
            if let Ok(url) = browser.url() {
                if let Some(entry) = browsers().lock().get_mut(&state_label_for_load) {
                    entry.url = url.to_string();
                }
                emit_snapshot(&app_for_load, &state_label_for_load);
            }
        });

    let browser = window
        .add_child(
            builder,
            LogicalPosition::new(bounds.x, bounds.y),
            LogicalSize::new(bounds.width.max(1.0), bounds.height.max(1.0)),
        )
        .map_err(|err| AppError::Io(err.to_string()))?;

    let initial_zoom = zoom.unwrap_or(0.75).clamp(0.25, 5.0);
    let _ = browser.set_zoom(initial_zoom);

    let snapshot = BrowserSnapshot {
        url: target_url.to_string(),
        title: None,
    };
    browsers().lock().insert(
        window_label,
        BrowserEntry {
            webview: browser,
            url: snapshot.url.clone(),
            title: None,
        },
    );
    Ok(snapshot)
}

#[tauri::command]
pub fn browser_set_zoom(zoom: f64, webview: tauri::Webview) -> Result<(), AppError> {
    let window_label = webview.label().to_string();
    if let Some(entry) = browsers().lock().get(&window_label) {
        entry
            .webview
            .set_zoom(zoom.clamp(0.25, 5.0))
            .map_err(|err| AppError::Io(err.to_string()))?;
    }
    Ok(())
}

#[tauri::command]
pub fn browser_set_bounds(bounds: BrowserBounds, webview: tauri::Webview) -> Result<(), AppError> {
    let window_label = webview.label().to_string();
    if let Some(entry) = browsers().lock().get(&window_label) {
        set_browser_bounds(&entry.webview, &bounds)?;
    }
    Ok(())
}

#[tauri::command]
pub fn browser_hide(webview: tauri::Webview) -> Result<(), AppError> {
    let window_label = webview.label().to_string();
    if let Some(entry) = browsers().lock().get(&window_label) {
        hide_browser(&entry.webview)?;
    }
    Ok(())
}

#[tauri::command]
pub fn browser_navigate(url: String, webview: tauri::Webview) -> Result<BrowserSnapshot, AppError> {
    let window_label = webview.label().to_string();
    let target_url = normalize_url(Some(url))?;
    let mut browsers = browsers().lock();
    let entry = browsers
        .get_mut(&window_label)
        .ok_or_else(|| AppError::NotFound("Browser".to_string()))?;
    entry
        .webview
        .navigate(target_url.clone())
        .map_err(|err| AppError::Io(err.to_string()))?;
    entry.url = target_url.to_string();
    entry.title = None;
    Ok(BrowserSnapshot {
        url: entry.url.clone(),
        title: None,
    })
}

#[tauri::command]
pub fn browser_reload(webview: tauri::Webview) -> Result<(), AppError> {
    let window_label = webview.label().to_string();
    if let Some(entry) = browsers().lock().get(&window_label) {
        entry
            .webview
            .reload()
            .map_err(|err| AppError::Io(err.to_string()))?;
    }
    Ok(())
}

#[tauri::command]
pub fn browser_history(direction: String, webview: tauri::Webview) -> Result<(), AppError> {
    let window_label = webview.label().to_string();
    let script = match direction.as_str() {
        "back" => "history.back()",
        "forward" => "history.forward()",
        _ => {
            return Err(AppError::Io(
                "Unknown browser history direction".to_string(),
            ))
        }
    };
    if let Some(entry) = browsers().lock().get(&window_label) {
        entry
            .webview
            .eval(script)
            .map_err(|err| AppError::Io(err.to_string()))?;
    }
    Ok(())
}

pub fn close_window_browser(label: &str) {
    if let Some(entry) = browsers().lock().remove(label) {
        let _ = entry.webview.close();
    }
}
