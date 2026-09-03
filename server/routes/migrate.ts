import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware';

import { deviceRepo } from '../repositories/firestore/deviceRepository';
import { substationRepo } from '../repositories/firestore/substationRepository';
import { feederRepo } from '../repositories/firestore/feederRepository';
import { getTargetFirestore } from '../firebaseAdmin';

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
            const { clearAllCache } = require('../../src/lib/idbCache');
            if (typeof clearAllCache === 'function') {
                try { await clearAllCache(); } catch(e) {}
            }
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

export default router;
