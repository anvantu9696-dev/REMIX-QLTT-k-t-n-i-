import { getTargetFirestore } from '../../firebaseAdmin.js';
import { logFirebaseRead, logFirebaseWrite } from '../../utils/firestoreCache.js';

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
    const nowIso = new Date().toISOString();
    const safeLog: any = { 
      ...log, 
      timestamp: nowIso,
      created_at: nowIso
    };
    Object.keys(safeLog).forEach(key => {
      if (safeLog[key] === undefined) delete safeLog[key];
    });
    const docRef = await collection.add(safeLog);
    logFirebaseWrite('audit_logs', docRef.id, 'CREATE');
  },

  async list(options?: {
    search?: string;
    module?: string;
    action?: string;
    result?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
    lastDocId?: string;
    lastCreatedAt?: string;
  }) {
    const db = getTargetFirestore();
    let query: FirebaseFirestore.Query = db.collection('audit_logs');

    if (options?.module) {
      query = query.where('module', '==', options.module);
    }
    if (options?.action) {
      query = query.where('action', '==', options.action);
    }
    if (options?.result) {
      query = query.where('result', '==', options.result);
    }

    if (options?.start_date) {
      query = query.where('created_at', '>=', new Date(options.start_date).toISOString());
    }
    if (options?.end_date) {
      const ed = new Date(options.end_date);
      ed.setHours(23, 59, 59, 999);
      query = query.where('created_at', '<=', ed.toISOString());
    }

    query = query.orderBy('created_at', 'desc');

    if (options?.lastDocId) {
      const docSnap = await db.collection('audit_logs').doc(options.lastDocId).get();
      if (docSnap.exists) {
        query = query.startAfter(docSnap);
      }
    } else if (options?.lastCreatedAt) {
      query = query.startAfter(new Date(options.lastCreatedAt).toISOString());
    }

    // Enforce default limit 20, max 50 to strictly prevent unbounded collection reads
    const rawLimit = options?.limit ?? 20;
    const pageSize = Math.min(Math.max(1, rawLimit), 50);
    query = query.limit(pageSize + 1);

    const snapshot = await query.get();
    logFirebaseRead('audit_logs', `module=${options?.module || 'all'},limit=${pageSize}`, snapshot.size);

    let list = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        created_at: data.created_at || (data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate().toISOString() : new Date(data.timestamp).toISOString()) : new Date().toISOString())
      };
    }) as any[];

    if (options?.search) {
      const q = options.search.toLowerCase();
      list = list.filter(l => 
        (l.username && l.username.toLowerCase().includes(q)) ||
        (l.user_fullname && l.user_fullname.toLowerCase().includes(q)) ||
        (l.action && l.action.toLowerCase().includes(q)) ||
        (l.details && l.details.toLowerCase().includes(q)) ||
        (l.target_id && String(l.target_id).toLowerCase().includes(q))
      );
    }

    const hasMore = list.length > pageSize;
    if (hasMore) {
      list.pop();
    }

    const nextCursor = hasMore && list.length > 0 ? list[list.length - 1].id : null;
    return { success: true, data: list, nextCursor, hasMore };
  }
};
