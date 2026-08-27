import { getTargetFirestore } from '../../firebaseAdmin';

export const commonRepo = {
  async getOperationEvent(operationId: string) {
    const db = getTargetFirestore();
    const doc = await db.collection('operation_events').doc(operationId).get();
    return doc.exists ? doc.data() : null;
  }
};
