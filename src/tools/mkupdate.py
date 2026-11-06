# Build an update folder: updates/manifest.json + updates/game/*
import hashlib,json,os,shutil,sys,re
out=sys.argv[1]; html=sys.argv[2]; snd=sys.argv[3]; notes=sys.argv[4] if len(sys.argv)>4 else ''
extra=json.loads(sys.argv[5]) if len(sys.argv)>5 else {}
src=open(html,encoding='utf8').read(); ver=re.search(r"SKYFLAP_GAME_VERSION='([^']+)'",src).group(1)
g=os.path.join(out,'game'); os.makedirs(g,exist_ok=True)
files={}
for name,p in [('index.html',html),('sounds.js',snd)]:
    shutil.copy(p,os.path.join(g,name)); b=open(p,'rb').read(); files[name]={'sha256':hashlib.sha256(b).hexdigest(),'size':len(b)}
m={'game':{'version':ver,'notes':notes,'minAndroid':6,'minWindows':'1.5.0','files':files}}
m.update(extra)
json.dump(m,open(os.path.join(out,'manifest.json'),'w'),indent=1);print('manifest game',ver)
