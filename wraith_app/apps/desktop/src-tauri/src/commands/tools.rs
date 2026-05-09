use crate::error::AppError;
use crate::state::AppState;
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, OnceLock};
use std::time::Duration;
use tauri::{Emitter, Manager};

#[derive(Debug, Clone, Serialize)]
pub struct CommandOutput {
    pub status: i32,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TerminalStartResult {
    pub id: String,
    pub cwd: String,
    pub shell: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TerminalDataEvent {
    pub id: String,
    pub stream: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentStartResult {
    pub id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentDataEvent {
    pub id: String,
    pub stream: String,
    pub data: String,
    pub status: Option<i32>,
}

struct TerminalSession {
    label: String,
    master: Box<dyn portable_pty::MasterPty + Send>,
    child: Box<dyn portable_pty::Child + Send>,
    writer: Box<dyn Write + Send>,
}

struct AgentSession {
    label: String,
    child: Arc<parking_lot::Mutex<Child>>,
}

static TERMINALS: OnceLock<parking_lot::Mutex<HashMap<String, TerminalSession>>> = OnceLock::new();
static AGENTS: OnceLock<parking_lot::Mutex<HashMap<String, AgentSession>>> = OnceLock::new();

fn terminals() -> &'static parking_lot::Mutex<HashMap<String, TerminalSession>> {
    TERMINALS.get_or_init(|| parking_lot::Mutex::new(HashMap::new()))
}

fn agents() -> &'static parking_lot::Mutex<HashMap<String, AgentSession>> {
    AGENTS.get_or_init(|| parking_lot::Mutex::new(HashMap::new()))
}

async fn blocking<T: Send + 'static>(
    f: impl FnOnce() -> Result<T, AppError> + Send + 'static,
) -> Result<T, AppError> {
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| AppError::Io(e.to_string()))?
}

fn current_workspace(
    webview: &tauri::Webview,
    app: &tauri::AppHandle,
) -> Result<PathBuf, AppError> {
    app.state::<AppState>()
        .get_or_create(webview.label())
        .workspace_root
        .read()
        .clone()
        .ok_or(AppError::NoWorkspace)
}

fn run_program(
    workspace: PathBuf,
    program: &str,
    args: &[&str],
) -> Result<CommandOutput, AppError> {
    let output = Command::new(program)
        .args(args)
        .current_dir(workspace)
        .output()
        .map_err(|e| AppError::Io(e.to_string()))?;

    Ok(CommandOutput {
        status: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

fn run_program_owned(
    workspace: PathBuf,
    program: &str,
    args: Vec<String>,
) -> Result<CommandOutput, AppError> {
    let output = Command::new(program)
        .args(args)
        .current_dir(workspace)
        .output()
        .map_err(|e| AppError::Io(e.to_string()))?;

    Ok(CommandOutput {
        status: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

fn build_agent_args(args: Vec<String>, prompt: String) -> Vec<String> {
    let mut final_args = Vec::new();
    let mut replaced_prompt = false;
    for arg in args {
        if arg.contains("{prompt}") {
            final_args.push(arg.replace("{prompt}", &prompt));
            replaced_prompt = true;
        } else {
            final_args.push(arg);
        }
    }
    if !replaced_prompt {
        final_args.push(prompt);
    }
    final_args
}

fn validate_agent_program(program: &str) -> Result<(), AppError> {
    if program.trim().is_empty() {
        return Err(AppError::Io("Agent command is empty".into()));
    }
    Ok(())
}

fn resolve_agent_working_directory(
    workspace: &Path,
    cwd: Option<String>,
) -> Result<PathBuf, AppError> {
    let Some(cwd) = cwd
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    else {
        return Ok(workspace.to_path_buf());
    };

    if cwd.eq_ignore_ascii_case("vault") || cwd.eq_ignore_ascii_case("vault root") {
        return Ok(workspace.to_path_buf());
    }

    let path = PathBuf::from(&cwd);
    let resolved = if path.is_absolute() {
        path
    } else {
        workspace.join(path)
    };

    if !resolved.is_dir() {
        return Err(AppError::Io(format!(
            "Agent working directory does not exist: {}",
            resolved.to_string_lossy()
        )));
    }

    Ok(resolved)
}

fn run_agent_program(
    workspace: PathBuf,
    program: String,
    args: Vec<String>,
    prompt: String,
) -> Result<CommandOutput, AppError> {
    validate_agent_program(&program)?;

    let output = Command::new(program)
        .args(build_agent_args(args, prompt))
        .current_dir(workspace)
        .output()
        .map_err(|e| AppError::Io(e.to_string()))?;

    Ok(CommandOutput {
        status: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

fn default_shell() -> String {
    std::env::var("SHELL")
        .ok()
        .filter(|shell| !shell.trim().is_empty())
        .unwrap_or_else(|| {
            #[cfg(target_os = "windows")]
            {
                "cmd.exe".to_string()
            }
            #[cfg(not(target_os = "windows"))]
            {
                "/bin/zsh".to_string()
            }
        })
}

fn spawn_reader(
    app: tauri::AppHandle,
    label: String,
    id: String,
    mut reader: impl Read + Send + 'static,
) {
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app.emit_to(
                        &label,
                        "terminal:data",
                        TerminalDataEvent {
                            id: id.clone(),
                            stream: "stdout".to_string(),
                            data,
                        },
                    );
                }
                Err(error) => {
                    let _ = app.emit_to(
                        &label,
                        "terminal:data",
                        TerminalDataEvent {
                            id: id.clone(),
                            stream: "stderr".to_string(),
                            data: format!("\n[terminal read failed: {error}]\n"),
                        },
                    );
                    break;
                }
            }
        }

        let _ = app.emit_to(
            &label,
            "terminal:data",
            TerminalDataEvent {
                id,
                stream: "exit".to_string(),
                data: "\n[terminal exited]\n".to_string(),
            },
        );
    });
}

fn spawn_agent_reader(
    app: tauri::AppHandle,
    label: String,
    id: String,
    stream: &'static str,
    mut reader: impl Read + Send + 'static,
) {
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let _ = app.emit_to(
                        &label,
                        "agent:data",
                        AgentDataEvent {
                            id: id.clone(),
                            stream: stream.to_string(),
                            data: String::from_utf8_lossy(&buf[..n]).to_string(),
                            status: None,
                        },
                    );
                }
                Err(error) => {
                    let _ = app.emit_to(
                        &label,
                        "agent:data",
                        AgentDataEvent {
                            id: id.clone(),
                            stream: "stderr".to_string(),
                            data: format!("\n[agent read failed: {error}]\n"),
                            status: None,
                        },
                    );
                    break;
                }
            }
        }
    });
}

