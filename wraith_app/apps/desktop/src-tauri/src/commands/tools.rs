use crate::error::AppError;
use crate::state::AppState;
use serde::Serialize;
use std::collections::HashMap;
use std::ffi::OsString;
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

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .filter(|home| !home.is_empty())
        .map(PathBuf::from)
}

fn expand_tilde_path(input: &str) -> PathBuf {
    if input == "~" {
        return home_dir().unwrap_or_else(|| PathBuf::from(input));
    }

    if let Some(rest) = input.strip_prefix("~/") {
        if let Some(home) = home_dir() {
            return home.join(rest);
        }
    }

    PathBuf::from(input)
}

fn has_path_separator(program: &str) -> bool {
    program.contains('/') || program.contains('\\')
}

fn is_executable_file(path: &Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        std::fs::metadata(path)
            .map(|metadata| metadata.is_file() && metadata.permissions().mode() & 0o111 != 0)
            .unwrap_or(false)
    }

    #[cfg(windows)]
    {
        path.is_file()
            && path
                .extension()
                .and_then(|extension| extension.to_str())
                .is_some_and(|extension| {
                    ["bat", "cmd", "com", "exe"]
                        .iter()
                        .any(|expected| extension.eq_ignore_ascii_case(expected))
                })
    }

    #[cfg(all(not(unix), not(windows)))]
    {
        path.is_file()
    }
}

fn first_existing_executable_path(stdout: &str) -> Option<PathBuf> {
    stdout.lines().find_map(|line| {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return None;
        }
        let candidate = PathBuf::from(trimmed);
        is_executable_file(&candidate).then_some(candidate)
    })
}

fn path_from_successful_output(output: &std::process::Output) -> Option<PathBuf> {
    if output.status.success() {
        first_existing_executable_path(&String::from_utf8_lossy(&output.stdout))
    } else {
        None
    }
}

fn path_lookup_command() -> &'static str {
    if cfg!(windows) {
        "where"
    } else {
        "which"
    }
}

fn find_agent_program_on_path(program: &str) -> Option<PathBuf> {
    Command::new(path_lookup_command())
        .arg(program)
        .output()
        .ok()
        .and_then(|output| path_from_successful_output(&output))
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

#[cfg(not(windows))]
fn user_shell_candidates() -> Vec<PathBuf> {
    let mut shells = Vec::new();
    if let Some(shell) = std::env::var_os("SHELL") {
        if !shell.is_empty() {
            shells.push(PathBuf::from(shell));
        }
    }
    shells.push(PathBuf::from("/bin/zsh"));
    shells.push(PathBuf::from("/bin/bash"));
    shells
}

#[cfg(not(windows))]
fn find_agent_program_in_user_shell(program: &str) -> Option<PathBuf> {
    user_shell_candidates()
        .into_iter()
        .filter(|shell| shell.exists())
        .find_map(|shell| {
            Command::new(shell)
                .arg("-lc")
                .arg(format!("command -v {}", shell_quote(program)))
                .output()
                .ok()
                .and_then(|output| path_from_successful_output(&output))
        })
}

#[cfg(windows)]
fn find_agent_program_in_user_shell(_program: &str) -> Option<PathBuf> {
    None
}

fn push_unique_path(paths: &mut Vec<PathBuf>, candidate: PathBuf) {
    if candidate.as_os_str().is_empty() {
        return;
    }
    if paths.iter().any(|path| path == &candidate) {
        return;
    }
    paths.push(candidate);
}

fn nvm_binary_candidates_for_home(home: &Path, program: &str) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(home.join(".nvm/versions/node")) else {
        return Vec::new();
    };

    let mut candidates = entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_dir())
        .map(|path| path.join("bin").join(program))
        .collect::<Vec<_>>();
    candidates.sort();
    candidates
}

fn agent_path_candidates(binary: &Path) -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Some(parent) = binary
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        candidates.push(parent.to_path_buf());
    }

    if let Some(home) = home_dir() {
        candidates.extend([
            home.join(".local/bin"),
            home.join(".claude/local"),
            home.join(".codex/bin"),
            home.join(".local/share/mise/shims"),
            home.join(".asdf/shims"),
            home.join(".npm-global/bin"),
            home.join(".npm/bin"),
            home.join(".bun/bin"),
            home.join(".linuxbrew/bin"),
            home.join("AppData/Roaming/npm"),
            home.join("AppData/Local/pnpm"),
            home.join("scoop/shims"),
        ]);
    }

    candidates.extend([
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/usr/local/bin"),
        PathBuf::from("/home/linuxbrew/.linuxbrew/bin"),
    ]);

    candidates
}

fn expanded_agent_path(binary: &Path) -> Option<OsString> {
    let mut paths = std::env::var_os("PATH")
        .map(|path| std::env::split_paths(&path).collect::<Vec<_>>())
        .unwrap_or_default();

    for candidate in agent_path_candidates(binary) {
        push_unique_path(&mut paths, candidate);
    }

    std::env::join_paths(paths).ok()
}

