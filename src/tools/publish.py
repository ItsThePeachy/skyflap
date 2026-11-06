# usage: publish.py <android_version> <android_versionCode> <windows_version> "<notes>"
import hashlib,json,os,shutil,subprocess,sys,re
AV,AC,WV,NOTES=sys.argv[1],int(sys.argv[2]),sys.argv[3],sys.argv[4]
R='/home/claude/skyflap';RAW='https://raw.githubusercontent.com/ItsThePeachy/skyflap/main/updates'
u=os.path.join(R,'updates');os.makedirs(u+'/game',exist_ok=True);os.makedirs(u+'/android',exist_ok=True);os.makedirs(u+'/windows',exist_ok=True)
def put(src,dst):
    shutil.copy(src,os.path.join(u,dst));b=open(src,'rb').read();return {'sha256':hashlib.sha256(b).hexdigest(),'size':len(b)}
html=open('/home/claude/skyflap.html',encoding='utf8').read();GV=re.search(r"SKYFLAP_GAME_VERSION='([^']+)'",html).group(1)
files={'index.html':put('/home/claude/skyflap.html','game/index.html'),'sounds.js':put('/home/claude/sounds.js','game/sounds.js')}
apk=put('/home/claude/Skyflap.apk','android/Skyflap.apk');asar=put('/home/claude/exe/dist/Skyflap/resources/app.asar','windows/app.asar')
m={'game':{'version':GV,'notes':NOTES,'minAndroid':6,'minWindows':'1.5.0','files':files},
   'android':dict(version=AV,versionCode=AC,notes=NOTES,url=RAW+'/android/Skyflap.apk',**apk),
   'windows':{'version':WV,'notes':NOTES,'asar':dict(url=RAW+'/windows/app.asar',**asar),'page':'https://github.com/ItsThePeachy/skyflap'}}
json.dump(m,open(u+'/manifest.json','w'),indent=1)
g=lambda *a:subprocess.run(['git','-C',R,*a],check=True,capture_output=True,text=True).stdout
g('add','-A');g('-c','user.name=Claude','-c','user.email=noreply@anthropic.com','commit','-q','-m',f'Skyflap game {GV} (Android {AV}, Windows {WV})\n\n{NOTES}\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_017g3pGNqoVMct35XZ2D8n8V')
g('fetch','origin','main');print(subprocess.run(['git','-C',R,'push','origin','HEAD:main'],capture_output=True,text=True).stderr.strip().splitlines()[-1])
print('published game',GV,'android',AV,AC,'windows',WV)
