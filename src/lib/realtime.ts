
import { useEffect, useState, useCallback, useRef } from 'react';

type RealtimeCallback = (event: { type: string; entity: string; timestamp: number }) => void;

class RealtimeManager {
  private listeners: Set<RealtimeCallback> = new Set();
  
  constructor() {
    // SSE temporarily disabled
  }

  public subscribe(callback: RealtimeCallback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(event: any) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (e) {}
    });
  }
}

export const realtimeManager = new RealtimeManager();

export function useRealtimeSync(onRefresh: () => void) {
  const lastRefreshRef = useRef(0);

  const memoizedRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastRefreshRef.current < 2000) return; // throttle min 2s
    lastRefreshRef.current = now;
    onRefresh();
  }, [onRefresh]);

  useEffect(() => {
    const unsubscribe = realtimeManager.subscribe(() => {
      memoizedRefresh();
    });
    
    // Removed visibilitychange listener and polling interval to reduce unnecessary reads and respect cache TTL

    return () => {
      unsubscribe();
    };
  }, [memoizedRefresh]);
}
