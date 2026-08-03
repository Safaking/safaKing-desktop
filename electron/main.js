const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Joshi Safa House',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    autoHideMenuBar: true,
  });

  const PROD_URL = process.env.APP_URL || 'https://store.safaking.in';
  const url = isDev ? 'http://localhost:3000' : PROD_URL;

  win.loadURL(url);

  // A blank white window is indistinguishable from a hung app, so surface the
  // actual reason the page could not load (offline, DNS, 404, server down).
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, failedUrl) => {
    const message = `Could not load ${failedUrl || url}\n${errorDescription} (${errorCode})`;
    win.loadURL(
      'data:text/html;charset=utf-8,' +
        encodeURIComponent(`
          <html><body style="font-family:system-ui,sans-serif;display:flex;align-items:center;
            justify-content:center;height:100vh;margin:0;background:#fff;color:#1e4d8c;text-align:center">
            <div>
              <h2>Joshi Safa House</h2>
              <p style="color:#444">Unable to reach the application.</p>
              <pre style="color:#888;white-space:pre-wrap;font-size:12px">${message}</pre>
              <p style="color:#444">Check your internet connection, then reopen the app.</p>
            </div>
          </body></html>
        `)
    );
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
