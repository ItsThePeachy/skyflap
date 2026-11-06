// Skyflap Windows bootstrap. Loads the newest verified app code: either the copy bundled with this install or a
// hot-updated copy in %APPDATA%/Skyflap/appcode/<version> (no files in the install folder are ever replaced).
const path = require('path'), fs = require('fs'), { app } = require('electron');
const cmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0 ? 1 : -1; } return 0; };
global.SKYFLAP_BASE = __dirname; global.SKYFLAP_APPVER = app.getVersion(); global.SKYFLAP_BOOT = null;
let main = path.join(__dirname, 'main.js');
try {
  const root = path.join(app.getPath('userData'), 'appcode'), cur = JSON.parse(fs.readFileSync(path.join(root, 'current.json'), 'utf8'));
  const dir = path.join(root, cur.version), bootF = path.join(root, 'boot.json');
  let boot = {}; try { boot = JSON.parse(fs.readFileSync(bootF, 'utf8')); } catch (e) {}
  const fails = boot.v === cur.version ? boot.fails || 0 : 0;
  if (cmp(cur.version, app.getVersion()) > 0 && fails < 2 && fs.existsSync(path.join(dir, 'main.js')) && fs.existsSync(path.join(dir, 'preload.js'))) {
    fs.writeFileSync(bootF, JSON.stringify({ v: cur.version, fails: fails + 1 }));   // cleared once the window has loaded
    main = path.join(dir, 'main.js'); global.SKYFLAP_APPVER = cur.version; global.SKYFLAP_BOOT = bootF;
  }
} catch (e) {}
try { require(main); } catch (e) { if (main !== path.join(__dirname, 'main.js')) { global.SKYFLAP_APPVER = app.getVersion(); global.SKYFLAP_BOOT = null; require(path.join(__dirname, 'main.js')); } else throw e; }
