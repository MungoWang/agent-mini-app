use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use tauri::Manager;

struct HostState {
  child: Mutex<Option<Child>>,
  host_url: Mutex<Option<String>>,
}

fn default_runtime_root() -> PathBuf {
  std::env::var_os("HOME")
    .map(PathBuf::from)
    .unwrap_or_else(|| PathBuf::from("."))
    .join(".monkey-mini-app")
}

fn repo_shell_cli() -> PathBuf {
  PathBuf::from(env!("CARGO_MANIFEST_DIR"))
    .join("../../..")
    .join("packages/shell/dist/cli.js")
}

fn spawn_host_daemon(runtime_root: &PathBuf) -> Result<(Child, String), String> {
  let cli = repo_shell_cli();
  if !cli.exists() {
    return Err(format!(
      "shell CLI missing at {} — run: pnpm --filter @monkey-mini-app/shell build",
      cli.display()
    ));
  }
  let mut child = Command::new("node")
    .arg(&cli)
    .arg("--runtime-root")
    .arg(runtime_root)
    .arg("--demo")
    .arg("--port")
    .arg("17880")
    .stdout(Stdio::piped())
    .stderr(Stdio::inherit())
    .spawn()
    .map_err(|e| format!("spawn mma-shell-host: {e}"))?;

  let stdout = child.stdout.take().ok_or("no stdout")?;
  let url_slot: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
  let url_slot_thread = Arc::clone(&url_slot);
  thread::spawn(move || {
    let reader = BufReader::new(stdout);
    for line in reader.lines().flatten() {
      eprintln!("[mma-shell-host] {line}");
      if let Some(rest) = line.strip_prefix("MMA_HOST_URL=") {
        if let Ok(mut g) = url_slot_thread.lock() {
          *g = Some(rest.trim().to_string());
        }
      }
    }
  });

  let deadline = Instant::now() + Duration::from_secs(15);
  let host_url = loop {
    if let Ok(g) = url_slot.lock() {
      if let Some(url) = g.clone() {
        break url;
      }
    }
    if Instant::now() > deadline {
      break String::from("http://127.0.0.1:17880");
    }
    thread::sleep(Duration::from_millis(50));
  };
  Ok((child, host_url))
}

#[tauri::command]
fn get_host_url(state: tauri::State<'_, HostState>) -> Result<String, String> {
  state
    .host_url
    .lock()
    .map_err(|e| e.to_string())?
    .clone()
    .ok_or_else(|| "host url not ready".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .manage(HostState {
      child: Mutex::new(None),
      host_url: Mutex::new(None),
    })
    .setup(|app| {
      let runtime_root = default_runtime_root();
      let _ = std::fs::create_dir_all(&runtime_root);
      match spawn_host_daemon(&runtime_root) {
        Ok((child, url)) => {
          let state = app.state::<HostState>();
          *state.child.lock().unwrap() = Some(child);
          *state.host_url.lock().unwrap() = Some(url);
        }
        Err(err) => {
          eprintln!("[mma-shell] failed to start host: {err}");
        }
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![get_host_url])
    .on_window_event(|window, event| {
      if let tauri::WindowEvent::CloseRequested { .. } = event {
        let app = window.app_handle().clone();
        let state = app.state::<HostState>();
        let mut child_opt = state.child.lock().ok().and_then(|mut g| g.take());
        if let Some(mut child) = child_opt.take() {
          let _ = child.kill();
        }
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
