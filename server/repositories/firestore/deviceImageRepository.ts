import { getTargetFirestore } from '../../firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';
import { logFirebaseRead, logFirebaseWrite } from '../../utils/firestoreCache.js';

export type DeviceImageMetadata = {
  id: string;
  device_id: string;
  storagePath: string;
  downloadUrl: string;
  fileName: string;
  mimeType: string;
  size: number;
  caption: string;
  isPrimary: boolean;
  createdBy: string;
  createdAt: any;
  operationId: string;
  isDeleted: boolean;
  image_url?: string;
  is_primary?: number | boolean;
};

export const deviceImageRepo = {
  async getByDeviceId(deviceId: string) {
    const db = getTargetFirestore();
    const snapshot = await db.collection('device_images')
      .where('device_id', '==', deviceId)
      .where('isDeleted', '==', false)
      .orderBy('isPrimary', 'desc')
      .orderBy('createdAt', 'desc')
      .get();
      
    logFirebaseRead('device_images', `device_id=${deviceId}`, snapshot.size);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        image_url: data.downloadUrl || data.storagePath || data.image_url,
        is_primary: data.isPrimary ? 1 : 0,
        created_at: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : new Date().toISOString()
      };
    }) as any[];
  },

  async add(data: Omit<DeviceImageMetadata, 'id'>, operationId: string) {
    const db = getTargetFirestore();
    const docRef = db.collection('device_images').doc();
    const now = FieldValue.serverTimestamp();
    const docData = {
      ...data,
      createdAt: now,
      isDeleted: false,
      operationId: operationId
    };
    await docRef.set(docData);
    logFirebaseWrite('device_images', docRef.id, 'CREATE');
    return { id: docRef.id, ...docData };
  },

  async delete(imageId: string, deviceId: string) {
    const db = getTargetFirestore();
    await db.collection('device_images').doc(imageId).delete();
    logFirebaseWrite('device_images', imageId, 'DELETE');
  },

  async setPrimary(imageId: string, deviceId: string) {
    const db = getTargetFirestore();
    const snapshot = await db.collection('device_images')
      .where('device_id', '==', deviceId)
      .where('isPrimary', '==', true)
      .get();
        
    const batch = db.batch();
    
    // Set all existing primary to false
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { isPrimary: false });
    });
    
    // Set the selected one to true
    batch.update(db.collection('device_images').doc(imageId), { isPrimary: true });
    
    await batch.commit();
    logFirebaseWrite('device_images', `${deviceId}/primary=${imageId}`, 'UPDATE_PRIMARY');
  }
};
