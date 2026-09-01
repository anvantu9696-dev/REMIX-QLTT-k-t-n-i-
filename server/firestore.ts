import { getFirestore } from 'firebase-admin/firestore';
import { getApp, getApps } from 'firebase-admin/app';


export async function pushRealtimeEvent(event: { type: string; entity: string; action?: string; id?: number | string; data?: any }) {
  try {
    if (getApps().length === 0) return;
    
    const db = getFirestore(getApp(), "ai-studio-qunlthitbliin11-9296ab92-97c7-4c72-b30c-d73e7b59bc71");
    const eventRef = db.collection('realtime_events').doc();
    
    await eventRef.set({
      ...event,
      timestamp: new Date().toISOString(),
      server_timestamp: new Date().getTime()
    });
    
    // Optional: Keep only the last 100 events to avoid clutter
    // This is a bit expensive to do every time, so maybe just a cleanup task elsewhere
  } catch (err) {
    console.error('[Firestore Realtime] Error pushing event:', err);
  }
}
