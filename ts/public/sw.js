/* Главный пёс — service worker: офлайн-кэш (v2.0.0 TS) */
const C='topdog-v200';
const ASSETS=['./','index.html','game.css','assets/index-BR2nvOa5.js','discord-sdk.mjs'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(C).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(url.origin!==location.origin)return; // telegram-скрипт и шрифты — напрямую из сети
  e.respondWith(
    caches.match(e.request).then(r=>{
      if(r)return r;
      return fetch(e.request).then(resp=>{
        if(resp&&resp.ok){const cl=resp.clone();caches.open(C).then(c=>c.put(e.request,cl));}
        return resp;
      }).catch(()=>caches.match('./'));
    })
  );
});
