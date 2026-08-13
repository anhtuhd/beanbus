'use client';

type PushStatus = 'denied' | 'disabled' | 'enabled' | 'error' | 'prompt' | 'unsupported';

type FirebaseRuntime = {
  messaging: import('firebase/messaging').Messaging;
  unregister: typeof import('firebase/messaging').unregister;
};

let runtimePromise: Promise<FirebaseRuntime> | null = null;
let currentFid: string | null = null;

const webPushEnabled = process.env.NEXT_PUBLIC_ENABLE_WEB_PUSH === 'true';

function isSafariOrIos(): boolean {
  const userAgent = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(userAgent) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/.test(userAgent);
  return isIos || isSafari;
}

function locale(): 'en' | 'vi' {
  return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'vi';
}

function notifyStatus(status: PushStatus) {
  window.dispatchEvent(new CustomEvent('beanbus:push-status', { detail: { status } }));
}

async function syncInstallation(fid: string) {
  currentFid = fid;
  try {
    window.sessionStorage.setItem('beanbus_fcm_fid', fid);
  } catch {
    // Storage may be unavailable in privacy-restricted browsers.
  }
  const response = await fetch('/api/push/installations', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fid, locale: locale() }),
  });
  if (!response.ok) throw new Error('INSTALLATION_SYNC_FAILED');
  notifyStatus('enabled');
}

async function unlinkInstallation(fid: string) {
  await fetch('/api/push/installations', {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fid }),
  }).catch(() => undefined);
  if (currentFid === fid) currentFid = null;
  try {
    if (window.sessionStorage.getItem('beanbus_fcm_fid') === fid) window.sessionStorage.removeItem('beanbus_fcm_fid');
  } catch {
    // Storage may be unavailable in privacy-restricted browsers.
  }
  notifyStatus(Notification.permission === 'denied' ? 'denied' : 'prompt');
}

export function currentWebPushFid(): string | null {
  if (currentFid) return currentFid;
  try {
    return window.sessionStorage.getItem('beanbus_fcm_fid');
  } catch {
    return null;
  }
}

async function runtime(): Promise<FirebaseRuntime> {
  if (runtimePromise) return runtimePromise;
  runtimePromise = (async () => {
    const [{ getApp, getApps, initializeApp }, messagingModule] = await Promise.all([
      import('firebase/app'),
      import('firebase/messaging'),
    ]);
    if (!await messagingModule.isSupported()) throw new Error('WEB_PUSH_UNSUPPORTED');

    const appName = 'beanbus-web-push';
    const firebaseApp = getApps().some((app) => app.name === appName) ? getApp(appName) : initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    }, appName);
    const messaging = messagingModule.getMessaging(firebaseApp);
    messagingModule.onRegistered(messaging, (fid) => {
      void syncInstallation(fid).catch(() => notifyStatus('error'));
    });
    messagingModule.onUnregistered(messaging, (fid) => void unlinkInstallation(fid));
    messagingModule.onMessage(messaging, (payload) => {
      window.dispatchEvent(new CustomEvent('beanbus:fcm-message', { detail: payload.data ?? {} }));
    });
    return { messaging, unregister: messagingModule.unregister };
  })().catch((error) => {
    runtimePromise = null;
    throw error;
  });
  return runtimePromise;
}

async function registerCurrentBrowser() {
  const { messaging } = await runtime();
  const serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
    scope: '/',
  });
  const { register } = await import('firebase/messaging');
  await register(messaging, {
    serviceWorkerRegistration,
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
  });
}

export async function webPushStatus(): Promise<PushStatus> {
  if (!webPushEnabled) return 'disabled';
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator) || isSafariOrIos()) {
    return 'unsupported';
  }
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'default') return 'prompt';
  try {
    await registerCurrentBrowser();
    return 'enabled';
  } catch {
    return 'error';
  }
}

export async function enableWebPush(): Promise<PushStatus> {
  if (!webPushEnabled || typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator) || isSafariOrIos()) {
    return 'unsupported';
  }
  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission()
    : Notification.permission;
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'prompt';
  try {
    await registerCurrentBrowser();
    return 'enabled';
  } catch {
    return 'error';
  }
}

export async function disableWebPush(): Promise<PushStatus> {
  try {
    const current = await runtime();
    await current.unregister(current.messaging);
    if (currentFid) await unlinkInstallation(currentFid);
    return Notification.permission === 'denied' ? 'denied' : 'prompt';
  } catch {
    return 'error';
  }
}

export type { PushStatus };
