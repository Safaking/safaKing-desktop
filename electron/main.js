const { app, BrowserWindow, Notification, shell } = require('electron');
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

  // Handed back so the handover check can raise and focus this window when
  // its notification is clicked.
  return win;
}

/**
 * Tell the shop what is coming, without anybody having to open the dashboard.
 *
 * The dashboard has always carried a "coming up this week" card, but it only
 * says anything to somebody already looking at it. This asks the same endpoint
 * from the desktop app itself and raises a real Windows notification, so an
 * order wanted on Friday is heard about on Monday.
 *
 * Nothing is sent anywhere: it reads the shop's own API and shows the result
 * on this machine.
 */
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

/** Orders already mentioned, so the same wedding is not announced all day. */
let announced = new Set();
let announcedOn = '';

async function checkWhatIsComing(win) {
  const todayKey = new Date().toDateString();
  // A new day starts the list again — an order still unpacked tomorrow is
  // worth repeating, one already mentioned this morning is not.
  if (announcedOn !== todayKey) {
    announced = new Set();
    announcedOn = todayKey;
  }

  let feed;
  try {
    const res = await fetch(`${APP_URL}/api/dashboard/attention`, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return;
    feed = await res.json();
  } catch {
    // No network, or the site is down. The dashboard still carries this when
    // it comes back, so there is nothing to report and nothing to retry.
    return;
  }

  const due = [...(feed?.dueToday ?? []), ...(feed?.upcoming ?? [])].filter(
    order => order?.orderNumber && !announced.has(order.orderNumber)
  );
  if (due.length === 0) return;

  for (const order of due) announced.add(order.orderNumber);

  const first = due[0];
  const when = (() => {
    const d = new Date(first.startDate);
    if (Number.isNaN(d.getTime())) return '';
    const days = Math.round((d.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
    if (days <= 0) return 'आज';
    if (days === 1) return 'कल';
    return `${days} दिन में`;
  })();

  const body =
    due.length === 1
      ? `${first.customerName} — ${first.orderNumber}${when ? `, ${when}` : ''}. पैकिंग बाकी है।`
      : `${first.customerName}${when ? ` (${when})` : ''} सहित ${due.length} ऑर्डर की पैकिंग बाकी है।`;

  const note = new Notification({ title: 'साफा देना है / Handover coming up', body });
  // Clicking it should land on the list, not just raise the window on
  // whatever page it happened to be left on.
  note.on('click', () => {
    if (win.isMinimized()) win.restore();
    win.focus();
    win.loadURL(`${APP_URL}/`);
  });
  note.show();
}

app.whenReady().then(() => {
  const win = createWindow();

  // Not at the instant of launch: the machine is busy opening the app and a
  // notification then is missed. A minute in, it is read.
  if (Notification.isSupported()) {
    setTimeout(() => checkWhatIsComing(win), 60_000);
    setInterval(() => checkWhatIsComing(win), CHECK_EVERY_MS);
  }

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
