import { getTargetFirestore } from '../../firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

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
};

export const deviceImageRepo = {
  async getByDeviceId(deviceId: string) {
    const db = getTargetFirestore();
    const snapshot = await db.collection('device_images')
        .where('device_id', '==', deviceId)
        .orderBy('isPrimary', 'desc')
        .orderBy('createdAt', 'desc')
        .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DeviceImageMetadata[];
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
    return { id: docRef.id, ...docData };
  },

  async delete(imageId: string, deviceId: string) {
    const db = getTargetFirestore();
    await db.collection('device_images').doc(imageId).delete();
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
  }
};
