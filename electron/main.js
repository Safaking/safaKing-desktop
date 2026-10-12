const { app, BrowserWindow, shell } = require('electron');
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

  // Taking a product photo needs the camera, and a window showing a hosted
  // site is refused it by default — getUserMedia simply fails, with nothing
  // on screen to explain why. The camera is allowed for our own pages and
  // nothing else; every other permission a page might ask for is refused.
  // Electron grants every permission a page asks for unless a handler says
  // otherwise, so this is a restriction rather than an unlocking: the camera
  // is allowed for our own pages and refused to anything else, and every
  // other permission a page might ask for is refused outright.
  //
  // The URL is read from details.requestingUrl, not from the window: when a
  // page embeds an iframe, the window's own address is the wrong thing to
  // judge by, and an embedded third party could inherit a permission the
  // page never had.
  const ours = (url) => typeof url === 'string' && url.startsWith(APP_URL);

  win.webContents.session.setPermissionRequestHandler((contents, permission, callback, details) => {
    const asking = details?.requestingUrl || contents?.getURL?.() || '';
    callback(permission === 'media' && ours(asking));
  });

  // Chromium also asks this one synchronously, before listing the cameras.
  if (typeof win.webContents.session.setPermissionCheckHandler === 'function') {
    win.webContents.session.setPermissionCheckHandler((_contents, permission, origin, details) => {
      const asking = details?.requestingUrl || origin || '';
      return permission === 'media' && ours(asking);
    });
  }

  // A WhatsApp or map link belongs to Windows, not to this window: handing it
  // to the system opens WhatsApp Desktop with the message already written.
  // Anything the app opens for itself — the print preview windows, a blob
  // invoice — must still open here, or printing stops working.
  win.webContents.setWindowOpenHandler(({ url }) => {
    const external = /^(https?|mailto|tel|whatsapp):/i.test(url) && !url.startsWith(APP_URL);
    if (external) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // On Windows, closing a native alert()/confirm() hands focus back to the
  // window but not to the page inside it, so text boxes show a cursor and
  // ignore the keyboard until the window is clicked away from and back. The
  // web app no longer opens native popups; this covers any that slip through.
  win.on('focus', () => win.webContents.focus());

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
