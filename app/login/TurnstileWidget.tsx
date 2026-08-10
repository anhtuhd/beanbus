'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback': () => void;
          'error-callback': () => void;
          'response-field': false;
          theme: 'light';
        }
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

export default function TurnstileWidget({ siteKey }: { siteKey: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(() => typeof window !== 'undefined' && Boolean(window.turnstile));
  const [token, setToken] = useState('');

  useEffect(() => {
    if (!ready || !window.turnstile || !containerRef.current) return;

    const widgetId = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: setToken,
      'expired-callback': () => setToken(''),
      'error-callback': () => setToken(''),
      'response-field': false,
      theme: 'light',
    });

    return () => window.turnstile?.remove(widgetId);
  }, [ready, siteKey]);

  return (
    <>
      <Script
        id="cloudflare-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      />
      <div ref={containerRef} />
      <input type="hidden" name="cf-turnstile-response" value={token} />
    </>
  );
}
