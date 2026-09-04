import { getTargetFirestore } from '../../firebaseAdmin.js';
import { logFirebaseRead } from '../../utils/firestoreCache.js';

export type DeviceLocation = {
  id: string;
  device_id: string;
  latitude: number;
  longitude: number;
  google_maps_url: string;
  created_at: any;
  note?: string;
  updated_by?: string;
};

export const deviceLocationRepo = {
  async getByDeviceId(deviceId: string, limit = 20) {
    const db = getTargetFirestore();
    const parsedLimit = Math.min(Math.max(1, limit), 50);
    const snapshot = await db.collection('device_locations')
      .where('device_id', '==', deviceId)
      .orderBy('created_at', 'desc')
      .limit(parsedLimit)
      .get();
    
    logFirebaseRead('device_locations', `device_id=${deviceId},limit=${parsedLimit}`, snapshot.size);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        created_at: data.created_at ? (data.created_at.toDate ? data.created_at.toDate().toISOString() : data.created_at) : new Date().toISOString()
      };
    }) as DeviceLocation[];
  }
};
