package in.safaking.store;

import android.app.DownloadManager;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.util.Base64;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;

import java.io.File;
import java.io.FileOutputStream;

/**
 * The shop's POS, wrapped for Android.
 *
 * The same thin shell as the Windows build: everything lives at store.safaking.in
 * and is loaded from there, so features and fixes arrive without anyone
 * installing anything. Only the pieces a bare WebView does not do on its own
 * are handled here.
 */
public class MainActivity extends AppCompatActivity {

    private static final String APP_URL = "https://store.safaking.in";

    private WebView web;
    private ValueCallback<Uri[]> pendingFiles;
    private ActivityResultLauncher<String> filePicker;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Product photos are added from the admin screen, so the page's file
        // input has to be able to open the phone's picker.
        filePicker = registerForActivityResult(
                new ActivityResultContracts.GetContent(),
                uri -> {
                    if (pendingFiles == null) return;
                    pendingFiles.onReceiveValue(uri == null ? null : new Uri[]{uri});
                    pendingFiles = null;
                });

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        // The signed-in session is kept in localStorage. Without this the app
        // would forget who is logged in every time it was closed.
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        // The till and booking screens are laid out for a counter monitor, so
        // render at desktop width and let the screen scale it down rather than
        // reflowing three columns into a phone-width strip.
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setSupportMultipleWindows(false);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.addJavascriptInterface(new BlobSaver(), "AndroidBlob");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                // Everything on the shop's own site stays in the app.
                String host = req.getUrl().getHost();
                return host != null && !host.endsWith("safaking.in");
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb,
                                             FileChooserParams params) {
                if (pendingFiles != null) pendingFiles.onReceiveValue(null);
                pendingFiles = cb;
                filePicker.launch("image/*");
                return true;
            }
        });

        /*
         * Bills are generated in the browser and handed over as blob: URLs,
         * which the system download manager cannot fetch — it only understands
         * http(s). So a blob is read back inside the page and passed here as
         * base64 to be written out. Without this the app could show a bill but
         * never save one, which is most of what this app is for.
         */
        web.setDownloadListener((url, userAgent, disposition, mime, size) -> {
            if (url.startsWith("blob:")) {
                web.evaluateJavascript(blobReaderScript(url, mime), null);
                return;
            }
            DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url));
            String name = URLUtil.guessFileName(url, disposition, mime);
            r.setMimeType(mime);
            r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            if (dm != null) dm.enqueue(r);
            toast("Downloading " + name);
        });

        // Back should walk the app's own history before leaving it.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (web.canGoBack()) web.goBack();
                else finish();
            }
        });

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(APP_URL);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    /** Reads a blob back out of the page as base64 and hands it to Android. */
    private static String blobReaderScript(String url, String mime) {
        return "(function(){var x=new XMLHttpRequest();x.open('GET','" + url + "',true);"
                + "x.responseType='blob';x.onload=function(){if(x.status!==200)return;"
                + "var r=new FileReader();r.onloadend=function(){"
                + "AndroidBlob.save(r.result,'" + mime + "');};r.readAsDataURL(x.response);};"
                + "x.send();})()";
    }

    private void toast(String m) {
        runOnUiThread(() -> Toast.makeText(this, m, Toast.LENGTH_SHORT).show());
    }

    private class BlobSaver {
        @JavascriptInterface
        public void save(String dataUrl, String mime) {
            try {
                int comma = dataUrl.indexOf(',');
                if (comma < 0) return;
                byte[] bytes = Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT);

                String ext = mime != null && mime.contains("pdf") ? ".pdf" : ".bin";
                String name = "SafaKing-" + System.currentTimeMillis() + ext;

                File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!dir.exists() && !dir.mkdirs()) {
                    toast("Could not open the Downloads folder");
                    return;
                }
                File out = new File(dir, name);
                try (FileOutputStream fos = new FileOutputStream(out)) {
                    fos.write(bytes);
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                    if (dm != null) {
                        dm.addCompletedDownload(name, "Bill", true, mime,
                                out.getAbsolutePath(), out.length(), true);
                    }
                }
                toast("Saved to Downloads: " + name);
            } catch (Exception e) {
                toast("Could not save the file");
            }
        }
    }
}
