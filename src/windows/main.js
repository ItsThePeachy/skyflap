const { app, BrowserWindow, Menu, shell, screen, ipcMain, net } = require('electron');
const path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto'), { spawn } = require('child_process');
const UPDATE_BASE = process.env.SKYFLAP_UPDATE_BASE || '__UPDATE_BASE__';

app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.setAppUserModelId('com.skyflap.game');
if (!app.requestSingleInstanceLock()) app.quit();

// ---- persisted display settings ----
const cfgPath = () => path.join(app.getPath('userData'), 'display.json');
const cfg = { mode: 'windowed', w: 0, h: 0 };
function loadCfg() { try { Object.assign(cfg, JSON.parse(fs.readFileSync(cfgPath(), 'utf8'))); } catch (e) {} }
function saveCfg() { try { fs.writeFileSync(cfgPath(), JSON.stringify(cfg)); } catch (e) {} }

const SIZES = [[405, 720], [540, 960], [720, 1280], [900, 1600], [1080, 1920], [1280, 720], [1600, 900], [1920, 1080], [2560, 1440]];
function fitSizes() { const a = screen.getPrimaryDisplay().workAreaSize; return SIZES.filter(([w, h]) => w <= a.width && h <= a.height - 32); }
function defaultSize() { const a = screen.getPrimaryDisplay().workAreaSize; const h = Math.min(960, Math.round(a.height * 0.92)); return [Math.round(h * 9 / 16), h]; }
function info() {
  const d = screen.getPrimaryDisplay(), [dw, dh] = defaultSize();
  return { mode: cfg.mode, w: cfg.w || dw, h: cfg.h || dh, sizes: fitSizes(),
           screen: [Math.round(d.size.width * d.scaleFactor), Math.round(d.size.height * d.scaleFactor)] };
}

let win = null, reopenSettings = false;
function notify() { if (win && !win.isDestroyed()) win.webContents.send('sd:changed', info()); }

function createWindow() {
  const disp = screen.getPrimaryDisplay(), borderless = cfg.mode === 'borderless';
  const [w, h] = cfg.w && cfg.h ? [cfg.w, cfg.h] : defaultSize();
  const opts = {
    width: w, height: h, useContentSize: true, minWidth: 320, minHeight: 480,
    backgroundColor: '#02040c', title: 'Skyflap', icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true, show: false, frame: !borderless,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, spellcheck: false }
  };
  if (borderless) {
    const b = disp.bounds;
    Object.assign(opts, { x: b.x, y: b.y, width: b.width, height: b.height, useContentSize: false,
      resizable: false, movable: false, maximizable: false, thickFrame: false, roundedCorners: false, minWidth: 0, minHeight: 0 });
  }
  const w2 = new BrowserWindow(opts);
  const old = win; win = w2;
  Menu.setApplicationMenu(null);
  w2.once('ready-to-show', () => {
    if (borderless) w2.setBounds(disp.bounds);
    if (cfg.mode === 'fullscreen') w2.setFullScreen(true);
    w2.show(); w2.focus();
    if (old && !old.isDestroyed()) old.destroy();
  });
  w2.loadFile(gameEntry(), reopenSettings ? { hash: 'settings' } : undefined);
  reopenSettings = false;

  w2.on('enter-full-screen', () => { if (cfg.mode !== 'fullscreen') { cfg.mode = 'fullscreen'; saveCfg(); notify(); } });
  w2.on('leave-full-screen', () => { if (cfg.mode === 'fullscreen') { cfg.mode = 'windowed'; saveCfg(); notify(); } });
  w2.on('resized', () => {
    if (cfg.mode === 'windowed' && !w2.isFullScreen() && !w2.isMaximized()) {
      const [cw, ch] = w2.getContentSize(); cfg.w = cw; cfg.h = ch; saveCfg(); notify();
    }
  });
  w2.webContents.on('before-input-event', (e, i) => {
    if (i.type !== 'keyDown') return;
    if (i.key === 'F11' || (i.key === 'Enter' && i.alt)) { e.preventDefault(); applyMode(cfg.mode === 'windowed' ? 'fullscreen' : 'windowed'); }
  });
  w2.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  w2.webContents.on('will-navigate', e => e.preventDefault());
}