fn spawn_agent_waiter(
    app: tauri::AppHandle,
    label: String,
    id: String,
    child: Arc<parking_lot::Mutex<Child>>,
) {
    std::thread::spawn(move || loop {
        let status = {
            let mut child = child.lock();
            match child.try_wait() {
                Ok(Some(status)) => Some(status.code().unwrap_or(-1)),
                Ok(None) => None,
                Err(_) => Some(-1),
            }
        };

        if let Some(status) = status {
            agents().lock().remove(&id);
            let _ = app.emit_to(
                &label,
                "agent:data",
                AgentDataEvent {
                    id,
                    stream: "exit".to_string(),
                    data: String::new(),
                    status: Some(status),
                },
            );
            break;
        }

        std::thread::sleep(Duration::from_millis(120));
    });
}

fn cleanup_window_terminals(label: &str) {
    let ids: Vec<String> = terminals()
        .lock()
        .iter()
        .filter_map(|(id, session)| {
            if session.label == label {
                Some(id.clone())
            } else {
                None
            }
        })
        .collect();

    for id in ids {
        if let Some(mut session) = terminals().lock().remove(&id) {
            let _ = session.child.kill();
        }
    }
}

fn cleanup_window_agents(label: &str) {
    let ids: Vec<String> = agents()
        .lock()
        .iter()
        .filter_map(|(id, session)| {
            if session.label == label {
                Some(id.clone())
            } else {
                None
            }
        })
        .collect();

    for id in ids {
        if let Some(session) = agents().lock().remove(&id) {
            let _ = session.child.lock().kill();
        }
    }
}

pub fn close_window_sessions(label: &str) {
    cleanup_window_terminals(label);
    cleanup_window_agents(label);
}

#[tauri::command]
pub async fn git_status(
    webview: tauri::Webview,
    app: tauri::AppHandle,
) -> Result<CommandOutput, AppError> {
    let workspace = current_workspace(&webview, &app)?;
    blocking(move || run_program(workspace, "git", &["status", "--short", "--branch"])).await
}

#[tauri::command]
pub async fn git_init(
    webview: tauri::Webview,
    app: tauri::AppHandle,
) -> Result<CommandOutput, AppError> {
    let workspace = current_workspace(&webview, &app)?;
    blocking(move || run_program(workspace, "git", &["init"])).await
}

#[tauri::command]
pub async fn git_remotes(
    webview: tauri::Webview,
    app: tauri::AppHandle,
) -> Result<CommandOutput, AppError> {
    let workspace = current_workspace(&webview, &app)?;
    blocking(move || run_program(workspace, "git", &["remote", "-v"])).await
}

