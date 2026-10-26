// RoutineNote 서비스워커: 한 번 열어본 화면은 오프라인에서도 열리게 캐시한다.
const cacheName = 'routinenote-v1';
const appShell = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(appShell)));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(names.filter((name) => name !== cacheName).map((name) => caches.delete(name)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    // 서버 API와 카카오 지도 데이터는 캐시하지 않고 항상 네트워크로 보낸다
    if (url.pathname.startsWith('/api') || url.hostname.endsWith('kakao.com') || url.hostname.endsWith('daumcdn.net') || url.hostname === 'localhost' && url.port === '3000') return;
    // 네트워크 우선, 실패하면 캐시 (수정한 코드가 바로 반영되도록)
    event.respondWith(
        fetch(request)
            .then((response) => {
                const copy = response.clone();
                caches.open(cacheName).then((cache) => cache.put(request, copy));
                return response;
            })
            .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
    );
});