function applyMode(mode) {
  if (!['windowed', 'borderless', 'fullscreen'].includes(mode) || mode === cfg.mode) return;
  const prev = cfg.mode; cfg.mode = mode; saveCfg();
  if ((prev === 'borderless') !== (mode === 'borderless')) { reopenSettings = true; createWindow(); return; } // frame can only change on a new window
  win.setFullScreen(mode === 'fullscreen');
  notify();
}


// ---- updates: hot game updates (no reinstall) + app self-update ----
const cmpVer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0 ? 1 : -1; } return 0; };
const gameRoot = () => path.join(app.getPath('userData'), 'game');
function bundledGameVersion() { try { const m = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').slice(0, 200000).match(/SKYFLAP_GAME_VERSION='([^']+)'/); return m ? m[1] : '0'; } catch (e) { return '0'; } }
function installedGame() {
  try { const c = JSON.parse(fs.readFileSync(path.join(gameRoot(), 'current.json'), 'utf8'));
    const dir = path.join(gameRoot(), c.version);
    if ((cmpVer(c.version, bundledGameVersion()) > 0 || c.bundled) && cmpVer(app.getVersion(), c.minWindows || '0') >= 0 && fs.existsSync(path.join(dir, 'index.html'))) return { version: c.version, dir };
  } catch (e) {}
  return null;
}
const up = { appVersion: app.getVersion(), gameVersion: '0', status: 'idle', ready: null, app: null, progress: 0, error: '' };
let manifest = null, loadedGame = null;
function gameEntry() { const g = installedGame(); loadedGame = g ? g.version : bundledGameVersion(); up.gameVersion = loadedGame; return g ? path.join(g.dir, 'index.html') : path.join(__dirname, 'index.html'); }
function sendUp() { if (win && !win.isDestroyed()) win.webContents.send('up:state', up); }
async function fetchBuf(url, onProgress) {
  const r = await net.fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const total = +r.headers.get('content-length') || 0, reader = r.body.getReader(), parts = []; let got = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(Buffer.from(value)); got += value.length; if (onProgress && total) onProgress(got / total); }
  return Buffer.concat(parts);
}
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
let checking = false;
async function checkUpdates(channel, force) {
  if (checking || UPDATE_BASE.startsWith('__')) return up;
  const BASE = UPDATE_BASE + (channel === 'beta' ? '/beta' : '');
  if (force) up.ready = null;
  checking = true; up.status = 'checking'; up.error = ''; sendUp();
  try {
    manifest = JSON.parse((await fetchBuf(BASE + '/manifest.json?t=' + Date.now())).toString('utf8'));
    const W = manifest.windows;
    up.app = W && cmpVer(W.version, app.getVersion()) > 0 ? { version: W.version, notes: W.notes || '', size: W.size || 0 } : null;
    const G = manifest.game, have = up.ready ? up.ready.version : loadedGame;
    const newer = force ? cmpVer(G && G.version, have) !== 0 : cmpVer(G && G.version, have) > 0;
    if (G && newer && cmpVer(app.getVersion(), G.minWindows || '0') >= 0) {
      up.status = 'downloading'; up.progress = 0; sendUp();
      const dir = path.join(gameRoot(), G.version), tmp = dir + '.part';
      fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
      const names = Object.keys(G.files), sizes = names.map(n => G.files[n].size || 1), total = sizes.reduce((a, b) => a + b, 0); let done = 0;
      for (let i = 0; i < names.length; i++) {
        const n = names[i], buf = await fetchBuf(BASE + '/game/' + n + '?v=' + G.version, p => { up.progress = (done + p * sizes[i]) / total; sendUp(); });
        if (sha256(buf) !== G.files[n].sha256) throw new Error('checksum mismatch in ' + n);
        fs.writeFileSync(path.join(tmp, n), buf); done += sizes[i];
      }
      fs.rmSync(dir, { recursive: true, force: true }); fs.renameSync(tmp, dir);
      fs.writeFileSync(path.join(gameRoot(), 'current.json'), JSON.stringify({ version: G.version, minWindows: G.minWindows || '0', bundled: cmpVer(G.version, bundledGameVersion()) <= 0 }));
      for (const d of fs.readdirSync(gameRoot())) if (d !== G.version && d !== loadedGame && d !== 'current.json') fs.rmSync(path.join(gameRoot(), d), { recursive: true, force: true });
      up.ready = { version: G.version, notes: G.notes || '' };
    }
    up.status = up.ready ? 'ready' : up.app ? 'app' : 'uptodate';
  } catch (e) { up.status = 'error'; up.error = String(e.message || e).slice(0, 80); }
  checking = false; sendUp(); return up;
}
function restartGame() { if (win) { up.ready = null; up.status = 'idle'; win.loadFile(gameEntry()); } }
async function installApp() {
  if (!manifest || !manifest.windows || !up.app) return up;
  const W = manifest.windows, resDir = process.resourcesPath, target = path.join(resDir, 'app.asar');
  const ofs = require('original-fs');   // plain fs: never treat .asar files as archives
  let writable = true; try { const t = path.join(resDir, '.skyflap-write-test'); ofs.writeFileSync(t, 'x'); ofs.unlinkSync(t); } catch (e) { writable = false; }
  if (process.platform !== 'win32' || !writable || !W.asar) { shell.openExternal(W.page || 'https://github.com'); return up; }
  try {
    up.status = 'installing'; up.progress = 0; sendUp();
    const buf = await fetchBuf(W.asar.url + '?v=' + W.version, p => { up.progress = p; sendUp(); });
    if (sha256(buf) !== W.asar.sha256) throw new Error('checksum mismatch');
    const work = ofs.mkdtempSync(path.join(os.tmpdir(), 'skyflap-upd-')), bin = path.join(work, 'app-update.bin'), ps1 = path.join(work, 'apply.ps1');
    ofs.writeFileSync(bin, buf);
    const q = s => "'" + s.replace(/'/g, "''") + "'";
    ofs.writeFileSync(ps1, [
      `Wait-Process -Id ${process.pid} -ErrorAction SilentlyContinue`, 'Start-Sleep -Seconds 1',
      'for ($i = 0; $i -lt 15; $i++) { try { Copy-Item -LiteralPath ' + q(bin) + ' -Destination ' + q(target) + ' -Force -ErrorAction Stop; break } catch { Start-Sleep -Seconds 1 } }',
      `Start-Process -FilePath ${q(process.execPath)}`,
      `Remove-Item -LiteralPath ${q(work)} -Recurse -Force -ErrorAction SilentlyContinue`
    ].join('\r\n'));
    spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', ps1], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    setTimeout(() => app.quit(), 300);
  } catch (e) { up.status = 'error'; up.error = String(e.message || e).slice(0, 80); sendUp(); }
  return up;
}
ipcMain.handle('up:info', () => up);
ipcMain.handle('up:check', (e, ch, force) => checkUpdates(ch, force));
ipcMain.handle('up:restart', () => restartGame());
ipcMain.handle('up:install', () => installApp());

ipcMain.handle('sd:get', () => info());
ipcMain.handle('sd:set', (e, o) => {
  if (o && o.mode) applyMode(o.mode);
  if (o && o.w && o.h) {
    cfg.w = Math.round(o.w); cfg.h = Math.round(o.h); saveCfg();
    if (cfg.mode === 'windowed' && win) { win.setFullScreen(false); win.setContentSize(cfg.w, cfg.h); win.center(); }
  }
  return info();
});

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => { loadCfg(); createWindow(); });
app.on('window-all-closed', () => app.quit());
