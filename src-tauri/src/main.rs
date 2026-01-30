#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tauri::api::process::{Command, CommandChild};
use tauri::{
    CustomMenuItem, Manager, RunEvent, SystemTray, SystemTrayEvent, SystemTrayMenu, WindowEvent,
};

#[derive(Default)]
struct BackendState(Arc<Mutex<Option<CommandChild>>>);
#[derive(Default)]
struct AkshareState(Arc<Mutex<Option<CommandChild>>>);

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
impl AkshareState {
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
        .manage(AkshareState::default())
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
                    let ak = app.state::<AkshareState>();
                    ak.kill();
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
            let ak_state = app.state::<AkshareState>().inner();
            let mut envs = HashMap::new();
            envs.insert("DATA_DIR".to_string(), data_dir.to_string_lossy().to_string());
            envs.insert("PORT".to_string(), "38211".to_string());
            envs.insert("AKSHARE_BASE".to_string(), "http://127.0.0.1:18118".to_string());

            // 1. Akshare Sidecar (Non-Fatal Warning)
            let ak_started = match Command::new_sidecar("akshare_service") {
                Ok(cmd) => {
                    match cmd
                        .envs(HashMap::from([("AK_PORT".to_string(), "18118".to_string())]))
                        .spawn()
                    {
                        Ok((_rx2, ak_child)) => {
                            ak_state.set_child(ak_child);
                            true
                        }
                        Err(e) => {
                            let msg = format!("Failed to spawn akshare_service: {}\nSome data features may be unavailable.", e);
                            tauri::api::dialog::blocking::message(None::<&tauri::Window>, "Warning: Helper Service Failed", &msg);
                            false
                        }
                    }
                }
                Err(e) => {
                    let msg = format!("Failed to find akshare_service binary: {}\nSome data features may be unavailable.", e);
                    tauri::api::dialog::blocking::message(None::<&tauri::Window>, "Warning: Helper Service Missing", &msg);
                    false
                }
            };
            
            if !ak_started {
                println!("Akshare sidecar failed to start.");
            }

            // 2. Server Sidecar (Node.js via Sidecar)
            // Resolve resource path for server script
            let resource_path = app.path_resolver()
                .resolve_resource("resources/server/index.js")
                .expect("failed to resolve resource");
            
            let resource_path_str = resource_path.to_string_lossy().to_string();
            println!("Server script path: {}", resource_path_str);

            // Resolve node_modules path for NODE_PATH
            let node_modules_path = app.path_resolver()
                .resolve_resource("resources/server/node_modules")
                .expect("failed to resolve node_modules");
            let node_modules_str = node_modules_path.to_string_lossy().to_string();
            println!("NODE_PATH: {}", node_modules_str);
            
            // Add NODE_PATH to environment
            envs.insert("NODE_PATH".to_string(), node_modules_str);

            // Spawn 'node' sidecar with script path as argument
            let server_cmd = match Command::new_sidecar("node") {
                Ok(cmd) => cmd,
                Err(e) => {
                    let msg = format!("CRITICAL: Failed to find node binary!\nError: {}\n\nPlease try reinstalling the application.", e);
                    tauri::api::dialog::blocking::message(None::<&tauri::Window>, "Startup Failed", &msg);
                    std::process::exit(1);
                }
            };
            
            // Pass the script path and environment variables to Node
            match server_cmd.args(&[resource_path_str]).envs(envs).spawn() {
                Ok((_rx, child)) => {
                    println!("Node Server started successfully.");
                    state.set_child(child);
                }
                Err(e) => {
                    let msg = format!("CRITICAL: Failed to launch backend server!\nError: {}\n\nCheck logs or contact support.", e);
                    tauri::api::dialog::blocking::message(None::<&tauri::Window>, "Startup Failed", &msg);
                    std::process::exit(1);
                }
            }

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
                    let ak = app_handle.state::<AkshareState>();
                    ak.kill();
                }
                _ => {}
            }
        });
}
