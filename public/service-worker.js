self.addEventListener('install', e => {
    console.log('Service Worker Installed');
    e.waitUntil(
        caches.open('private-chat-cache').then(cache => {
            return cache.addAll([
                '/',
                '/css/style.css',
                '/socket.io/socket.io.js',
                '/images/icon-192.png',
                '/images/icon-512.png'
            ]);
        })
    );
});

self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request).then(response => {
            return response || fetch(e.request);
        })
    );
});
