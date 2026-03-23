// 在 Windows 发布版本中防止弹出额外的控制台窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::thread;
use tauri::{AppHandle, Emitter, Manager, Window};

fn resolve_runtime_binary(app: &AppHandle, binary_name: &str) -> Result<PathBuf, String> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    // Packaged app resource location.
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("runtime").join(binary_name));
    }

    // Development fallback: src-tauri/resources/runtime
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    candidates.push(manifest_dir.join("resources").join("runtime").join(binary_name));

    // Development fallback: next to executable.
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            candidates.push(exe_dir.join("runtime").join(binary_name));
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
    Err(format!("runtime missing: {binary_name}. tried: {tried}"))
}

#[tauri::command]
fn run_backend(window: Window, args: Vec<String>) -> Result<(), String> {
    let app = window.app_handle();
    let backend_path = resolve_runtime_binary(&app, "backend.exe")
        .map_err(|e| format!("backend startup failed: {e}"))?;
    let package_manager_path = resolve_runtime_binary(&app, "micromamba.exe")
        .map_err(|e| format!("package manager init failed: {e}"))?;

    let mut full_args = vec![
        "--package-manager".to_string(),
        package_manager_path.to_string_lossy().to_string(),
    ];
    full_args.extend(args);

    let cwd = backend_path
        .parent()
        .ok_or("backend startup failed: invalid backend path")?;

    let mut child = Command::new(&backend_path)
        .args(full_args)
        .current_dir(cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            format!(
                "backend startup failed: spawn {} failed: {e}",
                backend_path.to_string_lossy()
            )
        })?;

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
        .invoke_handler(tauri::generate_handler![run_backend])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
