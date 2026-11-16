#![windows_subsystem = "windows"]

use std::env;
use std::ffi::c_void;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};
use std::thread;
use std::time::Duration;

use tao::{
    dpi::LogicalSize,
    event::{Event, WindowEvent},
    event_loop::{ControlFlow, EventLoop},
    platform::windows::WindowExtWindows,
    window::WindowBuilder,
};
use wry::{WebContext, WebViewBuilder};

type HWND = *mut c_void;
type BOOL = i32;

const SW_HIDE: i32 = 0;
const SW_SHOW: i32 = 5;
const SW_MINIMIZE: i32 = 6;
const SW_RESTORE: i32 = 9;
const VK_ESCAPE: i32 = 0x1B;
const VK_Q: i32 = 0x51;
const VK_MENU: i32 = 0x12; // Alt key

#[link(name = "user32")]
extern "system" {
    fn ShowWindow(hWnd: HWND, nCmdShow: i32) -> BOOL;
    fn SetForegroundWindow(hWnd: HWND) -> BOOL;
    fn GetAsyncKeyState(vKey: i32) -> i16;
    fn GetForegroundWindow() -> HWND;
}

static APP_HWND: AtomicIsize = AtomicIsize::new(0);
static IS_HIDDEN: AtomicBool = AtomicBool::new(false);
static IS_RUNNING: AtomicBool = AtomicBool::new(true);

fn toggle_boss_key() {
    let hwnd = APP_HWND.load(Ordering::SeqCst) as HWND;
    if hwnd.is_null() {
        return;
    }
    unsafe {
        let hidden = IS_HIDDEN.load(Ordering::SeqCst);
        if !hidden {
            ShowWindow(hwnd, SW_HIDE);
            IS_HIDDEN.store(true, Ordering::SeqCst);
        } else {
            ShowWindow(hwnd, SW_SHOW);
            ShowWindow(hwnd, SW_RESTORE);
            SetForegroundWindow(hwnd);
            IS_HIDDEN.store(false, Ordering::SeqCst);
        }
    }
}

fn main() {
    let mut target_url = String::from("https://destinations-lay-transcript-southeast.trycloudflare.com/app/");

    // Allow override via cli argument or local server.txt
    let args: Vec<String> = env::args().collect();
    if args.len() > 1 && args[1].starts_with("http") {
        target_url = args[1].clone();
    } else if let Ok(exe_path) = env::current_exe() {
        if let Some(dir) = exe_path.parent() {
            let srv_file = dir.join("server.txt");
            if let Ok(content) = std::fs::read_to_string(srv_file) {
                let trimmed = content.trim();
                if !trimmed.is_empty() {
                    target_url = trimmed.to_string();
                }
            }
        }
    }

    let event_loop = EventLoop::new();
    let window = WindowBuilder::new()
        .with_title("JOSJIS IT TEAM - Stealth Native")
        .with_inner_size(LogicalSize::new(1020.0, 680.0))
        .with_decorations(true)
        .build(&event_loop)
        .expect("Failed to create native desktop window");

    let hwnd = window.hwnd() as HWND;
    APP_HWND.store(hwnd as isize, Ordering::SeqCst);

    // Isolated persistent storage for native client
    let local_data = env::var("LOCALAPPDATA").unwrap_or_else(|_| ".".to_string());
    let data_dir = PathBuf::from(local_data).join("JosjisStealthNativeProfile");
    let mut web_context = WebContext::new(Some(data_dir));

    let _webview = WebViewBuilder::new_with_web_context(&mut web_context)
        .with_url(&target_url)
        .with_devtools(false)
        .build(&window)
        .expect("Failed to initialize embedded native WebView2");

    // Stealth Hotkey Background Monitor (Boss Key Alt+Q & Panic Key Esc)
    thread::spawn(|| {
        let mut boss_key_debounced = false;

        while IS_RUNNING.load(Ordering::SeqCst) {
            thread::sleep(Duration::from_millis(60));

            let hwnd = APP_HWND.load(Ordering::SeqCst) as HWND;
            if hwnd.is_null() {
                continue;
            }

            // 1. Global Boss Key Hotkey: Alt + Q (Instant Vanish)
            unsafe {
                let alt_pressed = (GetAsyncKeyState(VK_MENU) as i32 & 0x8000) != 0;
                let q_pressed = (GetAsyncKeyState(VK_Q) as i32 & 0x8000) != 0;

                if alt_pressed && q_pressed {
                    if !boss_key_debounced {
                        boss_key_debounced = true;
                        toggle_boss_key();
                    }
                } else {
                    boss_key_debounced = false;
                }
            }

            // 2. Panic Key: Esc (Minimize window immediately when active)
            if !IS_HIDDEN.load(Ordering::SeqCst) {
                unsafe {
                    let esc = GetAsyncKeyState(VK_ESCAPE);
                    if (esc as i32 & 0x8000) != 0 {
                        let fg = GetForegroundWindow();
                        if fg == hwnd {
                            ShowWindow(hwnd, SW_MINIMIZE);
                            thread::sleep(Duration::from_millis(300));
                        }
                    }
                }
            }
        }
    });

    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;

        match event {
            Event::WindowEvent {
                event: WindowEvent::CloseRequested,
                ..
            } => {
                IS_RUNNING.store(false, Ordering::SeqCst);
                *control_flow = ControlFlow::Exit;
            }
            _ => (),
        }
    });
}
