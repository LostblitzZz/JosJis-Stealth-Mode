#![windows_subsystem = "windows"]

use std::env;
use std::ffi::c_void;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, AtomicIsize, AtomicU32, Ordering};
use std::thread;
use std::time::Duration;

type HWND = *mut c_void;
type BOOL = i32;

const GWL_EXSTYLE: i32 = -20;
const WS_EX_LAYERED: isize = 0x80000;
const LWA_ALPHA: u32 = 0x2;
const SW_HIDE: i32 = 0;
const SW_SHOW: i32 = 5;
const SW_MINIMIZE: i32 = 6;
const SW_RESTORE: i32 = 9;
const VK_ESCAPE: i32 = 0x1B;
const VK_Q: u32 = 0x51;
const MOD_ALT: u32 = 0x0001;
const WM_HOTKEY: u32 = 0x0312;
const HOTKEY_BOSS_KEY: i32 = 9001;

#[repr(C)]
#[derive(Default, Copy, Clone)]
struct POINT {
    x: i32,
    y: i32,
}

#[repr(C)]
#[derive(Default, Copy, Clone)]
struct RECT {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

#[repr(C)]
struct MSG {
    hwnd: HWND,
    message: u32,
    w_param: usize,
    l_param: isize,
    time: u32,
    pt: POINT,
}

#[link(name = "user32")]
extern "system" {
    fn RegisterHotKey(hWnd: HWND, id: i32, fsModifiers: u32, vk: u32) -> BOOL;
    fn UnregisterHotKey(hWnd: HWND, id: i32) -> BOOL;
    fn GetMessageW(lpMsg: *mut MSG, hWnd: HWND, wMsgFilterMin: u32, wMsgFilterMax: u32) -> BOOL;
    fn TranslateMessage(lpMsg: *const MSG) -> BOOL;
    fn DispatchMessageW(lpMsg: *const MSG) -> isize;
    fn GetCursorPos(lpPoint: *mut POINT) -> BOOL;
    fn GetWindowRect(hWnd: HWND, lpRect: *mut RECT) -> BOOL;
    fn GetWindowLongPtrW(hWnd: HWND, nIndex: i32) -> isize;
    fn SetWindowLongPtrW(hWnd: HWND, nIndex: i32, dwNewLong: isize) -> isize;
    fn SetLayeredWindowAttributes(hwnd: HWND, crKey: u32, bAlpha: u8, dwFlags: u32) -> BOOL;
    fn ShowWindow(hWnd: HWND, nCmdShow: i32) -> BOOL;
    fn SetForegroundWindow(hWnd: HWND) -> BOOL;
    fn GetAsyncKeyState(vKey: i32) -> i16;
    fn GetForegroundWindow() -> HWND;
    fn IsWindowVisible(hWnd: HWND) -> BOOL;
    fn EnumWindows(lpEnumFunc: extern "system" fn(HWND, isize) -> BOOL, lParam: isize) -> BOOL;
    fn GetWindowThreadProcessId(hWnd: HWND, lpdwProcessId: *mut u32) -> u32;
}

static APP_HWND: AtomicIsize = AtomicIsize::new(0);
static APP_PID: AtomicU32 = AtomicU32::new(0);
static IS_HIDDEN: AtomicBool = AtomicBool::new(false);

extern "system" fn enum_windows_callback(hwnd: HWND, _lparam: isize) -> BOOL {
    unsafe {
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == APP_PID.load(Ordering::SeqCst) && IsWindowVisible(hwnd) != 0 {
            APP_HWND.store(hwnd as isize, Ordering::SeqCst);
            return 0; // stop enumeration
        }
        1 // continue
    }
}

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
            SetLayeredWindowAttributes(hwnd, 0, 255, LWA_ALPHA);
            IS_HIDDEN.store(false, Ordering::SeqCst);
        }
    }
}

fn find_browser() -> PathBuf {
    let local = env::var_os("LOCALAPPDATA").map(PathBuf::from);
    let prog = env::var_os("ProgramFiles").map(PathBuf::from);
    let prog_x86 = env::var_os("ProgramFiles(x86)").map(PathBuf::from);

    let mut candidates = Vec::new();

    if let Some(ref p) = prog_x86 {
        candidates.push(p.join("Microsoft").join("Edge").join("Application").join("msedge.exe"));
    }
    if let Some(ref p) = prog {
        candidates.push(p.join("Microsoft").join("Edge").join("Application").join("msedge.exe"));
    }
    if let Some(ref p) = local {
        candidates.push(p.join("Microsoft").join("Edge").join("Application").join("msedge.exe"));
    }
    if let Some(ref p) = prog {
        candidates.push(p.join("Google").join("Chrome").join("Application").join("chrome.exe"));
    }
    if let Some(ref p) = prog_x86 {
        candidates.push(p.join("Google").join("Chrome").join("Application").join("chrome.exe"));
    }
    if let Some(ref p) = local {
        candidates.push(p.join("Google").join("Chrome").join("Application").join("chrome.exe"));
    }

    for c in candidates {
        if c.exists() {
            return c;
        }
    }
    PathBuf::from("msedge.exe")
}

