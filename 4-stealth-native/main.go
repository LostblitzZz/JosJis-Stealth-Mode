package main

import (
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

// Win32 API Constants
const (
	GWL_EXSTYLE     uintptr = 0xFFFFFFEC
	WS_EX_LAYERED   uintptr = 0x80000
	LWA_ALPHA       uintptr = 0x2
	SW_HIDE         = 0
	SW_SHOWNORMAL   = 1
	SW_SHOW         = 5
	SW_MINIMIZE     = 6
	SW_RESTORE      = 9
	VK_ESCAPE       = 0x1B
	VK_Q            = 0x51
	MOD_ALT         = 0x0001
	WM_HOTKEY       = 0x0312
	HOTKEY_BOSS_KEY = 9001
)

type POINT struct {
	X int32
	Y int32
}

type RECT struct {
	Left   int32
	Top    int32
	Right  int32
	Bottom int32
}

type MSG struct {
	Hwnd     syscall.Handle
	Message  uint32
	WParam   uintptr
	LParam   uintptr
	Time     uint32
	Pt       POINT
	LPrivate uint32
}

var (
	user32                     = syscall.NewLazyDLL("user32.dll")
	procRegisterHotKey         = user32.NewProc("RegisterHotKey")
	procUnregisterHotKey       = user32.NewProc("UnregisterHotKey")
	procGetMessageW            = user32.NewProc("GetMessageW")
	procTranslateMessage       = user32.NewProc("TranslateMessage")
	procDispatchMessageW       = user32.NewProc("DispatchMessageW")
	procGetCursorPos           = user32.NewProc("GetCursorPos")
	procGetWindowRect          = user32.NewProc("GetWindowRect")
	procGetWindowLongW         = user32.NewProc("GetWindowLongW")
	procSetWindowLongW         = user32.NewProc("SetWindowLongW")
	procSetLayeredWindowAttrs  = user32.NewProc("SetLayeredWindowAttributes")
	procShowWindow             = user32.NewProc("ShowWindow")
	procSetForegroundWindow    = user32.NewProc("SetForegroundWindow")
	procGetAsyncKeyState       = user32.NewProc("GetAsyncKeyState")
	procGetForegroundWindow    = user32.NewProc("GetForegroundWindow")
	procIsWindowVisible        = user32.NewProc("IsWindowVisible")
	procEnumWindows            = user32.NewProc("EnumWindows")
	procGetWindowThreadProcId  = user32.NewProc("GetWindowThreadProcessId")
)

var (
	appHwnd   syscall.Handle
	appPID    uint32
	isHidden  bool
	targetUrl = "https://destinations-lay-transcript-southeast.trycloudflare.com/app"
)

func findBrowser() string {
	localAppData := os.Getenv("LOCALAPPDATA")
	progFiles := os.Getenv("ProgramFiles")
	progFilesX86 := os.Getenv("ProgramFiles(x86)")

	candidates := []string{
		filepath.Join(progFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
		filepath.Join(progFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
		filepath.Join(localAppData, "Microsoft", "Edge", "Application", "msedge.exe"),
		filepath.Join(progFiles, "Google", "Chrome", "Application", "chrome.exe"),
		filepath.Join(progFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
		filepath.Join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
	}

	for _, c := range candidates {
		if c != "" {
			if _, err := os.Stat(c); err == nil {
				return c
			}
		}
	}
	return "msedge.exe"
}

func enumWindowsCallback(hwnd syscall.Handle, lParam uintptr) uintptr {
	var pid uint32
	procGetWindowThreadProcId.Call(uintptr(hwnd), uintptr(unsafe.Pointer(&pid)))

	ret, _, _ := procIsWindowVisible.Call(uintptr(hwnd))
	if pid == appPID && ret != 0 {
		appHwnd = hwnd
		return 0 // stop
	}
	return 1 // continue
}

func toggleBossKey() {
	if appHwnd == 0 {
		return
	}
	if !isHidden {
		procShowWindow.Call(uintptr(appHwnd), uintptr(SW_HIDE))
		isHidden = true
	} else {
		procShowWindow.Call(uintptr(appHwnd), uintptr(SW_SHOW))
		procShowWindow.Call(uintptr(appHwnd), uintptr(SW_RESTORE))
		procSetForegroundWindow.Call(uintptr(appHwnd))
		procSetLayeredWindowAttrs.Call(uintptr(appHwnd), 0, 255, uintptr(LWA_ALPHA))
		isHidden = false
	}
}

func startStealthMonitor() {
	go func() {
		var currentAlpha byte = 255
		outsideCounter := 0

		for {
			time.Sleep(45 * time.Millisecond)

			if appHwnd == 0 {
				cb := syscall.NewCallback(enumWindowsCallback)
				procEnumWindows.Call(cb, 0)

				if appHwnd != 0 {
					style, _, _ := procGetWindowLongW.Call(uintptr(appHwnd), GWL_EXSTYLE)
					procSetWindowLongW.Call(uintptr(appHwnd), GWL_EXSTYLE, style|WS_EX_LAYERED)
					procSetLayeredWindowAttrs.Call(uintptr(appHwnd), 0, 255, LWA_ALPHA)
				}
				continue
			}

			// 1. Panic Key ([Esc])
			esc, _, _ := procGetAsyncKeyState.Call(uintptr(VK_ESCAPE))
			if esc&0x8000 != 0 {
				fg, _, _ := procGetForegroundWindow.Call()
				if syscall.Handle(fg) == appHwnd {
					procShowWindow.Call(uintptr(appHwnd), uintptr(SW_MINIMIZE))
					time.Sleep(300 * time.Millisecond)
					continue
				}
			}

			// 2. Ghost Mode (Auto-Opacity)
			if isHidden {
				continue
			}

			var pt POINT
			var rect RECT
			procGetCursorPos.Call(uintptr(unsafe.Pointer(&pt)))
			procGetWindowRect.Call(uintptr(appHwnd), uintptr(unsafe.Pointer(&rect)))

			isInside := pt.X >= rect.Left && pt.X <= rect.Right && pt.Y >= rect.Top && pt.Y <= rect.Bottom
			const idleAlpha byte = 38 // ~15% opacity stealth

			if isInside {
				outsideCounter = 0
				if currentAlpha < 255 {
					diff := int(currentAlpha) + 55
					if diff > 255 {
						currentAlpha = 255
					} else {
						currentAlpha = byte(diff)
					}
					procSetLayeredWindowAttrs.Call(uintptr(appHwnd), 0, uintptr(currentAlpha), uintptr(LWA_ALPHA))
				}
			} else {
				outsideCounter++
				if outsideCounter > 3 {
					if currentAlpha > idleAlpha {
						diff := int(currentAlpha) - 28
						if diff < int(idleAlpha) {
							currentAlpha = idleAlpha
						} else {
							currentAlpha = byte(diff)
						}
						procSetLayeredWindowAttrs.Call(uintptr(appHwnd), 0, uintptr(currentAlpha), uintptr(LWA_ALPHA))
					}
				}
			}
		}
	}()
}

func main() {
	// 1. URL Resolution
	if len(os.Args) > 1 && strings.HasPrefix(os.Args[1], "http") {
		targetUrl = os.Args[1]
	} else {
		exeDir := filepath.Dir(os.Args[0])
		srvFile := filepath.Join(exeDir, "server.txt")
		if data, err := ioutil.ReadFile(srvFile); err == nil {
			line := strings.TrimSpace(string(data))
			if line != "" {
				targetUrl = line
			}
		}
	}

	// 2. Launch Edge / Chrome App Mode
	browser := findBrowser()
	localAppData := os.Getenv("LOCALAPPDATA")
	profileDir := filepath.Join(localAppData, "JosjisStealthProfile")

	args := []string{
		fmt.Sprintf("--app=%s", targetUrl),
		"--window-size=1020,680",
		fmt.Sprintf("--user-data-dir=%s", profileDir),
		"--disable-features=TranslateUI",
		"--disable-extensions",
		"--no-first-run",
		"--no-default-browser-check",
	}

	cmd := exec.Command(browser, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow: true,
	}

	err := cmd.Start()
	if err != nil {
		return
	}
	appPID = uint32(cmd.Process.Pid)

	// 3. Register Global Hotkey Alt + Q
	procRegisterHotKey.Call(0, uintptr(HOTKEY_BOSS_KEY), uintptr(MOD_ALT), uintptr(VK_Q))
	defer procUnregisterHotKey.Call(0, uintptr(HOTKEY_BOSS_KEY))

	// 4. Start Win32 Stealth Monitor
	startStealthMonitor()

	// 5. Hotkey Message Loop
	var msg MSG
	for {
		ret, _, _ := procGetMessageW.Call(uintptr(unsafe.Pointer(&msg)), 0, 0, 0)
		if int32(ret) <= 0 {
			break
		}
		if msg.Message == WM_HOTKEY && msg.WParam == uintptr(HOTKEY_BOSS_KEY) {
			toggleBossKey()
		}
		procTranslateMessage.Call(uintptr(unsafe.Pointer(&msg)))
		procDispatchMessageW.Call(uintptr(unsafe.Pointer(&msg)))
	}
}
