// Tauri 应用入口（lib）
// 当前应用使用 main.rs 作为入口，此文件保留为 Tauri 默认结构

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
