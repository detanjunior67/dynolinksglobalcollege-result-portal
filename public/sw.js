const APP_CACHE_PREFIX = 'dynolinks-portal-cache';
const APP_CACHE_NAME = `${APP_CACHE_PREFIX}-${Date.now()}`;
const TEACHER_CACHE_NAME = 'dynolinks-teacher-offline-v10';
importScripts('/teacher-offline.js');

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE_NAME).then((cache) => cache.addAll([
      '/',
      '/index.html',
      '/manifest.json',
      '/teacher-manifest.json',
      '/logo.jpg',
      '/logo-transparent.png',
      '/student.jpg',
      '/cbt.html',
      '/portal.html',
      '/teacher.html',
      '/app.js',
      '/style.css',
      '/dgc-loader.css',
      '/device-detector.js',
      '/password-controls.js',
      '/teacher-offline.js'
    ]))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith(APP_CACHE_PREFIX) && key !== APP_CACHE_NAME)
        .map((key) => caches.delete(key))
    )).then(() => Promise.all([
      caches.delete('dynolinks-teacher-offline'),
      caches.delete('dynolinks-teacher-offline-v2'),
      caches.delete('dynolinks-teacher-offline-v3'),
      caches.delete('dynolinks-teacher-offline-v4'),
      caches.delete('dynolinks-teacher-offline-v5'),
      caches.delete('dynolinks-teacher-offline-v6'),
      caches.delete('dynolinks-teacher-offline-v7'),
      caches.delete('dynolinks-teacher-offline-v8'),
      caches.delete('dynolinks-teacher-offline-v9')
    ]))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'teacher-attendance-sync') {
    event.waitUntil(self.TeacherOfflineQueue.syncPending());
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (event.request.mode === 'navigate' && requestUrl.pathname === '/teacher.html') {
    event.respondWith((async () => {
      const teacherCache = await caches.open(TEACHER_CACHE_NAME);
      const cached = await teacherCache.match('/teacher.html');
      if (cached && cached.ok && new URL(cached.url).pathname === '/teacher.html') return cached;
      if (cached) await teacherCache.delete('/teacher.html');
      try {
        const response = await fetch(event.request, { cache: 'no-store' });
        if (response.ok && new URL(response.url).pathname === '/teacher.html') {
          await teacherCache.put('/teacher.html', response.clone());
          return response;
        }
        return Response.redirect(new URL('/?protected=teacher&returnTo=%2Fteacher.html', self.location.origin), 302);
      } catch (_) {
        return new Response('Teacher check-in is not available offline yet. Open this page online once to prepare it for offline use.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })());
    return;
  }

  if (requestUrl.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((response) => {
          const clone = response.clone();
          caches.open(APP_CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((response) => {
        const clone = response.clone();
        caches.open(APP_CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/index.html')))
  );
});
