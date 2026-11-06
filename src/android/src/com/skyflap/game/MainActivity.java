package com.skyflap.game;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

public class MainActivity extends Activity {
    static final String UPDATE_BASE = "__UPDATE_BASE__";
    static final String BUNDLED_GAME = "__GAME_VERSION__";

    private WebView web;
    private SharedPreferences prefs;
    private String loadedGame = BUNDLED_GAME;
    private volatile String status = "idle", error = "", readyVer = null, readyNotes = "", appVer = null, appNotes = "", appUrl = null, appSha = "";
    private volatile double progress = 0;
    private volatile boolean busy = false;
    private int installAttempts = 0;
    private boolean pendingInstall = false;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = getSharedPreferences("updates", MODE_PRIVATE);
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_FULLSCREEN
                | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);
        try {
            WindowManager.LayoutParams lp = w.getAttributes();
            lp.getClass().getField("layoutInDisplayCutoutMode").setInt(lp, 1);
            w.setAttributes(lp);
        } catch (Throwable ignored) { }

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        web.setWebViewClient(new WebViewClient());
        web.addJavascriptInterface(new Bridge(), "SkyflapNative");
        setContentView(web);
        hideSystemUi();
        web.loadUrl(entryUrl());
    }

    // ---------- versions ----------
    static int num(String s) { try { return Integer.parseInt(s.replaceAll("[^0-9]", "")); } catch (Exception e) { return 0; } }
    static int cmp(String a, String b) {
        String[] x = a.split("\\."), y = b.split("\\.");
        for (int i = 0; i < Math.max(x.length, y.length); i++) {
            int p = i < x.length ? num(x[i]) : 0, q = i < y.length ? num(y[i]) : 0;
            if (p != q) return p > q ? 1 : -1;
        }
        return 0;
    }
    int versionCode() { try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionCode; } catch (Exception e) { return 0; } }
    String versionName() { try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return "?"; } }
    File gameRoot() { return new File(getFilesDir(), "game"); }

    String entryUrl() {
        String v = prefs.getString("gameVer", null);
        int min = prefs.getInt("gameMinAndroid", 0);
        if (v != null && (cmp(v, BUNDLED_GAME) > 0 || prefs.getBoolean("gameAnyVer", false)) && versionCode() >= min) {
            File f = new File(new File(gameRoot(), v), "index.html");
            if (f.exists() && new File(f.getParentFile(), "sounds.js").exists()) { loadedGame = v; return Uri.fromFile(f).toString(); }
        }
        loadedGame = BUNDLED_GAME;
        return "file:///android_asset/index.html";
    }

    // ---------- state pushed to the game ----------
    String stateJson() {
        try {
            JSONObject o = new JSONObject();
            o.put("appVersion", versionName()); o.put("gameVersion", loadedGame); o.put("status", status);
            o.put("progress", progress); o.put("error", error);
            if (readyVer != null) { JSONObject r = new JSONObject(); r.put("version", readyVer); r.put("notes", readyNotes); o.put("ready", r); }
            if (appVer != null) { JSONObject a = new JSONObject(); a.put("version", appVer); a.put("notes", appNotes); o.put("app", a); }
            return o.toString();
        } catch (Exception e) { return "{}"; }
    }
    void push() {
        final String js = "window.__skyflapUpdate&&window.__skyflapUpdate(" + JSONObject.quote(stateJson()) + ")";
        runOnUiThread(new Runnable() { public void run() { if (web != null) web.evaluateJavascript(js, null); } });
    }

    // ---------- networking ----------
    byte[] fetch(String u, boolean reportProgress) throws Exception {
        URL url = new URL(u);
        HttpURLConnection c = null;
        for (int i = 0; i < 8; i++) {
            c = (HttpURLConnection) url.openConnection();
            c.setConnectTimeout(15000); c.setReadTimeout(30000); c.setUseCaches(false);
            c.setInstanceFollowRedirects(false); c.setRequestProperty("User-Agent", "Skyflap-Android");
            int code = c.getResponseCode();
            if (code >= 300 && code < 400) { String loc = c.getHeaderField("Location"); c.disconnect(); url = new URL(url, loc); continue; }
            if (code != 200) throw new IOException("HTTP " + code);
            break;
        }
        int total = c.getContentLength();
        InputStream in = c.getInputStream();
        ByteArrayOutputStream out = new ByteArrayOutputStream(Math.max(total, 16384));
        byte[] buf = new byte[65536];
        int n, got = 0; long last = 0;
        while ((n = in.read(buf)) > 0) {
            out.write(buf, 0, n); got += n;
            if (reportProgress && total > 0) { progress = (double) got / total; long now = SystemClock.uptimeMillis(); if (now - last > 200) { last = now; push(); } }
        }
        in.close(); c.disconnect();
        return out.toByteArray();
    }
    static String sha256(byte[] b) throws Exception {
        byte[] d = MessageDigest.getInstance("SHA-256").digest(b);
        StringBuilder sb = new StringBuilder();
        for (byte x : d) sb.append(String.format("%02x", x & 0xff));
        return sb.toString();
    }
    static void write(File f, byte[] b) throws IOException { FileOutputStream o = new FileOutputStream(f); o.write(b); o.close(); }
    static void delete(File f) { if (f.isDirectory()) { File[] l = f.listFiles(); if (l != null) for (File x : l) delete(x); } f.delete(); }

    // ---------- update check: game files (hot) + app (APK) ----------
    void startCheck() { startCheck("stable", false); }
    void startCheck(final String channel, final boolean force) {
        if (busy || UPDATE_BASE.startsWith("__")) return;
        final String BASE = UPDATE_BASE + ("beta".equals(channel) ? "/beta" : "");
        if (force) readyVer = null;
        busy = true; status = "checking"; error = ""; push();
        new Thread(new Runnable() { public void run() {
            try {
                JSONObject m = new JSONObject(new String(fetch(BASE + "/manifest.json?t=" + System.currentTimeMillis(), false), "UTF-8"));
                JSONObject A = m.optJSONObject("android");
                if (A != null && A.optInt("versionCode", 0) > versionCode()) {
                    appVer = A.optString("version", "?"); appNotes = A.optString("notes", ""); appUrl = A.optString("url", null); appSha = A.optString("sha256", "");
                } else appVer = null;
                JSONObject G = m.optJSONObject("game");
                String have = readyVer != null ? readyVer : loadedGame;
                int c0 = G != null ? cmp(G.getString("version"), have) : 0;
                if (G != null && (force ? c0 != 0 : c0 > 0) && versionCode() >= G.optInt("minAndroid", 0)) {
                    String v = G.getString("version");
                    status = "downloading"; progress = 0; push();
                    File dir = new File(gameRoot(), v), tmp = new File(gameRoot(), v + ".part");
                    delete(tmp); tmp.mkdirs();
                    JSONObject files = G.getJSONObject("files");
                    JSONArray names = files.names();
                    long total = 0, done = 0;
                    for (int i = 0; i < names.length(); i++) total += Math.max(1, files.getJSONObject(names.getString(i)).optLong("size", 1));
                    for (int i = 0; i < names.length(); i++) {
                        String name = names.getString(i);
                        JSONObject f = files.getJSONObject(name);
                        byte[] b = fetch(BASE + "/game/" + name + "?v=" + v, false);
                        if (!sha256(b).equals(f.getString("sha256"))) throw new IOException("checksum mismatch");
                        write(new File(tmp, name), b);
                        done += Math.max(1, f.optLong("size", 1)); progress = (double) done / total; push();
                    }
                    delete(dir);
                    if (!tmp.renameTo(dir)) throw new IOException("could not save update");
                    prefs.edit().putString("gameVer", v).putInt("gameMinAndroid", G.optInt("minAndroid", 0)).putBoolean("gameAnyVer", cmp(v, BUNDLED_GAME) <= 0).apply();
                    File[] old = gameRoot().listFiles();
                    if (old != null) for (File x : old) if (!x.getName().equals(v) && !x.getName().equals(loadedGame)) delete(x);
                    readyVer = v; readyNotes = G.optString("notes", "");
                }
                status = readyVer != null ? "ready" : appVer != null ? "app" : "uptodate";
            } catch (Exception e) { status = "error"; error = String.valueOf(e.getMessage()); }
            busy = false; push();
        }}).start();
    }

    void startInstall() {
        if (appUrl == null || busy) return;
        busy = true; status = "installing"; progress = 0; push();
        new Thread(new Runnable() { public void run() {
            try {
                byte[] b = fetch(appUrl, true);
                if (appSha.length() > 0 && !sha256(b).equals(appSha)) throw new IOException("checksum mismatch");
                File d = new File(getCacheDir(), "updates"); d.mkdirs();
                write(new File(d, "Skyflap.apk"), b);
                status = "app"; installAttempts = 0;
                runOnUiThread(new Runnable() { public void run() { launchInstaller(); } });
            } catch (Exception e) { status = "error"; error = String.valueOf(e.getMessage()); }
            busy = false; push();
        }}).start();
    }

    void launchInstaller() {
        if (Build.VERSION.SDK_INT >= 26) {
            try {
                PackageManager pm = getPackageManager();
                boolean ok = (Boolean) pm.getClass().getMethod("canRequestPackageInstalls").invoke(pm);
                if (!ok) {
                    if (installAttempts++ < 1) {
                        pendingInstall = true;
                        startActivity(new Intent("android.settings.MANAGE_UNKNOWN_APP_SOURCES", Uri.parse("package:" + getPackageName())));
                    } else openInBrowser();
                    return;
                }
            } catch (Throwable ignored) { }
        }
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(Uri.parse("content://" + ApkProvider.AUTHORITY + "/Skyflap.apk"), "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try { startActivity(i); } catch (Exception e) { openInBrowser(); }
    }
    void openInBrowser() { try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(appUrl))); } catch (Exception ignored) { } }

    class Bridge {
        @JavascriptInterface public String info() { return stateJson(); }
        @JavascriptInterface public void check() { startCheck(); }
        @JavascriptInterface public void check2(String channel, boolean force) { startCheck(channel, force); }
        @JavascriptInterface public void installApp() { startInstall(); }
        @JavascriptInterface public void restart() {
            runOnUiThread(new Runnable() { public void run() { readyVer = null; status = "idle"; web.loadUrl(entryUrl()); } });
        }
    }

    // ---------- window ----------
    private void hideSystemUi() {
        web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }
    @Override public void onWindowFocusChanged(boolean focus) { super.onWindowFocusChanged(focus); if (focus) hideSystemUi(); }
    @Override protected void onPause() { super.onPause(); web.onPause(); web.pauseTimers(); }
    @Override protected void onResume() {
        super.onResume(); web.onResume(); web.resumeTimers(); hideSystemUi();
        if (pendingInstall) { pendingInstall = false; launchInstaller(); }
    }
    @Override protected void onDestroy() { if (web != null) web.destroy(); super.onDestroy(); }
}
