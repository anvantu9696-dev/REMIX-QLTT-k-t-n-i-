import { getFirestore } from 'firebase-admin/firestore';
import { getApp } from 'firebase-admin/app';

const db = getFirestore(getApp());
const collection = db.collection('audit_logs');

export const auditLogRepo = {
  async create(log: {
    user_id: string;
    username: string;
    user_fullname: string;
    action: string;
    module: string;
    target_id?: string | null;
    details?: string;
    result: 'SUCCESS' | 'FAILURE';
    ip_address?: string;
    requestId?: string;
  }) {
    await collection.add({
      ...log,
      timestamp: new Date(),
    });
  }
};
