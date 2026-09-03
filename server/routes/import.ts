import { Router } from 'express';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware';
import { deviceRepo } from '../repositories/firestore/deviceRepository';
import { substationRepo } from '../repositories/firestore/substationRepository';
import { feederRepo } from '../repositories/firestore/feederRepository';
import { loopRepo } from '../repositories/firestore/loopRepository';
import { recordAuditLog } from '../middleware';
import { getTargetFirestore } from '../firebaseAdmin';

const router = Router();
router.use(authenticateToken);

interface RawImportRow {
  row_index?: number;
  device_id: string;
  name: string;
  device_type: string;
  pole_number?: string;
  feeder_code?: string;
  substation_code?: string;
  unit?: string;
  team?: string;
  status?: string;
  switch_status?: string;
  scada_status?: string;
  relay_79?: string;
  current_setting?: string;
  google_maps_url?: string;
  notes?: string;
  image_url?: string;
}

const resolveIds = (row: RawImportRow, subs: any[], feeders: any[]) => {
  const subCode = row.substation_code ? row.substation_code.trim().toUpperCase() : null;
  const feederCode = row.feeder_code ? row.feeder_code.trim().toUpperCase() : null;
  
  if (!subCode || !feederCode) {
      throw new Error('Thiếu mã trạm hoặc mã phát tuyến');
  }

  const s = subs.find(x => x.substation_code && x.substation_code.trim().toUpperCase() === subCode);
  if (!s) {
      throw new Error(`Trạm không tồn tại: ${subCode}`);
  }

  const f = feeders.find(x => x.feeder_code && x.feeder_code.trim().toUpperCase() === feederCode);
  if (!f) {
      throw new Error(`Phát tuyến không tồn tại: ${feederCode}`);
  }
  
  if (String(f.substation_id) !== String(s.id)) {
      throw new Error(`Phát tuyến ${feederCode} không thuộc trạm ${subCode}`);
  }

  return { substation_id: s.id, feeder_id: f.id };
};

