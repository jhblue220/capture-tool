const {
  app, BrowserWindow, ipcMain, desktopCapturer,
  screen, Tray, Menu, nativeImage, systemPreferences, shell,
} = require('electron');
const path = require('path');

let win  = null;
let tray = null;

/* ── Window ──────────────────────────────────────────────── */
function createWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: 200,
    height: 150,
    x: width - 220,
    y: 40,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.loadFile('index.html');
  win.setWindowButtonVisibility(false);
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
}

/* ── Tray ─────────────────────────────────────────────────── */
function createTray() {
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/'
    + '9hAAAABmJLR0QA/wD/AP+gvaeTAAAAkklEQVQ4jdWTMQqDQBBFnyIieBOtbJL7'
    + 'eAIhnsLGzsLSK9h7E09gkSuIrYWIhYWthWCzfxeWZVkWNjDwYPj8mWEGthBC'
    + 'SCmlvPeqamZmZmZ2dg4RQRNCSohxHEspJSKiUkoopbTWWmuttdbae++9d0QEEU'
    + 'EIAQDgnENEsNZijDHGGGOMMcYYY4wxAAAA//8DADkrBMIAAAAASUVORK5CYII='
  );
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Capture Tool');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show', click: () => win?.show() },
    { label: 'Hide', click: () => win?.hide() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));
}

/* ── Screen Recording permission ──────────────────────────── */
function hasScreenPermission() {
  if (process.platform !== 'darwin') return true;
  return systemPreferences.getMediaAccessStatus('screen') === 'granted';
}

/* ── Display media handler (Electron 17+) ─────────────────── */
//
// Auto-selects the primary screen — no OS picker dialog shown to user.
// Renderer calls getDisplayMedia() and immediately gets the stream.
//
function setupDisplayMediaHandler() {
  const { session } = require('electron');
  session.defaultSession.setDisplayMediaRequestHandler(async (_req, callback) => {
    if (!hasScreenPermission()) {
      shell.openExternal(
        'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
      );
      callback(null);
      win.webContents.send('permission-denied');
      return;
    }
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 0, height: 0 },
      });
      callback({ video: sources[0] }); // primary screen, no dialog
    } catch (e) {
      callback(null);
    }
  }, { useSystemPicker: false });
}

/* ── IPC ──────────────────────────────────────────────────── */

ipcMain.on('hide-widget', () => win?.hide());

/* ── Widget drag ─────────────────────────────────────────── */
ipcMain.on('widget-move', (_, { dx, dy }) => {
  if (!win) return;
  const [x, y] = win.getPosition();
  win.setPosition(x + dx, y + dy);
});

/* ── Overlay / Gallery resize ────────────────────────────── */
const WIDGET_W = 220, WIDGET_H = 158;
const GALLERY_W = 360, GALLERY_H = 560;

function getWidgetPos() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  return { x: width - WIDGET_W - 16, y: 40 };
}

ipcMain.on('enter-overlay', () => {
  if (!win) return;
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  win.setBounds({ x: 0, y: 0, width, height }, true);
});

ipcMain.on('exit-overlay', () => {
  if (!win) return;
  const p = getWidgetPos();
  win.setBounds({ ...p, width: WIDGET_W, height: WIDGET_H }, true);
});

ipcMain.on('open-gallery', () => {
  if (!win) return;
  const p = getWidgetPos();
  const x = Math.max(0, p.x - (GALLERY_W - WIDGET_W));
  win.setBounds({ x, y: p.y, width: GALLERY_W, height: GALLERY_H }, true);
});

ipcMain.on('close-gallery', () => {
  if (!win) return;
  const p = getWidgetPos();
  win.setBounds({ ...p, width: WIDGET_W, height: WIDGET_H }, true);
});

/* ── App lifecycle ───────────────────────────────────────── */
app.whenReady().then(() => {
  createWindow();
  createTray();
  setupDisplayMediaHandler();
});

app.on('window-all-closed', e => e.preventDefault());
app.on('activate', () => win?.show());
