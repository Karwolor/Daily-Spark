const CACHE = 'dailyspark-v6';
const ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/assets/css/output.css',
    '/assets/js/app.js',
    '/assets/js/firebase.js',
    '/assets/js/ai.js',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-512.png'
];

// Import Firebase Messaging scripts for background messages
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Initialize Firebase in SW
const firebaseConfig = {
    apiKey: "AIzaSyBzn9VJWfk01mXpjc6M4k9Dm2NM44DTdwk",
    authDomain: "dailyspark-abdc9.firebaseapp.com",
    projectId: "dailyspark-abdc9",
    storageBucket: "dailyspark-abdc9.firebasestorage.app",
    messagingSenderId: "320461349595",
    appId: "1:320461349595:web:55231cda846c94672be2fe",
    measurementId: "G-8BQ3C4ZGSN"
};
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/assets/icons/icon-192.png'
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    const { request } = e;
    if (request.method !== 'GET') return;
    e.respondWith(
        caches.match(request).then(cached => cached || fetch(request).then(resp => {
            const copy = resp.clone();
            caches.open(CACHE).then(c => c.put(request, copy)).catch(() => { });
            return resp;
        }).catch(() => cached))
    );
});
