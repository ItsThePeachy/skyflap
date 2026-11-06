# Skyflap

A Flappy-Bird-style game with 17 real bird species, volumetric lighting, water reflections and forest ambience.

## Play
- **iPhone / iPad:** open **https://itsthepeachy.github.io/skyflap/** in Safari → Share → **Add to Home Screen**. After the first open it runs fully offline and updates itself.
- **Any browser:** same link.

## Download
- **Android:** [Skyflap.apk](updates/android/Skyflap.apk) (tap *View raw* / *Download*).
- **Windows:** the full Skyflap-Windows.zip is shared directly (it's too big for a repo file). After the first install, the app updates itself from this repo.

## How updates work
- `updates/manifest.json` describes the latest game and app versions.
- `updates/game/` holds the game files. The Android and Windows apps download these in the background (SHA-256 verified) and apply them on the next start, no reinstall needed.
- `updates/android/Skyflap.apk` and `updates/windows/app.asar` are full app updates; the apps offer to install them (Windows swaps only its ~1.5 MB app package, not the whole runtime).

## Credits
All sounds are CC0 / public domain (kvgarlic, felix.blume, gluckose via Blanket; Lisa Redfern; Kenney; Ben Burnes). Font: Outfit (SIL Open Font License).
