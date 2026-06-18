const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  hideWidget:       ()      => ipcRenderer.send('hide-widget'),
  widgetMove:       (delta) => ipcRenderer.send('widget-move', delta),
  enterOverlay:     ()      => ipcRenderer.send('enter-overlay'),
  exitOverlay:      ()      => ipcRenderer.send('exit-overlay'),
  openGallery:      ()      => ipcRenderer.send('open-gallery'),
  closeGallery:     ()      => ipcRenderer.send('close-gallery'),
  onPermissionDenied: (cb)  => ipcRenderer.on('permission-denied', cb),
});
