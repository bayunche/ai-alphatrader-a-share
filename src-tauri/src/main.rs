#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tauri::api::process::{Command, CommandChild};
use tauri::{Manager, RunEvent};

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
    tauri::Builder::default()
        .manage(BackendState::default())
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
            if let RunEvent::ExitRequested { .. } | RunEvent::Exit { .. } = event {
                let state = app_handle.state::<BackendState>();
                state.kill();
            }
        });
}
