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

    // Also refetch when window regains focus (multi-device / multi-tab active sync)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        memoizedRefresh();
      }
    };
    window.addEventListener('visibilitychange', handleVisibility);

    // Periodic poll backup every 45 seconds for robust multi-device sync
    const interval = setInterval(() => {
      memoizedRefresh();
    }, 45000);

    return () => {
      unsubscribe();
      window.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [memoizedRefresh]);
}
