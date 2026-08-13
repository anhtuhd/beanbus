const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
};

function workerSource() {
  if (process.env.NEXT_PUBLIC_ENABLE_WEB_PUSH !== 'true') {
    return "self.addEventListener('install', () => self.skipWaiting());";
  }
  return `
importScripts('https://www.gstatic.com/firebasejs/12.17.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.17.1/firebase-messaging-compat.js');

firebase.initializeApp(${JSON.stringify(firebaseConfig)});
const messaging = firebase.messaging();
const fallbackHref = '/';
const allowedPaths = ['/', '/about', '/account', '/admin/orders', '/admin/requests', '/blog', '/contact', '/events', '/menu', '/notifications', '/order/guest'];

function safeHref(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\\\')) return fallbackHref;
  try {
    const url = new URL(value, self.location.origin);
    if (url.origin !== self.location.origin) return fallbackHref;
    return allowedPaths.some((prefix) => url.pathname === prefix || (prefix !== '/' && url.pathname.startsWith(prefix + '/')))
      ? url.pathname + url.search + url.hash
      : fallbackHref;
  } catch {
    return fallbackHref;
  }
}

messaging.onBackgroundMessage(async (payload) => {
  const data = payload.data || {};
  const english = (self.navigator.language || 'vi').toLowerCase().startsWith('en');
  const title = english ? data.titleEn : data.titleVi;
  const body = english ? data.bodyEn : data.bodyVi;
  if (typeof title !== 'string' || typeof body !== 'string') return;
  const href = safeHref(data.href);
  await self.registration.showNotification(title.slice(0, 180), {
    body: body.slice(0, 240),
    data: { href },
    icon: '/brand/images/icon-b.png',
    badge: '/brand/images/icon-b.png',
    tag: typeof data.tag === 'string' ? data.tag.slice(0, 255) : undefined,
  });
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  clients.forEach((client) => client.postMessage({ type: 'beanbus:fcm-message' }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const href = safeHref(event.notification.data && event.notification.data.href);
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    const client = clients.find((candidate) => 'focus' in candidate);
    if (client) {
      await client.focus();
      if ('navigate' in client) await client.navigate(href);
      return;
    }
    await self.clients.openWindow(href);
  })());
});
`;
}

export async function GET() {
  return new Response(workerSource(), {
    headers: {
      'cache-control': 'no-cache, no-store, must-revalidate',
      'content-security-policy': "default-src 'self'; script-src 'self' https://www.gstatic.com; connect-src https://fcmregistrations.googleapis.com https://firebaseinstallations.googleapis.com https://fcm.googleapis.com",
      'content-type': 'application/javascript; charset=utf-8',
      'service-worker-allowed': '/',
      'x-content-type-options': 'nosniff',
    },
  });
}
