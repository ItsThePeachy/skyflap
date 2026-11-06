#!/bin/bash
# usage: build_apk.sh <update_base_url>   (game version read from skyflap.html)
set -e
BASE="$1"; P=/home/claude/apk/proj; AJ=/usr/lib/android-sdk/platforms/android-23/android.jar
GV=$(grep -o "SKYFLAP_GAME_VERSION='[^']*'" /home/claude/skyflap.html | head -1 | cut -d"'" -f2)
cd $P && cp /home/claude/skyflap.html assets/index.html && cp /home/claude/sounds.js assets/sounds.js
rm -rf build && mkdir -p build/classes build/gen build/src/com/skyflap/game
for f in src/com/skyflap/game/*.java; do sed "s#__UPDATE_BASE__#$BASE#; s#__GAME_VERSION__#$GV#" "$f" > build/src/com/skyflap/game/$(basename $f); done
aapt package -f -m -J build/gen -M AndroidManifest.xml -S res -I $AJ >/dev/null
javac -nowarn -source 8 -target 8 -bootclasspath $AJ -d build/classes build/gen/com/skyflap/game/R.java build/src/com/skyflap/game/*.java 2>&1 | grep -vE "warning|^Picked|bootstrap|^Note|^[0-9]+ warning" || true
dalvik-exchange --dex --output=build/classes.dex build/classes
aapt package -f -M AndroidManifest.xml -S res -A assets -I $AJ -F build/unsigned.apk -0 arsc >/dev/null
(cd build && aapt add unsigned.apk classes.dex >/dev/null)
zipalign -p -f 4 build/unsigned.apk build/aligned.apk
apksigner sign --ks ../skyflap.jks --ks-key-alias skyflap --ks-pass pass:"$KEYSTORE_PASS" --key-pass pass:"$KEYSTORE_PASS" --out ../Skyflap.apk build/aligned.apk 2>&1 | grep -v Picked || true
apksigner verify ../Skyflap.apk 2>&1 | grep -v Picked || true
echo "built: game $GV, $(aapt dump badging ../Skyflap.apk | grep -o "versionName='[^']*'"), base=$BASE"