router.post('/direct', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  const { rows } = req.body as { rows: RawImportRow[] };
  if (!rows || !Array.isArray(rows)) return res.status(400).json({ success: false, message: 'Invalid data' });
  
  try {
    const db = getTargetFirestore();
    const batch = db.batch();
    
    const subs = await substationRepo.list();
    const feeders = await feederRepo.list();
    const existing = await deviceRepo.list();
    const existMap = new Map(existing.map(d => [d.name.toUpperCase(), d])); // In Phase 4, device_id was mapped to ID, but users often match by code/name

    const successItems: any[] = [];
    const failedItems: any[] = [];
    let updatedCount = 0;
    let importedCount = 0;

    for (let i = 0; i < rows.length; i++) {
       const row = rows[i];
       if (!row.device_id) { failedItems.push(row); continue; }
       
       let substation_id, feeder_id;
       try {
           const res = resolveIds(row, subs, feeders);
           substation_id = res.substation_id;
           feeder_id = res.feeder_id;
       } catch (e) {
           failedItems.push({ ...row, reason: 'UNRESOLVED: ' + e.message });
           continue;
       }
       const ext = existing.find(d => d.name === row.device_id || d.id === row.device_id);
       
       const deviceData = {
           name: row.name || row.device_id,
           device_type: row.device_type,
           pole_number: row.pole_number || '',
           feeder_id,
           substation_id,
           unit: row.unit || '',
           team: row.team || '',
           status: row.status || 'ACTIVE',
           switch_status: row.switch_status || 'CLOSED',
           scada_status: row.scada_status || 'ONLINE',
           current_setting: row.current_setting || '',
           google_maps_url: row.google_maps_url || '',
           notes: row.notes || '',
           isDeleted: false,
           updatedAt: new Date().toISOString()
       };

       if (ext) {
           const ref = db.collection('devices').doc(ext.id);
           batch.update(ref, deviceData);
           updatedCount++;
           successItems.push({ code: row.device_id, action: 'UPDATED', status: 'SUCCESS' });
       } else {
           const ref = db.collection('devices').doc();
           batch.set(ref, { ...deviceData, createdAt: new Date().toISOString() });
           importedCount++;
           successItems.push({ code: row.device_id, action: 'INSERTED', status: 'SUCCESS' });
       }
    }
    await batch.commit();

    await recordAuditLog(req.user!.id, req.user!.username, req.user!.full_name, 'IMPORT_DIRECT', 'IMPORT', 'BATCH', 'Direct import devices', 'SUCCESS', req.ip || '');

    return res.json({
        success: true,
        report: {
           success_count: successItems.length,
           imported_new: importedCount,
           updated_existing: updatedCount,
           failed_count: failedItems.length,
           success_items: successItems,
           failed_items: failedItems
        }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/analyze', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  const { rows } = req.body as { rows: RawImportRow[] };
  if (!rows || !Array.isArray(rows)) return res.status(400).json({ success: false });

  try {
    const subs = await substationRepo.list();
    const feeders = await feederRepo.list();
    const existing = await deviceRepo.list();
    
    const valid: any[] = [];
    const invalid: any[] = [];
    const conflicts: any[] = [];

    rows.forEach((row, idx) => {
       if (!row.device_id) {
           invalid.push({ ...row, reason: 'Missing device_id' });
           return;
       }
       const ext = existing.find(d => d.name === row.device_id || d.id === row.device_id);
       if (ext) {
           conflicts.push({
               fileData: row,
               dbData: ext,
               device_id: row.device_id
           });
       } else {
           try {
               resolveIds(row, subs, feeders);
               valid.push(row);
           } catch(e) {
               invalid.push({ ...row, reason: 'UNRESOLVED: ' + e.message });
           }
       }
    });

    return res.json({ success: true, valid, invalid, conflicts });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/confirm', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  const { newItems = [], conflictResolutions = [] } = req.body;
  try {
    const db = getTargetFirestore();
    const batch = db.batch();
    
    const subs = await substationRepo.list();
    const feeders = await feederRepo.list();
    const existing = await deviceRepo.list();

    let importedCount = 0;
    let updatedCount = 0;
    const successItems: any[] = [];

    newItems.forEach((row: any) => {
       let substation_id, feeder_id;
       try {
           const res = resolveIds(row, subs, feeders);
           substation_id = res.substation_id;
           feeder_id = res.feeder_id;
       } catch (e) {
           successItems.push({ code: row.device_id, action: 'UNRESOLVED', status: 'FAILED', reason: e.message });
           return;
       }
       const ref = db.collection('devices').doc();
       batch.set(ref, {
           name: row.name || row.device_id,
           device_type: row.device_type,
           pole_number: row.pole_number || '',
           feeder_id, substation_id,
           unit: row.unit || '', team: row.team || '',
           status: row.status || 'ACTIVE',
           switch_status: row.switch_status || 'CLOSED',
           scada_status: row.scada_status || 'ONLINE',
           current_setting: row.current_setting || '', google_maps_url: row.google_maps_url || '', notes: row.notes || '',
           isDeleted: false,
           createdAt: new Date().toISOString(),
           updatedAt: new Date().toISOString()
       });
       importedCount++;
       successItems.push({ code: row.device_id, action: 'INSERTED', status: 'SUCCESS' });
    });

    conflictResolutions.forEach((resItem: any) => {
       if (resItem.action === 'UPDATE_FROM_FILE' && resItem.fileData) {
           const row = resItem.fileData;
           const ext = existing.find(d => d.name === row.device_id || d.id === row.device_id);
           if (ext) {
               let substation_id, feeder_id;
               try {
                   const res = resolveIds(row, subs, feeders);
                   substation_id = res.substation_id;
                   feeder_id = res.feeder_id;
               } catch (e) {
                   successItems.push({ code: row.device_id, action: 'UNRESOLVED', status: 'FAILED', reason: e.message });
                   return;
               }
               const ref = db.collection('devices').doc(ext.id);
               batch.update(ref, {
                   name: row.name || row.device_id,
                   device_type: row.device_type,
                   pole_number: row.pole_number || '',
                   feeder_id, substation_id,
                   unit: row.unit || '', team: row.team || '',
                   status: row.status || 'ACTIVE',
                   switch_status: row.switch_status || 'CLOSED',
                   scada_status: row.scada_status || 'ONLINE',
                   current_setting: row.current_setting || '', google_maps_url: row.google_maps_url || '', notes: row.notes || '',
                   updatedAt: new Date().toISOString()
               });
               updatedCount++;
               successItems.push({ code: row.device_id, action: 'UPDATED', status: 'SUCCESS' });
           }
       }
    });

    await batch.commit();
    await recordAuditLog(req.user!.id, req.user!.username, req.user!.full_name, 'IMPORT_CONFIRM', 'IMPORT', 'BATCH', 'Confirm import devices', 'SUCCESS', req.ip || '');

    return res.json({
        success: true,
        report: {
           success_count: successItems.length,
           imported_new: importedCount,
           updated_existing: updatedCount,
           failed_count: 0,
           success_items: successItems,
           failed_items: []
        }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// SUBSTATIONS
router.post('/substations', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  const { rows } = req.body;
  if (!rows || !Array.isArray(rows)) return res.status(400).json({ success: false });
  try {
    const db = getTargetFirestore();
    const batch = db.batch();
    const existing = await substationRepo.list();
    const successItems: any[] = [];
    
    rows.forEach(row => {
       if (!row.substation_code) return;
       const ext = existing.find(s => s.substation_code === row.substation_code);
       if (ext) {
           const ref = db.collection('substations').doc(ext.id);
           batch.update(ref, {
               name: row.name || ext.name,
               address: row.address || ext.address || '',
               status: row.status || ext.status,
               updatedAt: new Date().toISOString()
           });
           successItems.push({ code: row.substation_code, action: 'UPDATED' });
       } else {
           const ref = db.collection('substations').doc();
           batch.set(ref, {
               substation_code: row.substation_code,
               name: row.name || row.substation_code,
               address: row.address || '',
               status: row.status || 'ACTIVE',
               isDeleted: false,
               createdAt: new Date().toISOString(),
               updatedAt: new Date().toISOString()
           });
           successItems.push({ code: row.substation_code, action: 'INSERTED' });
       }
    });
    await batch.commit();
    return res.json({ success: true, report: { success_items: successItems } });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// FEEDERS
router.post('/feeders', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  const { rows } = req.body;
  if (!rows || !Array.isArray(rows)) return res.status(400).json({ success: false });
  try {
    const db = getTargetFirestore();
    const batch = db.batch();
    const existing = await feederRepo.list();
    const subs = await substationRepo.list();
    const successItems: any[] = [];
    
    rows.forEach(row => {
       if (!row.feeder_code) return;
       const ext = existing.find(s => s.feeder_code === row.feeder_code);
       let subId = null;
       if (row.substation_code) {
           const s = subs.find(x => x.substation_code === row.substation_code);
           if (s) subId = s.id;
       }
       if (ext) {
           const ref = db.collection('feeders').doc(ext.id);
           batch.update(ref, {
               name: row.name || ext.name,
               substation_id: subId || ext.substation_id,
               status: row.status || ext.status,
               updatedAt: new Date().toISOString()
           });
           successItems.push({ code: row.feeder_code, action: 'UPDATED' });
       } else {
           const ref = db.collection('feeders').doc();
           batch.set(ref, {
               feeder_code: row.feeder_code,
               name: row.name || row.feeder_code,
               substation_id: subId,
               status: row.status || 'ACTIVE',
               isDeleted: false,
               createdAt: new Date().toISOString(),
               updatedAt: new Date().toISOString()
           });
           successItems.push({ code: row.feeder_code, action: 'INSERTED' });
       }
    });
    await batch.commit();
    return res.json({ success: true, report: { success_items: successItems } });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// LOOPS
router.post('/loops', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  const { rows } = req.body;
  if (!rows || !Array.isArray(rows)) return res.status(400).json({ success: false });
  try {
    const db = getTargetFirestore();
    const batch = db.batch();
    const existing = await loopRepo.list();
    const successItems: any[] = [];
    
    rows.forEach(row => {
       if (!row.loop_code) return;
       const ext = existing.find(s => (s as any).loop_code === row.loop_code);
       if (ext) {
           const ref = db.collection('loops').doc(ext.id);
           batch.update(ref, {
               name: row.name || ext.name,
               status: row.status || ext.status,
               updatedAt: new Date().toISOString()
           });
           successItems.push({ code: row.loop_code, action: 'UPDATED' });
       } else {
           const ref = db.collection('loops').doc();
           batch.set(ref, {
               loop_code: row.loop_code,
               name: row.name || row.loop_code,
               status: row.status || 'ACTIVE',
               isDeleted: false,
               createdAt: new Date().toISOString(),
               updatedAt: new Date().toISOString()
           });
           successItems.push({ code: row.loop_code, action: 'INSERTED' });
       }
    });
    await batch.commit();
    return res.json({ success: true, report: { success_items: successItems } });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

export default router;
