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
// Intercepts getDisplayMedia() calls from the renderer.
// Lets the renderer show a native source-picker via our own UI,
// then we feed back the chosen stream here.
//
let pendingDisplayMediaCallback = null;

function setupDisplayMediaHandler() {
  const { session } = require('electron');
  session.defaultSession.setDisplayMediaRequestHandler((_req, callback) => {
    // Store callback; renderer will resolve it after user picks a source
    pendingDisplayMediaCallback = callback;
    win.webContents.send('show-source-picker');
  }, { useSystemPicker: false });
}

/* ── IPC ──────────────────────────────────────────────────── */
ipcMain.handle('get-sources', async () => {
  if (!hasScreenPermission()) {
    // Open System Settings so user can grant access
    shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
    );
    return { error: 'permission', message: 'Screen Recording permission required.\nGrant it in System Settings, then relaunch.' };
  }
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 160, height: 90 },
    });
    return { sources: sources.map(s => ({ id: s.id, name: s.name })) };
  } catch (e) {
    return { error: 'getSources', message: e.message };
  }
});

// Renderer picked a source → feed to pending getDisplayMedia callback
ipcMain.on('source-selected', async (_, sourceId) => {
  if (!pendingDisplayMediaCallback) return;
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } });
    const src = sources.find(s => s.id === sourceId);
    if (src) pendingDisplayMediaCallback({ video: src });
    else      pendingDisplayMediaCallback(null);
  } catch {
    pendingDisplayMediaCallback(null);
  }
  pendingDisplayMediaCallback = null;
});

ipcMain.on('source-cancelled', () => {
  pendingDisplayMediaCallback?.(null);
  pendingDisplayMediaCallback = null;
});

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
