using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace JosjisCompact
{
    // =========================================================================
    // Win32 API Definitions for OS-Level Stealth Transparency, Hotkeys & Tray
    // =========================================================================
    internal static class NativeMethods
    {
        public const int GWL_EXSTYLE = -20;
        public const int WS_EX_LAYERED = 0x80000;
        public const uint LWA_ALPHA = 0x2;
        public const int SW_HIDE = 0;
        public const int SW_SHOWNORMAL = 1;
        public const int SW_SHOW = 5;
        public const int SW_MINIMIZE = 6;
        public const int SW_RESTORE = 9;
        public const int VK_ESCAPE = 0x1B;
        public const int VK_Q = 0x51;
        public const int MOD_ALT = 0x0001;
        public const int WM_HOTKEY = 0x0312;

        public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
        public static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);
        public const uint SWP_NOMOVE = 0x0002;
        public const uint SWP_NOSIZE = 0x0001;
        public const uint SWP_SHOWWINDOW = 0x0040;

        [StructLayout(LayoutKind.Sequential)]
        public struct POINT
        {
            public int X;
            public int Y;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct RECT
        {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        [DllImport("user32.dll", SetLastError = true)]
        public static extern int GetWindowLong(IntPtr hWnd, int nIndex);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool SetLayeredWindowAttributes(IntPtr hwnd, uint crKey, byte bAlpha, uint dwFlags);

        [DllImport("user32.dll")]
        public static extern bool GetCursorPos(out POINT lpPoint);

        [DllImport("user32.dll")]
        public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

        [DllImport("user32.dll")]
        public static extern short GetAsyncKeyState(int vKey);

        [DllImport("user32.dll")]
        public static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll")]
        public static extern bool IsWindowVisible(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern bool RegisterHotKey(IntPtr hWnd, int id, int fsModifiers, int vk);

        [DllImport("user32.dll")]
        public static extern bool UnregisterHotKey(IntPtr hWnd, int id);

        public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll")]
        public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    }

    // =========================================================================
    // Hidden Controller Form (Handles Tray, Boss Key Alt+Q, and Ghost Dimming)
    // =========================================================================
    public class ControllerForm : Form
    {
        private const int HOTKEY_BOSS_KEY = 9001;
        private NotifyIcon trayIcon;
        private ContextMenu trayMenu;
        private Process appProcess;
        private IntPtr appHwnd = IntPtr.Zero;
        private Thread monitorThread;
        private bool isRunning = true;
        private bool isGhostEnabled = true;
        private bool isHidden = false;
        private string targetUrl;

        public ControllerForm(string url)
        {
            this.targetUrl = url;
            this.ShowInTaskbar = false;
            this.WindowState = FormWindowState.Minimized;
            this.FormBorderStyle = FormBorderStyle.None;
            this.Size = new Size(0, 0);

            InitTray();
            NativeMethods.RegisterHotKey(this.Handle, HOTKEY_BOSS_KEY, NativeMethods.MOD_ALT, NativeMethods.VK_Q);

            LaunchBrowserApp();
            StartStealthMonitor();
        }

        private void InitTray()
        {
            trayMenu = new ContextMenu();
            trayMenu.MenuItems.Add("Buka JOSJIS IT TEAM", (s, e) => ToggleBossKey(false));
            trayMenu.MenuItems.Add("Boss Key (Alt+Q)", (s, e) => ToggleBossKey());
            trayMenu.MenuItems.Add("-");
            MenuItem ghostItem = new MenuItem("Ghost Mode (Auto-Transparan)", (s, e) => {
                isGhostEnabled = !isGhostEnabled;
                ((MenuItem)s).Checked = isGhostEnabled;
                if (!isGhostEnabled && appHwnd != IntPtr.Zero)
                {
                    NativeMethods.SetLayeredWindowAttributes(appHwnd, 0, 255, NativeMethods.LWA_ALPHA);
                }
            });
            ghostItem.Checked = isGhostEnabled;
            trayMenu.MenuItems.Add(ghostItem);
            trayMenu.MenuItems.Add("-");
            trayMenu.MenuItems.Add("Keluar", (s, e) => ExitApp());

            // Generate shield cyan tray icon dynamically
            Bitmap bmp = new Bitmap(16, 16);
            using (Graphics g = Graphics.FromImage(bmp))
            {
                g.Clear(Color.Transparent);
                using (SolidBrush brush = new SolidBrush(Color.FromArgb(14, 165, 233)))
                {
                    Point[] points = {
                        new Point(2, 2), new Point(13, 2),
                        new Point(13, 9), new Point(7, 14),
                        new Point(2, 9)
                    };
                    g.FillPolygon(brush, points);
                }
            }
            Icon icon = Icon.FromHandle(bmp.GetHicon());

            trayIcon = new NotifyIcon();
            trayIcon.Text = "JOSJIS IT TEAM - Compact Stealth Client (Alt+Q)";
            trayIcon.Icon = icon;
            trayIcon.ContextMenu = trayMenu;
            trayIcon.Visible = true;
            trayIcon.DoubleClick += (s, e) => ToggleBossKey(false);
        }

        private string FindBrowserPath()
        {
            string[] possiblePaths = new string[] {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\Chrome\Application\chrome.exe")
            };

            foreach (string p in possiblePaths)
            {
                if (File.Exists(p)) return p;
            }
            return "msedge.exe"; // Fallback to PATH
        }

        private void LaunchBrowserApp()
        {
            string browser = FindBrowserPath();
            string profileDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "JosjisCompactProfile");

            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = browser;
            psi.Arguments = string.Format("--app=\"{0}\" --window-size=1020,680 --user-data-dir=\"{1}\" --disable-features=TranslateUI --disable-extensions", targetUrl, profileDir);
            psi.UseShellExecute = true;

            try
            {
                appProcess = Process.Start(psi);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Gagal membuka browser engine:\n" + ex.Message, "JOSJIS Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Application.Exit();
            }
        }

        private void StartStealthMonitor()
        {
            monitorThread = new Thread(() => {
                byte currentAlpha = 255;
                int outsideCounter = 0;

                while (isRunning)
                {
                    Thread.Sleep(45);

                    if (appHwnd == IntPtr.Zero || !NativeMethods.IsWindowVisible(appHwnd))
                    {
                        if (appProcess != null && !appProcess.HasExited)
                        {
                            IntPtr mainHandle = appProcess.MainWindowHandle;
                            if (mainHandle != IntPtr.Zero)
                            {
                                appHwnd = mainHandle;
                            }
                            else
                            {
                                // Enum top-level windows for this process
                                NativeMethods.EnumWindows((hwnd, lParam) => {
                                    uint pid;
                                    NativeMethods.GetWindowThreadProcessId(hwnd, out pid);
                                    if (pid == appProcess.Id && NativeMethods.IsWindowVisible(hwnd))
                                    {
                                        appHwnd = hwnd;
                                        return false; // Stop enumeration
                                    }
                                    return true;
                                }, IntPtr.Zero);
                            }

                            if (appHwnd != IntPtr.Zero)
                            {
                                int style = NativeMethods.GetWindowLong(appHwnd, NativeMethods.GWL_EXSTYLE);
                                NativeMethods.SetWindowLong(appHwnd, NativeMethods.GWL_EXSTYLE, style | NativeMethods.WS_EX_LAYERED);
                                NativeMethods.SetLayeredWindowAttributes(appHwnd, 0, 255, NativeMethods.LWA_ALPHA);
                            }
                        }
                        continue;
                    }

                    // 1. Panic Key ([Esc]) - Sembunyikan jika sedang fokus
                    short escState = NativeMethods.GetAsyncKeyState(NativeMethods.VK_ESCAPE);
                    if ((escState & 0x8000) != 0)
                    {
                        if (NativeMethods.GetForegroundWindow() == appHwnd)
                        {
                            NativeMethods.ShowWindow(appHwnd, NativeMethods.SW_MINIMIZE);
                            Thread.Sleep(300);
                            continue;
                        }
                    }

                    // 2. Ghost Mode (Auto-Opacity saat mouse keluar batas window)
                    if (!isGhostEnabled || isHidden) continue;

                    NativeMethods.POINT pt;
                    NativeMethods.RECT rect;
                    NativeMethods.GetCursorPos(out pt);
                    NativeMethods.GetWindowRect(appHwnd, out rect);

                    bool isInside = (pt.X >= rect.Left && pt.X <= rect.Right && pt.Y >= rect.Top && pt.Y <= rect.Bottom);
                    byte idleAlpha = 40; // ~15% opacity stealth

                    if (isInside)
                    {
                        outsideCounter = 0;
                        if (currentAlpha < 255)
                        {
                            currentAlpha = (byte)Math.Min(255, currentAlpha + 50);
                            NativeMethods.SetLayeredWindowAttributes(appHwnd, 0, currentAlpha, NativeMethods.LWA_ALPHA);
                        }
                    }
                    else
                    {
                        outsideCounter++;
                        if (outsideCounter > 4) // Delay ~180ms
                        {
                            if (currentAlpha > idleAlpha)
                            {
                                currentAlpha = (byte)Math.Max(idleAlpha, currentAlpha - 25);
                                NativeMethods.SetLayeredWindowAttributes(appHwnd, 0, currentAlpha, NativeMethods.LWA_ALPHA);
                            }
                        }
                    }
                }
            });

            monitorThread.IsBackground = true;
            monitorThread.Start();
        }

        private void ToggleBossKey(bool? forceHide = null)
        {
            if (appHwnd == IntPtr.Zero) return;

            bool shouldHide = forceHide.HasValue ? forceHide.Value : !isHidden;

            if (shouldHide)
            {
                NativeMethods.ShowWindow(appHwnd, NativeMethods.SW_HIDE);
                isHidden = true;
            }
            else
            {
                NativeMethods.ShowWindow(appHwnd, NativeMethods.SW_SHOW);
                NativeMethods.ShowWindow(appHwnd, NativeMethods.SW_RESTORE);
                NativeMethods.SetForegroundWindow(appHwnd);
                NativeMethods.SetLayeredWindowAttributes(appHwnd, 0, 255, NativeMethods.LWA_ALPHA);
                isHidden = false;
            }
        }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == NativeMethods.WM_HOTKEY && m.WParam.ToInt32() == HOTKEY_BOSS_KEY)
            {
                ToggleBossKey();
            }
            base.WndProc(ref m);
        }

        private void ExitApp()
        {
            isRunning = false;
            NativeMethods.UnregisterHotKey(this.Handle, HOTKEY_BOSS_KEY);
            if (trayIcon != null)
            {
                trayIcon.Visible = false;
                trayIcon.Dispose();
            }
            try
            {
                if (appProcess != null && !appProcess.HasExited)
                {
                    appProcess.Kill();
                }
            }
            catch { }
            Application.Exit();
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            ExitApp();
            base.OnFormClosing(e);
        }
    }

    public static class Program
    {
        [STAThread]
        public static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string targetUrl = "http://192.168.18.50:3000/app";

            // Baca dari argumen command-line jika ada (misal: JosjisCompact.exe http://192.168.1.100:3000/app)
            if (args != null && args.Length > 0 && !string.IsNullOrEmpty(args[0]))
            {
                targetUrl = args[0];
            }
            else
            {
                // Cek file config server.txt di folder yang sama
                string configFile = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "server.txt");
                if (File.Exists(configFile))
                {
                    try
                    {
                        string line = File.ReadAllText(configFile).Trim();
                        if (!string.IsNullOrEmpty(line)) targetUrl = line;
                    }
                    catch { }
                }
            }

            Application.Run(new ControllerForm(targetUrl));
        }
    }
}
