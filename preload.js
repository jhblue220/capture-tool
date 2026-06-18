const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSources:      ()       => ipcRenderer.invoke('get-sources'),
  selectSource:    (id)     => ipcRenderer.send('source-selected', id),
  cancelSource:    ()       => ipcRenderer.send('source-cancelled'),
  widgetMove:      (delta)  => ipcRenderer.send('widget-move', delta),
  enterOverlay:    ()       => ipcRenderer.send('enter-overlay'),
  exitOverlay:     ()       => ipcRenderer.send('exit-overlay'),
  openGallery:     ()       => ipcRenderer.send('open-gallery'),
  closeGallery:    ()       => ipcRenderer.send('close-gallery'),
  onShowPicker:    (cb)     => ipcRenderer.on('show-source-picker', cb),
});
