#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Tauri 启动入口，保持默认配置即可
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("failed to run tauri application");
}
