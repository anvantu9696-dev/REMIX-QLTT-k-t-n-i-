import { getTargetFirestore } from '../../firebaseAdmin.js';

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
    const db = getTargetFirestore();
    const collection = db.collection('audit_logs');
    const safeLog: any = { ...log, timestamp: new Date() };
    Object.keys(safeLog).forEach(key => {
      if (safeLog[key] === undefined) delete safeLog[key];
    });
    await collection.add(safeLog);
  },

  async list(options?: {
    search?: string;
    module?: string;
    result?: string;
    limit?: number;
    lastDocId?: string;
  }) {
    const db = getTargetFirestore();
    let query: FirebaseFirestore.Query = db.collection('audit_logs');

    if (options?.module) {
      query = query.where('module', '==', options.module);
    }
    if (options?.result) {
      query = query.where('result', '==', options.result);
    }

    query = query.orderBy('timestamp', 'desc');

    if (options?.lastDocId) {
      const docSnap = await db.collection('audit_logs').doc(options.lastDocId).get();
      if (docSnap.exists) {
        query = query.startAfter(docSnap);
      }
    }

    const limit = options?.limit || 20;
    query = query.limit(limit);

    const snapshot = await query.get();
    let list = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        created_at: data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp)) : new Date()
      };
    }) as any[];

    if (options?.search) {
      const q = options.search.toLowerCase();
      list = list.filter(l => 
        (l.username && l.username.toLowerCase().includes(q)) ||
        (l.user_fullname && l.user_fullname.toLowerCase().includes(q)) ||
        (l.action && l.action.toLowerCase().includes(q)) ||
        (l.details && l.details.toLowerCase().includes(q))
      );
    }

    const nextCursor = list.length > 0 ? list[list.length - 1].id : null;
    return { success: true, data: list, nextCursor };
  }
};
