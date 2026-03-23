// 在 Windows 发布版本中防止弹出额外的控制台窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::thread;
use tauri::{AppHandle, Emitter, Manager, Window};

fn resolve_backend_script_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    // Packaged app resource location (expected for release bundle).
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("backend").join("main.py"));
    }

    // Development fallback: source tree relative to src-tauri crate.
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    candidates.push(manifest_dir.join("..").join("backend").join("main.py"));

    // Development fallback: next to executable (helps custom runs).
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            candidates.push(exe_dir.join("backend").join("main.py"));
        }
    }

    for candidate in &candidates {
        if candidate.exists() {
            return Ok(candidate.clone());
        }
    }

    let tried = candidates
        .iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect::<Vec<_>>()
        .join(" | ");
    Err(format!("Python script not found. Tried: {tried}"))
}

fn resolve_python_executable(explicit_python: Option<String>) -> String {
    if let Some(p) = explicit_python {
        let trimmed = p.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }

    // Highest priority: explicit override for this app.
    if let Ok(p) = std::env::var("CONDATOOL_PYTHON") {
        let trimmed = p.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }

    // Activated conda environments usually expose this variable.
    if let Ok(p) = std::env::var("CONDA_PYTHON_EXE") {
        let trimmed = p.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }

    "python".to_string()
}

#[tauri::command]
fn run_python_dev(
    window: Window,
    args: Vec<String>,
    python_executable: Option<String>,
) -> Result<(), String> {
    let script_path = resolve_backend_script_path(&window.app_handle())?;
    let python_executable = resolve_python_executable(python_executable);

    let mut full_args = vec![script_path.to_string_lossy().to_string()];
    full_args.extend(args);

    // 使用 script_path 所在目录作为 cwd
    let cwd = script_path
        .parent()
        .ok_or("Failed to get parent directory of script")?;

    let mut child = Command::new(&python_executable)
        .args(full_args)
        .current_dir(cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("spawn python failed ({python_executable}): {e}"))?;

    // stdout
    if let Some(stdout) = child.stdout.take() {
        let window_clone = window.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line) = line {
                    let _ = window_clone.emit("backend://stdout", line);
                }
            }
        });
    }

    // stderr
    if let Some(stderr) = child.stderr.take() {
        let window_clone = window.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(line) = line {
                    let _ = window_clone.emit("backend://stderr", line);
                }
            }
        });
    }

    // 等待子进程结束，发出 terminated 事件
    let window_clone = window.clone();
    thread::spawn(move || {
        let status = child.wait().ok().and_then(|s| s.code());
        let code_str = status
            .map(|c| c.to_string())
            .unwrap_or_else(|| "unknown".into());
        let _ = window_clone.emit("backend://terminated", code_str);
    });

    Ok(())
}

// 应用入口
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![run_python_dev])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
