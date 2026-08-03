const { app, BrowserWindow } = require('electron');
const path = require('path');

// The desktop app is a shell around the hosted site and always loads it.
// It previously branched on electron-is-dev, but that package is pure ESM, so
// `require()` from this CommonJS file returned the module namespace object
// instead of the boolean. Being an object it was always truthy, so every
// packaged build tried http://localhost:3000 and failed with connection
// refused on machines with no dev server.
const APP_URL = 'https://store.safaking.in';

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

  win.loadURL(APP_URL);

  // A blank white window is indistinguishable from a hung app, so surface the
  // actual reason the page could not load (offline, DNS, 404, server down).
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, failedUrl) => {
    const message = `Could not load ${failedUrl || APP_URL}\n${errorDescription} (${errorCode})`;
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