fn main() {
    let mut target_url = String::from("https://destinations-lay-transcript-southeast.trycloudflare.com/app");

    // Optional override via argument or server.txt
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

    let browser = find_browser();
    let local_app_data = env::var("LOCALAPPDATA").unwrap_or_else(|_| String::from("."));
    let profile_dir = Path::new(&local_app_data).join("JosjisRustProfile");

    let child = Command::new(&browser)
        .arg(format!("--app={}", target_url))
        .arg("--window-size=1020,680")
        .arg(format!("--user-data-dir={}", profile_dir.display()))
        .arg("--disable-features=TranslateUI")
        .arg("--disable-extensions")
        .arg("--no-first-run")
        .arg("--no-default-browser-check")
        .spawn();

    let child = match child {
        Ok(c) => c,
        Err(_) => return,
    };

    APP_PID.store(child.id(), Ordering::SeqCst);

    // Register Boss Key Hotkey: Alt + Q
    unsafe {
        RegisterHotKey(std::ptr::null_mut(), HOTKEY_BOSS_KEY, MOD_ALT, VK_Q);
    }

    // Stealth Monitor Thread
    thread::spawn(|| {
        let mut current_alpha: u8 = 255;
        let mut outside_counter = 0;

        loop {
            thread::sleep(Duration::from_millis(45));

            let hwnd = APP_HWND.load(Ordering::SeqCst) as HWND;
            if hwnd.is_null() {
                unsafe {
                    EnumWindows(enum_windows_callback, 0);
                    let new_hwnd = APP_HWND.load(Ordering::SeqCst) as HWND;
                    if !new_hwnd.is_null() {
                        let style = GetWindowLongPtrW(new_hwnd, GWL_EXSTYLE);
                        SetWindowLongPtrW(new_hwnd, GWL_EXSTYLE, style | WS_EX_LAYERED);
                        SetLayeredWindowAttributes(new_hwnd, 0, 255, LWA_ALPHA);
                    }
                }
                continue;
            }

            // 1. Panic Key ([Esc])
            unsafe {
                let esc = GetAsyncKeyState(VK_ESCAPE);
                if (esc as i32 & 0x8000) != 0 {
                    let fg = GetForegroundWindow();
                    if fg == hwnd {
                        ShowWindow(hwnd, SW_MINIMIZE);
                        thread::sleep(Duration::from_millis(300));
                        continue;
                    }
                }
            }

            // 2. Ghost Mode (Auto-Opacity)
            if IS_HIDDEN.load(Ordering::SeqCst) {
                continue;
            }

            let mut pt = POINT::default();
            let mut rect = RECT::default();
            unsafe {
                GetCursorPos(&mut pt);
                GetWindowRect(hwnd, &mut rect);
            }

            let is_inside = pt.x >= rect.left && pt.x <= rect.right && pt.y >= rect.top && pt.y <= rect.bottom;
            let idle_alpha: u8 = 38; // ~15% opacity stealth

            if is_inside {
                outside_counter = 0;
                if current_alpha < 255 {
                    current_alpha = current_alpha.saturating_add(55);
                    unsafe {
                        SetLayeredWindowAttributes(hwnd, 0, current_alpha, LWA_ALPHA);
                    }
                }
            } else {
                outside_counter += 1;
                if outside_counter > 3 {
                    if current_alpha > idle_alpha {
                        current_alpha = current_alpha.saturating_sub(28).max(idle_alpha);
                        unsafe {
                            SetLayeredWindowAttributes(hwnd, 0, current_alpha, LWA_ALPHA);
                        }
                    }
                }
            }
        }
    });

    // Win32 Message Loop
    unsafe {
        let mut msg: MSG = std::mem::zeroed();
        while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
            if msg.message == WM_HOTKEY && msg.w_param == HOTKEY_BOSS_KEY as usize {
                toggle_boss_key();
            }
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
        UnregisterHotKey(std::ptr::null_mut(), HOTKEY_BOSS_KEY);
    }
}
