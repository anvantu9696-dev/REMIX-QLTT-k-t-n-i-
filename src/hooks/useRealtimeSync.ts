import { useEffect, useState } from 'react';
import { getAuthToken } from '../lib/api';

export interface RealtimeEvent {
  id?: string;
  type: string;
  entity: string;
  action?: string;
  target_id?: number | string;
  data?: any;
  timestamp: number;
}

export function useRealtimeSync(onEvent?: (event: RealtimeEvent) => void) {
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);

  useEffect(() => {
    // SSE temporarily disabled; polling will be implemented separately.
  }, [onEvent]);

  return { lastEvent };
}