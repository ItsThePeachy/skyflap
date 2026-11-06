# usage: publish.py <android_version> <android_versionCode> <windows_version> "<notes>"
import hashlib,json,os,shutil,subprocess,sys,re
AV,AC,WV,NOTES=sys.argv[1],int(sys.argv[2]),sys.argv[3],sys.argv[4]
R=os.environ.get('PUBR','/home/claude/skyflap');DRY=os.environ.get('DRY')=='1';BETA=os.environ.get('CHANNEL')=='beta'
RAW='https://raw.githubusercontent.com/ItsThePeachy/skyflap/main/updates'+('/beta' if BETA else '')
u=os.path.join(R,'updates','beta') if BETA else os.path.join(R,'updates');os.makedirs(u+'/game',exist_ok=True);os.makedirs(u+'/android',exist_ok=True);os.makedirs(u+'/windows',exist_ok=True)
def put(src,dst):
    shutil.copy(src,os.path.join(u,dst));b=open(src,'rb').read();return {'sha256':hashlib.sha256(b).hexdigest(),'size':len(b)}
html=open('/home/claude/skyflap.html',encoding='utf8').read();GV=re.search(r"SKYFLAP_GAME_VERSION='([^']+)'",html).group(1)
files={'index.html':put('/home/claude/skyflap.html','game/index.html'),'sounds.js':put('/home/claude/sounds.js','game/sounds.js')}
apk=put('/home/claude/Skyflap.apk','android/Skyflap.apk');asar=put('/home/claude/exe/dist/Skyflap/resources/app.asar','windows/app.asar')
m={'game':{'version':GV,'notes':NOTES,'minAndroid':6,'minWindows':'1.5.0','files':files},
   'android':dict(version=AV,versionCode=AC,notes=NOTES,url=RAW+'/android/Skyflap.apk',**apk),
   'windows':{'version':WV,'notes':NOTES,'asar':dict(url=RAW+'/windows/app.asar',**asar),'page':'https://github.com/ItsThePeachy/skyflap'}}
json.dump(m,open(u+'/manifest.json','w'),indent=1)
# ---------- iPhone / web: installable offline web app at the repo root (GitHub Pages) ----------
def build_pwa():
    head=('<link rel="manifest" href="manifest.webmanifest">\n<meta name="theme-color" content="#02040c">\n'
          '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n'
          '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n<meta name="apple-mobile-web-app-title" content="Skyflap">\n'
          '<link rel="apple-touch-icon" href="icons/icon-180.png">\n<link rel="icon" href="icons/icon-192.png">\n<script>window.SKYFLAP_PWA=true;</script>\n')
    h=html.replace('<title>Skyflap</title>','<title>Skyflap</title>\n'+head,1)
    W=os.path.join(R,'beta') if BETA else R
    os.makedirs(W,exist_ok=True)
    if BETA: shutil.copytree(os.path.join(R,'icons'),os.path.join(W,'icons'),dirs_exist_ok=True)
    open(os.path.join(W,'index.html'),'w',encoding='utf8').write(h)
    shutil.copy('/home/claude/sounds.js',os.path.join(W,'sounds.js'))
    json.dump({'name':'Skyflap Test' if BETA else 'Skyflap','short_name':'Skyflap β' if BETA else 'Skyflap','description':"A bird's journey",'start_url':'./','scope':'./','display':'fullscreen',
               'orientation':'portrait','background_color':'#02040c','theme_color':'#02040c',
               'icons':[{'src':'icons/icon-192.png','sizes':'192x192','type':'image/png'},{'src':'icons/icon-512.png','sizes':'512x512','type':'image/png'},
                        {'src':'icons/maskable-512.png','sizes':'512x512','type':'image/png','purpose':'maskable'}]},
              open(os.path.join(W,'manifest.webmanifest'),'w'),indent=1)
    json.dump({'version':GV,'notes':NOTES},open(os.path.join(W,'version.json'),'w'))
    files=['./','index.html','sounds.js','manifest.webmanifest','version.json','icons/icon-180.png','icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png']
    sw=f"""// Skyflap offline service worker. Bump = new cache = update available.
const CH='{'beta' if BETA else 'stable'}',V='{GV}-{hashlib.sha256(h.encode()).hexdigest()[:8]}',CACHE='skyflap-'+CH+'-'+V,FILES={json.dumps(files)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.map(f=>new Request(f,{{cache:'reload'}}))))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE&&(x.startsWith('skyflap-'+CH+'-')||/^skyflap-\\d/.test(x))).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{{if(e.data==='skipWaiting')self.skipWaiting();}});
self.addEventListener('fetch',e=>{{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin)return;
  if(u.pathname.endsWith('/version.json'))return; // always fresh
  e.respondWith(caches.open(CACHE).then(c=>c.match(r,{{ignoreSearch:true}}).then(hit=>hit||fetch(r).catch(()=>c.match('index.html')))));
}});
"""
    open(os.path.join(W,'sw.js'),'w').write(sw)
    open(os.path.join(R,'.nojekyll'),'w').write('')

build_pwa()
if DRY:
    print('dry run: wrote',R);sys.exit(0)
g=lambda *a:subprocess.run(['git','-C',R,*a],check=True,capture_output=True,text=True).stdout
g('add','-A');g('-c','user.name=Claude','-c','user.email=noreply@anthropic.com','commit','-q','-m',f'{"TEST " if BETA else ""}Skyflap game {GV} (Android {AV}, Windows {WV})\n\n{NOTES}\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_017g3pGNqoVMct35XZ2D8n8V')
g('fetch','origin','main');print(subprocess.run(['git','-C',R,'push','origin','HEAD:main'],capture_output=True,text=True).stderr.strip().splitlines()[-1])
print('published game',GV,'android',AV,AC,'windows',WV)

