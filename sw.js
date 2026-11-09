/* MBD autonome : fonctionne hors ligne. Version du cache à changer à chaque mise à jour de l'app. */
var V = 'mbd-v3';
var SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(V).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });

function blobFor(id) {
  return new Promise(function (res) {
    var r = indexedDB.open('mbd', 1);
    r.onupgradeneeded = function () { var d = r.result; if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv'); if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs'); };
    r.onerror = function () { res(null); };
    r.onsuccess = function () { var g = r.result.transaction('blobs', 'readonly').objectStore('blobs').get(id); g.onsuccess = function () { res(g.result || null); }; g.onerror = function () { res(null); }; };
  });
}

self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (u.origin === location.origin && u.pathname.indexOf('/_blob/') >= 0) {
    e.respondWith(blobFor(u.pathname.slice(u.pathname.lastIndexOf('/_blob/') + 7)).then(function (v) { return v ? new Response(v.blob, { headers: { 'Content-Type': v.type || 'application/octet-stream' } }) : new Response('', { status: 404 }); }));
    return;
  }
  if (e.request.method !== 'GET') return;
  if (u.origin === location.origin) {
    /* page et fichiers de l'app : réseau d'abord (mises à jour), sinon copie locale */
    e.respondWith(fetch(e.request).then(function (r) { var cp = r.clone(); caches.open(V).then(function (c) { c.put(e.request, cp); }); return r; }).catch(function () { return caches.match(e.request).then(function (m) { return m || caches.match(new URL('index.html', self.registration.scope).href); }); }));
    return;
  }
  /* polices et autres ressources externes : copie locale d'abord */
  e.respondWith(caches.match(e.request).then(function (m) { return m || fetch(e.request).then(function (r) { var cp = r.clone(); caches.open(V).then(function (c) { c.put(e.request, cp); }); return r; }).catch(function () { return new Response('', { status: 504 }); }); }));
});