fn configure_agent_command_environment(command: &mut Command, binary: &Path) {
    if let Some(path) = expanded_agent_path(binary) {
        command.env("PATH", path);
    }
}

fn agent_program_names(program: &str) -> Vec<String> {
    #[cfg(windows)]
    {
        let mut names = vec![program.to_string()];
        let lower = program.to_ascii_lowercase();
        if ![".exe", ".cmd", ".bat", ".com"]
            .iter()
            .any(|extension| lower.ends_with(extension))
        {
            names.extend([
                format!("{program}.exe"),
                format!("{program}.cmd"),
                format!("{program}.bat"),
            ]);
        }
        names
    }

    #[cfg(not(windows))]
    {
        vec![program.to_string()]
    }
}

fn agent_program_candidates(program: &str) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    let names = agent_program_names(program);

    if let Some(home) = home_dir() {
        let dirs = [
            home.join(".local/bin"),
            home.join(".claude/local"),
            home.join(".codex/bin"),
            home.join(".local/share/mise/shims"),
            home.join(".asdf/shims"),
            home.join(".npm-global/bin"),
            home.join(".npm/bin"),
            home.join(".bun/bin"),
            home.join(".linuxbrew/bin"),
            home.join("AppData/Roaming/npm"),
            home.join("AppData/Local/pnpm"),
            home.join("scoop/shims"),
        ];

        for dir in dirs {
            for name in &names {
                candidates.push(dir.join(name));
            }
        }

        for nvm_candidate in nvm_binary_candidates_for_home(&home, program) {
            candidates.push(nvm_candidate);
        }
    }

    let system_dirs = [
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/usr/local/bin"),
        PathBuf::from("/home/linuxbrew/.linuxbrew/bin"),
    ];

    for dir in system_dirs {
        for name in &names {
            candidates.push(dir.join(name));
        }
    }

    candidates
}

fn find_executable_agent_candidate(program: &str) -> Result<Option<PathBuf>, AppError> {
    let mut first_unusable_candidate = None;

    for candidate in agent_program_candidates(program) {
        if !candidate.exists() {
            continue;
        }

        if is_executable_file(&candidate) {
            return Ok(Some(candidate));
        }

        if first_unusable_candidate.is_none() {
            first_unusable_candidate = Some(candidate);
        }
    }

    if let Some(candidate) = first_unusable_candidate {
        return Err(AppError::Io(format!(
            "Agent command found at {} but it is not executable. Fix the file permissions or set an absolute executable path in Settings.",
            candidate.display()
        )));
    }

    Ok(None)
}

fn resolve_agent_program(program: &str) -> Result<PathBuf, AppError> {
    validate_agent_program(program)?;

    let program = program.trim();
    if has_path_separator(program) {
        let candidate = expand_tilde_path(program);
        if is_executable_file(&candidate) {
            return Ok(candidate);
        }
        if candidate.exists() {
            return Err(AppError::Io(format!(
                "Agent command is not executable: {}",
                candidate.display()
            )));
        }
        return Err(AppError::Io(format!(
            "Agent command does not exist: {}",
            candidate.display()
        )));
    }

    if let Some(path) = find_agent_program_on_path(program) {
        return Ok(path);
    }

    if let Some(path) = find_agent_program_in_user_shell(program) {
        return Ok(path);
    }

    if let Some(path) = find_executable_agent_candidate(program)? {
        return Ok(path);
    }

    Err(AppError::Io(format!(
        "Agent command not found: {program}. Wraith checked the app PATH, your login shell, Homebrew, npm, mise/asdf, nvm, and common user CLI shim directories. If it works in Terminal, restart Wraith or set an absolute command path in Settings."
    )))
}

fn format_agent_spawn_error(program: &str, error: &std::io::Error) -> AppError {
    if error.kind() == std::io::ErrorKind::NotFound {
        return AppError::Io(format!(
            "Failed to start {program}: the CLI or one of its runtime dependencies was not found. If it was installed with Homebrew or npm, make sure its install directory is available, then restart Wraith. Details: {error}"
        ));
    }

    AppError::Io(format!("Failed to spawn {program}: {error}"))
}

fn run_agent_program(
    workspace: PathBuf,
    program: String,
    args: Vec<String>,
    prompt: String,
) -> Result<CommandOutput, AppError> {
    let program_path = resolve_agent_program(&program)?;

    let mut command = Command::new(&program_path);
    configure_agent_command_environment(&mut command, &program_path);
    let output = command
        .args(build_agent_args(args, prompt))
        .current_dir(workspace)
        .output()
        .map_err(|e| format_agent_spawn_error(&program, &e))?;

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
        let program_path = resolve_agent_program(&program)?;
        if agents().lock().contains_key(&id) {
            return Err(AppError::AlreadyExists(format!("agent session {id}")));
        }

        let mut command = Command::new(&program_path);
        configure_agent_command_environment(&mut command, &program_path);
        let mut child = command
            .args(build_agent_args(args, prompt))
            .current_dir(working_directory)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format_agent_spawn_error(&program, &e))?;

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