#[tauri::command]
pub async fn git_add_remote(
    name: String,
    url: String,
    webview: tauri::Webview,
    app: tauri::AppHandle,
) -> Result<CommandOutput, AppError> {
    let workspace = current_workspace(&webview, &app)?;
    blocking(move || {
        let remote_name = name.trim();
        let remote_url = url.trim();
        if remote_name.is_empty() {
            return Err(AppError::Io("Remote name is empty".into()));
        }
        if remote_url.is_empty() {
            return Err(AppError::Io("Remote URL is empty".into()));
        }
        run_program_owned(
            workspace,
            "git",
            vec![
                "remote".to_string(),
                "add".to_string(),
                remote_name.to_string(),
                remote_url.to_string(),
            ],
        )
    })
    .await
}

#[tauri::command]
pub async fn git_diff(
    path: Option<String>,
    webview: tauri::Webview,
    app: tauri::AppHandle,
) -> Result<CommandOutput, AppError> {
    let workspace = current_workspace(&webview, &app)?;
    blocking(move || {
        let clean_path = path.map(|p| p.trim().to_string()).filter(|p| !p.is_empty());
        let mut unstaged_args = vec!["diff".to_string(), "--".to_string()];
        let mut staged_args = vec!["diff".to_string(), "--cached".to_string(), "--".to_string()];
        if let Some(path) = clean_path {
            unstaged_args.push(path.clone());
            staged_args.push(path);
        }

        let staged = run_program_owned(workspace.clone(), "git", staged_args)?;
        let unstaged = run_program_owned(workspace, "git", unstaged_args)?;
        if staged.status != 0 {
            return Ok(staged);
        }
        if unstaged.status != 0 {
            return Ok(unstaged);
        }

        let mut sections = Vec::new();
        if !staged.stdout.trim().is_empty() {
            sections.push(format!("Staged changes\n\n{}", staged.stdout.trim_end()));
        }
        if !unstaged.stdout.trim().is_empty() {
            sections.push(format!(
                "Unstaged changes\n\n{}",
                unstaged.stdout.trim_end()
            ));
        }

        Ok(CommandOutput {
            status: 0,
            stdout: sections.join("\n\n"),
            stderr: [staged.stderr, unstaged.stderr]
                .into_iter()
                .filter(|text| !text.trim().is_empty())
                .collect::<Vec<_>>()
                .join("\n"),
        })
    })
    .await
}

#[tauri::command]
pub async fn git_pull(
    webview: tauri::Webview,
    app: tauri::AppHandle,
) -> Result<CommandOutput, AppError> {
    let workspace = current_workspace(&webview, &app)?;
    blocking(move || run_program(workspace, "git", &["pull", "--ff-only"])).await
}

#[tauri::command]
pub async fn git_push(
    webview: tauri::Webview,
    app: tauri::AppHandle,
) -> Result<CommandOutput, AppError> {
    let workspace = current_workspace(&webview, &app)?;
    blocking(move || run_program(workspace, "git", &["push"])).await
}

#[tauri::command]
pub async fn git_commit_all(
    message: String,
    webview: tauri::Webview,
    app: tauri::AppHandle,
) -> Result<CommandOutput, AppError> {
    let workspace = current_workspace(&webview, &app)?;
    blocking(move || {
        let add = run_program(workspace.clone(), "git", &["add", "-A"])?;
        if add.status != 0 {
            return Ok(add);
        }
        run_program(workspace, "git", &["commit", "-m", &message])
    })
    .await
}

#[tauri::command]
pub async fn run_agent_prompt(
    program: String,
    args: Vec<String>,
    prompt: String,
    webview: tauri::Webview,
    app: tauri::AppHandle,
) -> Result<CommandOutput, AppError> {
    let workspace = current_workspace(&webview, &app)?;
    blocking(move || run_agent_program(workspace, program, args, prompt)).await
}

#[tauri::command]
pub async fn agent_start(
    id: String,
    program: String,
    args: Vec<String>,
    prompt: String,
    cwd: Option<String>,
    webview: tauri::Webview,
    app: tauri::AppHandle,
) -> Result<AgentStartResult, AppError> {
    let workspace = current_workspace(&webview, &app)?;
    let working_directory = resolve_agent_working_directory(&workspace, cwd)?;
    let label = webview.label().to_string();
    let app_for_spawn = app.clone();
    blocking(move || {
        validate_agent_program(&program)?;
        if agents().lock().contains_key(&id) {
            return Err(AppError::AlreadyExists(format!("agent session {id}")));
        }

        let mut child = Command::new(program)
            .args(build_agent_args(args, prompt))
            .current_dir(working_directory)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| AppError::Io(e.to_string()))?;

        if let Some(stdout) = child.stdout.take() {
            spawn_agent_reader(
                app_for_spawn.clone(),
                label.clone(),
                id.clone(),
                "stdout",
                stdout,
            );
        }
        if let Some(stderr) = child.stderr.take() {
            spawn_agent_reader(
                app_for_spawn.clone(),
                label.clone(),
                id.clone(),
                "stderr",
                stderr,
            );
        }

        let child = Arc::new(parking_lot::Mutex::new(child));
        agents().lock().insert(
            id.clone(),
            AgentSession {
                label: label.clone(),
                child: Arc::clone(&child),
            },
        );
        spawn_agent_waiter(app_for_spawn, label, id.clone(), child);

        Ok(AgentStartResult { id })
    })
    .await
}

