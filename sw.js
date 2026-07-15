/* Le Protocole — service worker
   Objectif : l'app s'ouvre à la salle même sans réseau (sous-sol), tout en restant à jour dès qu'il y en a. */
var CACHE = 'protocole-v4';
var CORE = ['./', './index.html', './manifest.json'];
var FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  /* le document : réseau d'abord (toujours la dernière version), cache si hors ligne */
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (r) { return r || caches.match('./'); });
      })
    );
    return;
  }

  /* Polices : cache d'abord — elles ne changent jamais et l'app doit garder sa typo
     hors ligne. Le <link> porte crossorigin="anonymous" : sans lui la réponse est
     opaque, c.put() la rejette silencieusement, et le cache restait vide malgré
     ce commentaire — hors ligne, retour à Arial. On ne met en cache qu'une
     réponse réellement lisible, et l'échec du put ne casse pas la requête. */
  if (FONT_HOSTS.indexOf(url.hostname) >= 0) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) {
          if (res && res.ok && res.type !== 'opaque') {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) {
              return c.put(req, copy);
            }).catch(function () {});
          }
          return res;
        }).catch(function () { return hit; });
      })
    );
    return;
  }

  if (url.origin !== location.origin) return;

  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
