import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware';

import { deviceRepo } from '../repositories/firestore/deviceRepository';
import { substationRepo } from '../repositories/firestore/substationRepository';
import { feederRepo } from '../repositories/firestore/feederRepository';
import { gridStructureRepo } from '../repositories/firestore/gridStructureRepository';
import { getTargetFirestore } from '../firebaseAdmin';
import { clearAllCache } from '../utils/firestoreCache';

const router = Router();

router.post('/migrate-relations', authenticateToken, requireRole(['ADMIN']), async (req: any, res: any) => {
    try {
        const { dryRun = true } = req.body;
        
        const devices = await deviceRepo.list({ limit: 10000 }); // all devices
        const subs = await substationRepo.list({ limit: 10000 });
        const feeders = await feederRepo.list({ limit: 10000 });

        const subByCode = new Map(subs.map(s => [s.substation_code?.trim().toUpperCase(), s.id]));
        const feederByCode = new Map(feeders.map(f => [f.feeder_code?.trim().toUpperCase(), f.id]));
        const subById = new Map(subs.map(s => [s.id, s]));
        const feederById = new Map(feeders.map(f => [f.id, f]));
        
        // Also old sqlite IDs might be something like "1", "2". If they match the name? Unlikely.
        // Wait, what if feeder_id on the device is currently a string like "1"?
        // How do we know what feeder "1" is?
        // Maybe the device's feeder_id is already the code?
        // "đổi feeder_id/substation_id số cũ sang Firestore document ID đúng theo mã trạm/phát tuyến"

        const db = getTargetFirestore();
        let found = 0;
        let migrated = 0;
        let unresolved = 0;
        
        const batches = [];
        let currentBatch = db.batch();
        let opCount = 0;

        for (const device of devices) {
            let needsUpdate = false;
            const updates: any = {};
            
            // Check substation
            if (device.substation_id && !subById.has(String(device.substation_id))) {
                // Not a valid Firestore ID. It might be a number or a code.
                found++;
                const oldSubIdStr = String(device.substation_id).trim().toUpperCase();
                
                // Try to find substation by code exactly matching the old ID, OR if we have to guess?
                // "không tự đoán" -> NO guessing. Only exact match.
                // It must match exactly the code.
                if (subByCode.has(oldSubIdStr)) {
                    updates.substation_id = subByCode.get(oldSubIdStr);
                    needsUpdate = true;
                } else {
                    unresolved++;
                    continue; // Unresolved, skip
                }
            }
            
            // Check feeder
            if (device.feeder_id && !feederById.has(String(device.feeder_id))) {
                // Not a valid Firestore ID.
                if (!needsUpdate) found++; // only increment found once per device
                const oldFeederIdStr = String(device.feeder_id).trim().toUpperCase();
                
                if (feederByCode.has(oldFeederIdStr)) {
                    updates.feeder_id = feederByCode.get(oldFeederIdStr);
                    needsUpdate = true;
                } else {
                    unresolved++;
                    continue;
                }
            }
            
            if (needsUpdate) {
                // Validate relation
                const subId = updates.substation_id || device.substation_id;
                const fdrId = updates.feeder_id || device.feeder_id;
                
                const f = feederById.get(String(fdrId));
                if (f && String(f.substation_id) === String(subId)) {
                    if (!dryRun) {
                        currentBatch.update(db.collection('devices').doc(device.id), updates);
                        opCount++;
                        if (opCount === 400) {
                            batches.push(currentBatch);
                            currentBatch = db.batch();
                            opCount = 0;
                        }
                    }
                    migrated++;
                } else {
                    unresolved++;
                }
            }
        }
        
        if (!dryRun && opCount > 0) {
            batches.push(currentBatch);
        }
        
        if (!dryRun) {
            for (const b of batches) {
                await b.commit();
            }
            // Clear cache
            clearAllCache();
        }

        res.json({
            success: true,
            report: {
                DRY_RUN: dryRun,
                FOUND: found,
                MIGRATED: migrated,
                UNRESOLVED: unresolved
            }
        });

    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});

router.post('/backfill-feeders', authenticateToken, requireRole(['ADMIN']), async (req: any, res: any) => {
    try {
        const db = getTargetFirestore();
        const [subSnap, feederSnap] = await Promise.all([
            db.collection('substations').get(),
            db.collection('feeders').get()
        ]);

        const subById = new Map<string, any>();
        const subByCode = new Map<string, string>();

        for (const doc of subSnap.docs) {
            const data = doc.data();
            subById.set(doc.id, data);
            const code = String(data.substation_code || data.code || '').trim().toUpperCase();
            if (code) subByCode.set(code, doc.id);
        }

        let updatedCount = 0;
        let batch = db.batch();
        let count = 0;

        for (const doc of feederSnap.docs) {
            const data = doc.data();
            let needsUpdate = false;
            const updates: Record<string, any> = {};

            const hasExplicitDeleted = Boolean(data.deleted_at || data.deletedAt);
            if (data.isDeleted === undefined || data.isDeleted === null) {
                updates.isDeleted = hasExplicitDeleted;
                updates.deleted_at = data.deleted_at || (hasExplicitDeleted ? new Date() : null);
                needsUpdate = true;
            }

            const feederCode = String(data.feeder_code || data.code || doc.id).trim();
            if (!data.feeder_code || data.feeder_code !== feederCode) {
                updates.feeder_code = feederCode;
                needsUpdate = true;
            }

            if (data.substation_id !== undefined && data.substation_id !== null) {
                const rawSubIdStr = String(data.substation_id).trim();
                let targetSubId = rawSubIdStr;
                if (!subById.has(rawSubIdStr)) {
                    const matchedIdByCode = subByCode.get(rawSubIdStr.toUpperCase());
                    if (matchedIdByCode) targetSubId = matchedIdByCode;
                }
                if (typeof data.substation_id !== 'string' || data.substation_id !== targetSubId) {
                    updates.substation_id = String(targetSubId);
                    needsUpdate = true;
                }
            } else {
                updates.substation_id = '';
                needsUpdate = true;
            }

            if (data.version === undefined || data.version === null) {
                updates.version = 1;
                needsUpdate = true;
            }

            if (!data.status) {
                updates.status = 'ACTIVE';
                needsUpdate = true;
            }

            if (needsUpdate) {
                updates.updatedAt = new Date();
                batch.update(doc.ref, updates);
                count++;
                updatedCount++;
                if (count >= 400) {
                    await batch.commit();
                    batch = db.batch();
                    count = 0;
                }
            }
        }

        if (count > 0) {
            await batch.commit();
        }

        clearAllCache();
        const bundle = await gridStructureRepo.rebuildGridStructure();

        res.json({
            success: true,
            message: `Đã hoàn tất backfill phát tuyến: Quét ${feederSnap.size} tuyến, cập nhật ${updatedCount} bản ghi.`,
            stats: {
                total_feeders: bundle.feeders.length,
                total_substations: bundle.substations.length,
                updated: updatedCount
            }
        });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});

export default router;
