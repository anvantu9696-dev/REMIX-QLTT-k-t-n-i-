import { getTargetFirestore } from '../../firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const deviceStatusHistoryRepo = {
  async add(data: {
      device_id: string;
      previousStatus: string;
      newStatus: string;
      changedFields: any;
      changedBy: string;
      operationId: string;
      deviceVersion: number;
  }) {
    const db = getTargetFirestore();
    const now = FieldValue.serverTimestamp();
    await db.collection('device_status_history').add({
        ...data,
        changedAt: now
    });
  }
};