#[tauri::command]
pub async fn agent_stop(id: String) -> Result<(), AppError> {
    blocking(move || {
        if let Some(session) = agents().lock().remove(&id) {
            let _ = session.child.lock().kill();
        }
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn terminal_start(
    cols: u16,
    rows: u16,
    webview: tauri::Webview,
    app: tauri::AppHandle,
) -> Result<TerminalStartResult, AppError> {
    let workspace = current_workspace(&webview, &app)?;
    let label = webview.label().to_string();
    let app_for_readers = app.clone();
    blocking(move || {
        let id = uuid::Uuid::new_v4().simple().to_string();
        let shell = default_shell();
        let pty_system = portable_pty::native_pty_system();
        let pair = pty_system
            .openpty(portable_pty::PtySize {
                rows: rows.clamp(8, 200),
                cols: cols.clamp(20, 400),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| AppError::Io(e.to_string()))?;

        let mut command = portable_pty::CommandBuilder::new(&shell);
        #[cfg(target_os = "windows")]
        command.arg("/Q");
        #[cfg(not(target_os = "windows"))]
        command.arg("-i");
        command.cwd(workspace.clone());
        command.env("TERM", "xterm-256color");
        command.env("CLICOLOR", "1");
        command.env("FORCE_COLOR", "1");

        let child = pair
            .slave
            .spawn_command(command)
            .map_err(|e| AppError::Io(e.to_string()))?;
        drop(pair.slave);

        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| AppError::Io(e.to_string()))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|e| AppError::Io(e.to_string()))?;

        spawn_reader(app_for_readers, label.clone(), id.clone(), reader);

        terminals().lock().insert(
            id.clone(),
            TerminalSession {
                label,
                master: pair.master,
                child,
                writer,
            },
        );

        Ok(TerminalStartResult {
            id,
            cwd: workspace.to_string_lossy().to_string(),
            shell,
        })
    })
    .await
}

#[tauri::command]
pub async fn terminal_write(id: String, data: String) -> Result<(), AppError> {
    blocking(move || {
        let mut guard = terminals().lock();
        let session = guard
            .get_mut(&id)
            .ok_or_else(|| AppError::NotFound(format!("terminal session {id}")))?;
        session
            .writer
            .write_all(data.as_bytes())
            .map_err(|e| AppError::Io(e.to_string()))?;
        session
            .writer
            .flush()
            .map_err(|e| AppError::Io(e.to_string()))?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn terminal_resize(id: String, cols: u16, rows: u16) -> Result<(), AppError> {
    blocking(move || {
        let mut guard = terminals().lock();
        let session = guard
            .get_mut(&id)
            .ok_or_else(|| AppError::NotFound(format!("terminal session {id}")))?;
        session
            .master
            .resize(portable_pty::PtySize {
                rows: rows.clamp(8, 200),
                cols: cols.clamp(20, 400),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| AppError::Io(e.to_string()))?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn terminal_stop(id: String) -> Result<(), AppError> {
    blocking(move || {
        if let Some(mut session) = terminals().lock().remove(&id) {
            let _ = session.child.kill();
        }
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn open_workspace_terminal(
    webview: tauri::Webview,
    app: tauri::AppHandle,
) -> Result<(), AppError> {
    let workspace = current_workspace(&webview, &app)?;
    blocking(move || {
        #[cfg(target_os = "macos")]
        {
            Command::new("open")
                .arg("-a")
                .arg("Terminal")
                .arg(&workspace)
                .spawn()
                .map_err(|e| AppError::Io(e.to_string()))?;
        }

        #[cfg(target_os = "windows")]
        {
            Command::new("cmd")
                .args(["/C", "start", "cmd"])
                .current_dir(&workspace)
                .spawn()
                .map_err(|e| AppError::Io(e.to_string()))?;
        }

        #[cfg(all(unix, not(target_os = "macos")))]
        {
            Command::new("x-terminal-emulator")
                .current_dir(&workspace)
                .spawn()
                .map_err(|e| AppError::Io(e.to_string()))?;
        }

        Ok(())
    })
    .await
}
