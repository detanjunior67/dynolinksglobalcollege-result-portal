const APP_CACHE_PREFIX = 'dynolinks-portal-cache';
const APP_CACHE_NAME = `${APP_CACHE_PREFIX}-${Date.now()}`;
const TEACHER_CACHE_NAME = 'dynolinks-teacher-offline-v14';
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
      '/teacher-offline.js',
      '/node_modules/exceljs/dist/exceljs.min.js'
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
      caches.delete('dynolinks-teacher-offline-v9'),
      caches.delete('dynolinks-teacher-offline-v10'),
      caches.delete('dynolinks-teacher-offline-v11'),
      caches.delete('dynolinks-teacher-offline-v12'),
      caches.delete('dynolinks-teacher-offline-v13')
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

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) {}
  const title = payload.title || 'College announcement';
  const actions = Array.isArray(payload.actions) ? payload.actions.slice(0, 2).map((action) => ({
    action: String(action.action || 'open'),
    title: String(action.title || action.action || 'Open')
  })) : [];
  const options = {
    body: payload.body || 'A new announcement is available.',
    icon: '/logo.jpg',
    badge: '/logo.jpg',
    tag: payload.notificationType === 'class-session'
      ? `class-session-${payload.startClientRequestId || payload.teacherName || 'new'}`
      : `teacher-announcement-${payload.announcementId || 'new'}`,
    actions,
    data: {
      url: payload.url || '/teacher.html',
      announcementId: payload.announcementId || '',
      teacherName: payload.teacherName || '',
      startClientRequestId: payload.startClientRequestId || '',
      className: payload.className || '',
      subject: payload.subject || ''
    }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const payload = event.notification.data || {};
  const target = new URL(payload.url || '/teacher.html', self.location.origin);

  if (event.action === 'end-class') {
    const teacherName = payload.teacherName || '';
    const startClientRequestId = payload.startClientRequestId || '';
    if (teacherName && startClientRequestId) {
      fetch('/api/teacher/class-sessions/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: teacherName,
          startClientRequestId,
          endedAt: new Date().toISOString()
        })
      }).catch(() => {});
    }
  }

  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
    const teacherClient = clients.find(client => {
      const clientUrl = new URL(client.url);
      return clientUrl.origin === target.origin && clientUrl.pathname === '/teacher.html';
    });
    if (teacherClient) {
      await teacherClient.focus();
      teacherClient.postMessage({ type: 'OPEN_TEACHER_ANNOUNCEMENTS', announcementId: payload.announcementId || '' });
      return;
    }
    await self.clients.openWindow(target.href);
  }));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (event.request.mode === 'navigate' && requestUrl.pathname === '/teacher.html') {
    event.respondWith((async () => {
      const teacherCache = await caches.open(TEACHER_CACHE_NAME);
      const cached = await teacherCache.match('/teacher.html');
      const validCachedPage = cached?.ok && new URL(cached.url).pathname === '/teacher.html' ? cached : null;
      if (cached && !validCachedPage) await teacherCache.delete('/teacher.html');
      try {
        const response = await fetch(event.request, { cache: 'no-store' });
        if (response.ok && new URL(response.url).pathname === '/teacher.html') {
          await teacherCache.put('/teacher.html', response.clone());
          return response;
        }
        if (validCachedPage) return validCachedPage;
        return Response.redirect(new URL('/?protected=teacher&returnTo=%2Fteacher.html', self.location.origin), 302);
      } catch (_) {
        if (validCachedPage) return validCachedPage;
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
