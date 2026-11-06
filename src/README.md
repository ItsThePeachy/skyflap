# Building Skyflap

- `../updates/game/index.html` + `sounds.js` are the game itself (a single-file HTML5 canvas game).
- `android/` is the WebView shell (Java, no Gradle). It's built with aapt, javac, dalvik-exchange, zipalign and apksigner; see `tools/build_apk.sh`.
  **The signing keystore and its password are NOT in this repo.** Keep `skyflap.jks` somewhere safe: Android only accepts updates signed with the same key. Set `KEYSTORE_PASS` before building.
- `windows/` is the Electron shell (main process, preload, display modes, updater). See `tools/build_win.sh` (Electron 45 win32-x64 + resedit).
- `tools/publish.py` writes `updates/manifest.json`, copies the game, APK and `app.asar` into `updates/`, then commits and pushes.
