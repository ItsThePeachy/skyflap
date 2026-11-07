// Skyflap offline service worker. Bump = new cache = update available.
const CH='beta',V='1.9.4-d8334d00',CACHE='skyflap-'+CH+'-'+V,FILES=["./", "index.html", "sounds.js", "calls.js", "manifest.webmanifest", "version.json", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png"];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.map(f=>new Request(f,{cache:'reload'}))))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE&&(x.startsWith('skyflap-'+CH+'-')||/^skyflap-\d/.test(x))).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data==='skipWaiting')self.skipWaiting();});
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin)return;
  if(u.pathname.endsWith('/version.json'))return; // always fresh
  e.respondWith(caches.open(CACHE).then(c=>c.match(r,{ignoreSearch:true}).then(hit=>hit||fetch(r).catch(()=>c.match('index.html')))));
});
