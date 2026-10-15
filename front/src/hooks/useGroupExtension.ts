import { useEffect, useRef, useState } from 'react';

// Talks to the "שרון נכסים - פרסום בקבוצות" Chrome extension (see /extension)
// through window messages, which its bridge script relays.
const TO_EXT = 'sharon-admin';
const FROM_EXT = 'sharon-ext';

export type ExtensionResult =
  | { status: 'filled'; textOk: boolean; imagesAdded: number }
  | { status: 'posted' }
  | { status: 'limit'; reason: 'daily_cap' | 'too_soon' | 'paused'; until?: number; cap?: number }
  | { status: 'no_brokers' | 'warning' | 'skipped' | 'error'; message?: string };

export interface ExtensionInfo {
  version: string;
  count: number;
  settings: { dailyCap: number; minGapMinutes: number; devMode?: boolean };
  nextAllowedAt: number;
  pausedUntil: number;
}

export function useGroupExtension(onResult: (jobId: string, result: ExtensionResult) => void) {
  const [info, setInfo] = useState<ExtensionInfo | null>(null);
  const handler = useRef(onResult);
  handler.current = onResult;

  useEffect(() => {
    const ping = () => window.postMessage({ source: TO_EXT, type: 'PING' }, window.location.origin);
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.data?.source !== FROM_EXT) return;
      const { type, jobId, ...rest } = event.data;
      if (type === 'HELLO') ping();
      else if (type === 'PONG' && rest.status === 'ready') setInfo(rest as ExtensionInfo);
      else if ((type === 'RESULT' || type === 'ACK') && jobId) {
        if (rest.status !== 'accepted') handler.current(jobId, rest as ExtensionResult);
        ping(); // refresh the counters
      }
    };
    window.addEventListener('message', onMessage);
    ping();
    return () => window.removeEventListener('message', onMessage);
  }, []);

  function fillGroup(job: { jobId: string; groupUrl: string; text: string; images: string[] }) {
    window.postMessage({ source: TO_EXT, type: 'FILL_GROUP', ...job }, window.location.origin);
  }

  return { installed: info !== null, info, fillGroup };
}
