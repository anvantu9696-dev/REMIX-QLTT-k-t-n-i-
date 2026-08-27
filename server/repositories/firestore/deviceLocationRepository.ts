import { getTargetFirestore } from '../../firebaseAdmin';

export type DeviceLocation = {
    id: string;
    device_id: string;
    latitude: number;
    longitude: number;
    google_maps_url: string;
    created_at: any;
};

export const deviceLocationRepo = {
  async getByDeviceId(deviceId: string) {
    const db = getTargetFirestore();
    const snapshot = await db.collection('device_locations')
        .where('device_id', '==', deviceId)
        .orderBy('created_at', 'desc')
        .limit(20)
        .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DeviceLocation[];
  }
};
