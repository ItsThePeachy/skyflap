#!/bin/bash
# usage: build_win.sh <update_base_url> <app_version e.g. 1.5.0>
set -e
BASE="$1"; AV="$2"; E=/home/claude/exe
cd $E && rm -rf stage && cp -r appsrc stage
cp /home/claude/skyflap.html stage/index.html && cp /home/claude/sounds.js stage/sounds.js
sed -i "s#'__UPDATE_BASE__'#'$BASE'#" stage/main.js
python3 - "$AV" <<'PY'
import json,sys;p='/home/claude/exe/stage/package.json';d=json.load(open(p));d['version']=sys.argv[1];json.dump(d,open(p,'w'),indent=2)
PY
npx asar pack stage dist/Skyflap/resources/app.asar
npx resedit --in dist/Skyflap/Skyflap.exe --out dist/Skyflap/Skyflap.exe --file-version $AV.0 --product-version $AV.0 >/dev/null
cd dist && rm -f /home/claude/Skyflap-Windows.zip && zip -q -r -9 /home/claude/Skyflap-Windows.zip Skyflap
echo "built windows $AV base=$BASE $(du -h /home/claude/Skyflap-Windows.zip | cut -f1)"
