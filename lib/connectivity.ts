import { useState, useEffect } from 'react';

let isOnline = true;
const listeners = new Set<(online: boolean) => void>();

// Simple connectivity check using fetch
async function checkConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch('https://clients3.google.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

export function useConnectivity() {
  const [online, setOnline] = useState(isOnline);

  useEffect(() => {
    const listener = (status: boolean) => setOnline(status);
    listeners.add(listener);
    
    // Check on mount
    checkConnectivity().then(status => {
      if (status !== isOnline) {
        isOnline = status;
        listeners.forEach(l => l(status));
      }
    });
    
    // Poll every 30 seconds
    const interval = setInterval(async () => {
      const status = await checkConnectivity();
      if (status !== isOnline) {
        isOnline = status;
        listeners.forEach(l => l(status));
      }
    }, 30000);
    
    return () => {
      listeners.delete(listener);
      clearInterval(interval);
    };
  }, []);

  return online;
}

export function isCurrentlyOnline(): boolean {
  return isOnline;
}
