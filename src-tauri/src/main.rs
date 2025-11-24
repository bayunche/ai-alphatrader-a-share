#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tauri::api::process::{Command, CommandChild};
use tauri::{
    CustomMenuItem, Manager, RunEvent, SystemTray, SystemTrayEvent, SystemTrayMenu, WindowEvent,
};

#[derive(Default)]
struct BackendState(Arc<Mutex<Option<CommandChild>>>);

impl BackendState {
    fn set_child(&self, child: CommandChild) {
        if let Ok(mut guard) = self.0.lock() {
            *guard = Some(child);
        }
    }

    fn kill(&self) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some(child) = guard.take() {
                let _ = child.kill();
            }
        }
    }
}

fn main() {
    let show = CustomMenuItem::new("show".to_string(), "显示主窗口");
    let quit = CustomMenuItem::new("quit".to_string(), "退出");
    let tray_menu = SystemTrayMenu::new().add_item(show).add_item(quit);
    let system_tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .manage(BackendState::default())
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::MenuItemClick { id, .. } => {
                if id.as_str() == "show" {
                    if let Some(window) = app.get_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                } else if id.as_str() == "quit" {
                    // 托盘退出时立即杀掉 sidecar，再退出应用
                    let state = app.state::<BackendState>();
                    state.kill();
                    app.exit(0);
                }
            }
            SystemTrayEvent::LeftClick { .. } => {
                if let Some(window) = app.get_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            _ => {}
        })
        .setup(|app| {
            let data_dir = app
                .path_resolver()
                .app_local_data_dir()
                .ok_or("missing app data dir")?;
            std::fs::create_dir_all(&data_dir)?;

            let state = app.state::<BackendState>().inner();
            let mut envs = HashMap::new();
            envs.insert("DATA_DIR".to_string(), data_dir.to_string_lossy().to_string());
            envs.insert("PORT".to_string(), "3001".to_string());

            let (_rx, child) = Command::new_sidecar("server")
                .map_err(|e| format!("failed to setup sidecar: {e}"))?
                .envs(envs)
                .spawn()
                .map_err(|e| format!("failed to spawn sidecar: {e}"))?;

            state.set_child(child);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri app")
        .run(|app_handle, event| {
            match event {
                RunEvent::WindowEvent { label, event, .. } => {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        if let Some(window) = app_handle.get_window(label.as_str()) {
                            let _ = window.hide();
                        }
                        api.prevent_close(); // 关闭时最小化到托盘
                    }
                }
                RunEvent::ExitRequested { .. } | RunEvent::Exit { .. } => {
                    let state = app_handle.state::<BackendState>();
                    state.kill();
                }
                _ => {}
            }
        });
}
