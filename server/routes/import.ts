import { Router, Response } from 'express';
import { dbQuery, dbQueryOne, dbRun } from '../db';
import { generateNextDeviceCode } from '../utils/deviceCode';
import { authenticateToken, requirePermission, requireRole, AuthenticatedRequest } from '../middleware';
import { CORE_DATA_SOURCE } from '../config';
import { deviceRepo } from '../repositories/firestore/deviceRepository';
import { substationRepo } from '../repositories/firestore/substationRepository';
import { feederRepo } from '../repositories/firestore/feederRepository';
import { loopRepo } from '../repositories/firestore/loopRepository';
import { broadcastRealtimeEvent } from '../events';
import { recordAuditLog } from '../middleware';

const router = Router();
router.use(authenticateToken);

interface RawImportRow {
  device_id: string;
  name: string;
  device_type: string;
  pole_number?: string;
  feeder_code?: string;
  feeder_name?: string;
  substation_code?: string;
  substation_name?: string;
  unit?: string;
  team?: string;
  status?: string;
  switch_status?: string;
  scada_status?: string;
  relay_79?: string;
  current_setting?: string;
  image_url?: string;
  google_maps_url?: string;
  notes?: string;
}

// 3. POST /api/import/direct - Direct 1-click import (Upload -> Auto recognize -> Validate -> Database)
router.post('/direct', requirePermission('GRID_DATA_IMPORT'), async (req: AuthenticatedRequest, res) => {
  const { rows } = req.body as { rows: RawImportRow[] };

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, message: 'Danh sách dữ liệu tải lên rỗng hoặc không đúng định dạng.' });
  }

  // Fetch active substations and feeders for lookup & validation
  const substations = dbQuery(`SELECT id, substation_code, name FROM substations WHERE deleted_at IS NULL`);
  const substationMap = new Map<string, { id: number; name: string }>();
  substations.forEach(s => {
    substationMap.set(s.substation_code.toUpperCase(), { id: s.id, name: s.name });
    substationMap.set(s.name.toUpperCase(), { id: s.id, name: s.name });
  });

  const feeders = dbQuery(`SELECT id, feeder_code, name FROM feeders WHERE deleted_at IS NULL`);
  const feederMap = new Map<string, { id: number; name: string; substation_id: number }>();
  feeders.forEach(f => {
    feederMap.set(f.feeder_code.toUpperCase(), { id: f.id, name: f.name, substation_id: f.substation_id });
    feederMap.set(f.name.toUpperCase(), { id: f.id, name: f.name, substation_id: f.substation_id });
  });

  const successItems: any[] = [];
  const failedItems: any[] = [];
  const validRows: any[] = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 1;
    let name = (row.name || '').toString().trim();
    const rawDeviceId = (row.device_id || '').toString().trim();
    const rawDeviceType = (row.device_type || '').toString().trim();
    const poleNumber = (row.pole_number || '').toString().trim();
    const feederCode = (row.feeder_code || '').toString().trim();
    const substationCode = (row.substation_code || '').toString().trim();
    const team = (row.team || '').toString().trim();
    const statusVal = (row.status || '').toString().trim().toUpperCase();
    const switchStatus = (row.switch_status || '').toString().trim();
    const scadaStatus = (row.scada_status || '').toString().trim();
    const relay79 = (row.relay_79 || '').toString().trim();
    const currentSetting = (row.current_setting || (row as any)['Dòng cài đặt'] || '').toString().trim();
    const imageUrl = (row.image_url || '').toString().trim();
    let mapsUrl = (row.google_maps_url || '').toString().trim();

    if (!rawDeviceId && !name && !rawDeviceType && !substationCode && !feederCode) {
      failedItems.push({
        row_index: rowNum,
        code: '-',
        name: '(Dòng trống)',
        type: '-',
        status: 'FAILED',
        reason: 'Dòng không có bất kỳ thông tin thiết bị nào'
      });
      return;
    }

    if (!rawDeviceId && !name) {
      failedItems.push({
        row_index: rowNum,
        code: rawDeviceId || 'CHƯA_CÓ_MÃ',
        name: '(Chưa đặt tên)',
        type: rawDeviceType || 'LBS',
        status: 'FAILED',
        reason: 'Thiếu cả Mã thiết bị và Tên thiết bị trong file'
      });
      return;
    }

    // Robust device type normalization
    let cleanDeviceType = 'LBS';
    const rawTypeUpper = rawDeviceType.toUpperCase();
    if (rawTypeUpper.includes('DS') || rawTypeUpper.includes('DAO') || rawTypeUpper.includes('CÁCH LY')) {
      cleanDeviceType = 'DS';
    } else if (rawTypeUpper.includes('REC') || rawTypeUpper.includes('RCL') || rawTypeUpper.includes('RECLOSER') || rawTypeUpper.includes('MÁY CẮT') || rawTypeUpper.includes('MC')) {
      cleanDeviceType = 'REC';
    } else if (rawTypeUpper.includes('RMU') || rawTypeUpper.includes('TỦ')) {
      cleanDeviceType = 'RMU';
    } else if (rawTypeUpper.includes('LBS') || rawTypeUpper.includes('PHỤ TẢI') || rawTypeUpper.includes('CPT')) {
      cleanDeviceType = 'LBS';
    } else if (['LBS', 'DS', 'RCL', 'REC', 'RMU', 'OTHER'].includes(rawTypeUpper)) {
      cleanDeviceType = rawTypeUpper === 'RCL' ? 'REC' : rawTypeUpper;
    } else {
      cleanDeviceType = rawTypeUpper ? 'OTHER' : 'LBS';
    }

    // Validate or Auto-create Station if provided
    let substationId: number | null = null;
    if (substationCode) {
      let foundSub = substationMap.get(substationCode.toUpperCase());
      if (!foundSub) {
        // Try to find by name as well
        const subByName = dbQueryOne(`SELECT id, substation_code, name FROM substations WHERE LOWER(name) = LOWER(?) LIMIT 1`, [substationCode]);
        if (subByName) foundSub = { id: subByName.id, name: subByName.name };
      }
      if (!foundSub) {
        try {
          dbRun(
            `INSERT INTO substations (substation_code, name, status, created_by) VALUES (?, ?, 'ACTIVE', 'IMPORT_AUTO')`,
            [substationCode, substationCode]
          );
          const newSub = dbQueryOne(
            `SELECT id FROM substations WHERE substation_code = ? LIMIT 1`,
            [substationCode]
          );
          if (newSub) {
            foundSub = { id: newSub.id, name: substationCode };
            substationMap.set(substationCode.toUpperCase(), foundSub);
          }
        } catch (subErr) {
          console.error('Error auto-creating substation:', subErr);
        }
      }
      if (foundSub) substationId = foundSub.id;
    }

    // Validate or Auto-create Feeder if provided
    let feederId: number | null = null;
    if (feederCode) {
      let foundFeeder = feederMap.get(feederCode.toUpperCase());
      if (!foundFeeder) {
        // Try to find by name as well
        const feederByName = dbQueryOne(`SELECT id, feeder_code, name, substation_id FROM feeders WHERE LOWER(name) = LOWER(?) LIMIT 1`, [feederCode]);
        if (feederByName) foundFeeder = { id: feederByName.id, name: feederByName.name, substation_id: feederByName.substation_id };
      }
      if (!foundFeeder) {
        try {
          dbRun(
            `INSERT INTO feeders (feeder_code, name, substation_id, status, created_by) VALUES (?, ?, ?, 'ACTIVE', 'IMPORT_AUTO')`,
            [feederCode, feederCode, substationId || 1]
          );
          const newFeeder = dbQueryOne(
            `SELECT id, substation_id FROM feeders WHERE feeder_code = ? LIMIT 1`,
            [feederCode]
          );
          if (newFeeder) {
            foundFeeder = { id: newFeeder.id, name: feederCode, substation_id: newFeeder.substation_id };
            feederMap.set(feederCode.toUpperCase(), foundFeeder);
          }
        } catch (feedErr) {
          console.error('Error auto-creating feeder:', feedErr);
        }
      }
      if (foundFeeder) {
        feederId = foundFeeder.id;
        if (!substationId && foundFeeder.substation_id) {
          substationId = foundFeeder.substation_id;
        }
      }
    }

    let deviceId = rawDeviceId.toUpperCase();
    if (!deviceId) {
      deviceId = generateNextDeviceCode(cleanDeviceType, feederId, substationId);
    }
    if (!name) {
      name = deviceId;
    }

    // Clean Google Maps URL
    let cleanMapsUrl: string | null = null;
    if (mapsUrl) {
      if (mapsUrl.startsWith('http://') || mapsUrl.startsWith('https://')) {
        cleanMapsUrl = mapsUrl;
      } else if (mapsUrl.includes(',') || /^\d/.test(mapsUrl)) {
        cleanMapsUrl = `https://maps.google.com/?q=${encodeURIComponent(mapsUrl)}`;
      } else {
        cleanMapsUrl = `https://${mapsUrl}`;
      }
    }

    let cleanStatus = 'ACTIVE';
    if (statusVal.includes('INACTIVE') || statusVal.includes('DỪNG') || statusVal.includes('NGỪNG')) {
      cleanStatus = 'INACTIVE';
    } else if (statusVal.includes('MAINTENANCE') || statusVal.includes('BẢO DƯỠNG') || statusVal.includes('SỬA CHỮA')) {
      cleanStatus = 'MAINTENANCE';
    }

    validRows.push({
      row_index: rowNum,
      device_id: deviceId,
      name,
      device_type: cleanDeviceType,
      pole_number: poleNumber,
      substation_id: substationId,
      feeder_id: feederId,
      unit: (row.unit || req.user?.unit || 'Điện lực Bình Dương').trim(),
      team: (team || req.user?.team || 'ĐỘI QLVH').trim(),
      status: cleanStatus,
      switch_status: switchStatus || 'CLOSED',
      scada_status: scadaStatus || 'SIGNAL',
      relay_79: relay79 || 'N_A',
      current_setting: currentSetting,
      image_url: imageUrl,
      google_maps_url: cleanMapsUrl,
      notes: (row as any).notes || 'Import trực tiếp'
    });
  });

  let importedCount = 0;
  let updatedCount = 0;

  try {
    if (CORE_DATA_SOURCE === 'firestore') {
        for (const row of validRows) {
            const operationId = `IMPORT_DEVICE_${Date.now()}*${row.row_index}*${row.device_id}`;
            try {
                const existing = await deviceRepo.getByDeviceId(row.device_id.toUpperCase().trim());
                if (existing) {
                    await deviceRepo.update(existing.id, {
                        ...row,
                        updated_by: req.user!.id
                    }, existing.version, operationId);
                    updatedCount++;
                    successItems.push({ row_index: row.row_index, code: row.device_id, name: row.name, status: 'SUCCESS', action: 'UPDATED' });
                } else {
                    await deviceRepo.create({
                        ...row,
                        created_by: req.user!.id
                    }, operationId);
                    importedCount++;
                    successItems.push({ row_index: row.row_index, code: row.device_id, name: row.name, status: 'SUCCESS', action: 'IMPORTED' });
                }
            } catch (err: any) {
                failedItems.push({ row_index: row.row_index, code: row.device_id, status: 'FAILED', reason: err.message });
            }
        }
        return res.json({ success: true, message: 'Nhập dữ liệu thành công', imported: importedCount, updated: updatedCount, successItems, failedItems });
    } else {
        dbRun('BEGIN TRANSACTION');
    }



    // Existing devices lookup - Get all including deleted to handle restoration
    const dbDevices = dbQuery(`SELECT id, device_id, deleted_at FROM devices`);
    const existingDevices = new Map<string, { id: number, deleted_at: string | null }>();
    dbDevices.forEach(d => {
      const normalizedId = d.device_id.toUpperCase().trim();
      existingDevices.set(normalizedId, { id: d.id, deleted_at: d.deleted_at });
    });

    validRows.forEach((row) => {
      try {
        const existingDevice = existingDevices.get(row.device_id.toUpperCase().trim());
        
        if (existingDevice) {
          // Update existing device (including restoring if deleted)
          dbRun(
            `UPDATE devices
             SET name = ?, device_type = ?,
                 pole_number = COALESCE(?, pole_number),
                 feeder_id = COALESCE(?, feeder_id),
                 substation_id = COALESCE(?, substation_id),
                 unit = ?, team = ?, status = ?, switch_status = ?, scada_status = ?, relay_79 = ?, current_setting = ?, google_maps_url = ?, notes = ?,
                 deleted_at = NULL,
                 updated_by = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
              row.name,
              row.device_type,
              row.pole_number,
              row.feeder_id,
              row.substation_id,
              row.unit,
              row.team,
              row.status,
              row.switch_status,
              row.scada_status,
              row.relay_79,
              row.current_setting,
              row.google_maps_url,
              row.notes,
              req.user!.username,
              existingDevice.id
            ]
          );
          updatedCount++;
          successItems.push({
            row_index: row.row_index,
            code: row.device_id,
            name: row.name,
            type: row.device_type,
            status: 'SUCCESS',
            action: existingDevice.deleted_at ? 'RESTORED_AND_UPDATED' : 'UPDATED',
            details: `Cập nhật thành công thiết bị ${row.device_type}`
          });
        } else {
          // Insert new device
          dbRun(
            `INSERT INTO devices (device_id, name, device_type, pole_number, feeder_id, substation_id, unit, team, status, switch_status, scada_status, relay_79, current_setting, google_maps_url, notes, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              row.device_id,
              row.name,
              row.device_type,
              row.pole_number,
              row.feeder_id,
              row.substation_id,
              row.unit,
              row.team,
              row.status,
              row.switch_status,
              row.scada_status,
              row.relay_79,
              row.current_setting,
              row.google_maps_url,
              row.notes,
              req.user!.username
            ]
          );
          
          if (row.image_url) {
            const newDevice = dbQueryOne(`SELECT id FROM devices WHERE device_id = ?`, [row.device_id]);
            if (newDevice) {
              dbRun(
                `INSERT INTO device_images (device_id, image_url, is_primary, created_by) VALUES (?, ?, 1, ?)`,
                [newDevice.id, row.image_url, req.user!.username]
              );
            }
          }
          importedCount++;
          existingDevices.set(row.device_id.toUpperCase().trim(), { id: (dbQueryOne(`SELECT id FROM devices WHERE device_id = ?`, [row.device_id]) as any)?.id || 0, deleted_at: null });
          successItems.push({
            row_index: row.row_index,
            code: row.device_id,
            name: row.name,
            type: row.device_type,
            status: 'SUCCESS',
            action: 'INSERTED',
            details: `Thêm mới thành công thiết bị ${row.device_type} vào hệ thống`
          });
        }
      } catch (rowErr: any) {
        failedItems.push({
          row_index: row.row_index,
          code: row.device_id,
          name: row.name,
          type: row.device_type,
          status: 'FAILED',
          reason: `Lỗi ghi cơ sở dữ liệu: ${rowErr.message}`
        });
      }
    });

    dbRun('COMMIT');

    dbRun(
      `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user!.id,
        req.user!.username,
        req.user!.full_name,
        'IMPORT_DIRECT_8_FIELDS',
        'IMPORT',
        `BATCH_${Date.now()}`,
        `Nhập trực tiếp: Thành công ${successItems.length} (Thêm mới ${importedCount}, Cập nhật ${updatedCount}), Thất bại ${failedItems.length}`,
        'SUCCESS',
        req.ip || '127.0.0.1'
      ]
    );

    return res.json({
      success: successItems.length > 0 || rows.length === 0,
      message: `Kết quả nhập dữ liệu: ${successItems.length} hạng mục thành công (${importedCount} thêm mới, ${updatedCount} cập nhật), ${failedItems.length} hạng mục thất bại.`,
      report: {
        total_processed: rows.length,
        success_count: successItems.length,
        imported_new: importedCount,
        updated_existing: updatedCount,
        failed_count: failedItems.length,
        skipped_count: 0,
        success_items: successItems,
        failed_items: failedItems
      }
    });
  } catch (err: any) {
    if (CORE_DATA_SOURCE !== 'firestore') dbRun('ROLLBACK');
    return res.status(500).json({
      success: false,
      message: `Lỗi hệ thống khi ghi Database: ${err.message}`,
      report: {
        total_processed: rows.length,
        success_count: 0,
        imported_new: 0,
        updated_existing: 0,
        failed_count: rows.length,
        skipped_count: 0,
        success_items: [],
        failed_items: rows.map((r, i) => ({
          row_index: i + 1,
          code: r.device_id || 'N/A',
          name: r.name || 'N/A',
          status: 'FAILED',
          reason: `Giao dịch cơ sở dữ liệu thất bại: ${err.message}`
        }))
      }
    });
  }
});

// 1. POST /api/import/analyze - Validate 8-field structure, check station/feeder existence, duplicates
router.post('/analyze', requirePermission('GRID_DATA_IMPORT'), (req: AuthenticatedRequest, res) => {
  const { rows } = req.body as { rows: RawImportRow[] };

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, message: 'Danh sách dữ liệu tải lên rỗng hoặc không đúng định dạng.' });
  }

  // Fetch active substations and feeders for lookup & validation
  const substations = dbQuery(`SELECT id, substation_code, name FROM substations WHERE deleted_at IS NULL`);
  const substationMap = new Map<string, { id: number; name: string }>();
  substations.forEach(s => {
    substationMap.set(s.substation_code.toUpperCase(), { id: s.id, name: s.name });
    substationMap.set(s.name.toUpperCase(), { id: s.id, name: s.name });
  });

  const feeders = dbQuery(`SELECT id, feeder_code, name FROM feeders WHERE deleted_at IS NULL`);
  const feederMap = new Map<string, { id: number; name: string; substation_id: number }>();
  feeders.forEach(f => {
    feederMap.set(f.feeder_code.toUpperCase(), { id: f.id, name: f.name, substation_id: f.substation_id });
    feederMap.set(f.name.toUpperCase(), { id: f.id, name: f.name, substation_id: f.substation_id });
  });

  const fileDeviceIdMap = new Map<string, number[]>();
  const validRows: any[] = [];
  const invalidRows: { row: number; data: RawImportRow; errors: string[] }[] = [];
  const fileDuplicates: { device_id: string; rowIndices: number[] }[] = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 1;
    let name = (row.name || '').toString().trim();
    const rawDeviceType = (row.device_type || '').toString().trim();
    const substationQuery = (row.substation_name || '').toString().trim();
    const feederQuery = (row.feeder_name || '').toString().trim();
    const unit = (row.unit || '').toString().trim() || 'Công ty Điện lực';
    const statusVal = (row.status || '').toString().trim().toUpperCase();
    const currentSetting = (row.current_setting || (row as any)['Dòng cài đặt'] || '').toString().trim();
    let mapsUrl = (row.google_maps_url || '').toString().trim();

    if (!row.device_id && !name && !rawDeviceType) {
      return; // Skip completely empty rows
    }

    // Robust device type normalization
    let cleanDeviceType = 'LBS';
    const rawTypeUpper = rawDeviceType.toUpperCase();
    if (rawTypeUpper.includes('DS') || rawTypeUpper.includes('DAO') || rawTypeUpper.includes('CÁCH LY')) {
      cleanDeviceType = 'DS';
    } else if (rawTypeUpper.includes('REC') || rawTypeUpper.includes('RCL') || rawTypeUpper.includes('RECLOSER') || rawTypeUpper.includes('MÁY CẮT') || rawTypeUpper.includes('MC')) {
      cleanDeviceType = 'REC';
    } else if (rawTypeUpper.includes('RMU') || rawTypeUpper.includes('TỦ')) {
      cleanDeviceType = 'RMU';
    } else if (rawTypeUpper.includes('LBS') || rawTypeUpper.includes('PHỤ TẢI') || rawTypeUpper.includes('CPT')) {
      cleanDeviceType = 'LBS';
    } else if (['LBS', 'DS', 'RCL', 'REC', 'RMU', 'OTHER'].includes(rawTypeUpper)) {
      cleanDeviceType = rawTypeUpper === 'RCL' ? 'REC' : rawTypeUpper;
    } else {
      cleanDeviceType = rawTypeUpper ? 'OTHER' : 'LBS';
    }

    // Validate or Auto-create Station if provided
    let substationId: number | null = null;
    if (substationQuery) {
      let foundSub = substationMap.get(substationQuery.toUpperCase());
      if (!foundSub) {
        try {
          dbRun(
            `INSERT INTO substations (substation_code, name, status) VALUES (?, ?, 'ACTIVE')`,
            [substationQuery, substationQuery]
          );
          const newSub = dbQueryOne(
            `SELECT id, substation_code, name FROM substations WHERE substation_code = ? OR name = ? ORDER BY id DESC LIMIT 1`,
            [substationQuery, substationQuery]
          );
          if (newSub) {
            foundSub = { id: newSub.id, name: newSub.name };
            substationMap.set(substationQuery.toUpperCase(), foundSub);
            substationMap.set(newSub.substation_code.toUpperCase(), foundSub);
          }
        } catch (subErr) {
          console.error('Error auto-creating substation in analyze:', subErr);
        }
      }
      if (foundSub) {
        substationId = foundSub.id;
      }
    }

    // Validate or Auto-create Feeder if provided
    let feederId: number | null = null;
    if (feederQuery) {
      let foundFeeder = feederMap.get(feederQuery.toUpperCase());
      if (!foundFeeder) {
        try {
          dbRun(
            `INSERT INTO feeders (feeder_code, name, substation_id, status) VALUES (?, ?, ?, 'ACTIVE')`,
            [feederQuery, feederQuery, substationId || 1]
          );
          const newFeeder = dbQueryOne(
            `SELECT id, feeder_code, name, substation_id FROM feeders WHERE feeder_code = ? OR name = ? ORDER BY id DESC LIMIT 1`,
            [feederQuery, feederQuery]
          );
          if (newFeeder) {
            foundFeeder = { id: newFeeder.id, name: newFeeder.name, substation_id: newFeeder.substation_id };
            feederMap.set(feederQuery.toUpperCase(), foundFeeder);
            feederMap.set(newFeeder.feeder_code.toUpperCase(), foundFeeder);
          }
        } catch (feedErr) {
          console.error('Error auto-creating feeder in analyze:', feedErr);
        }
      }
      if (foundFeeder) {
        feederId = foundFeeder.id;
        if (!substationId && foundFeeder.substation_id) {
          substationId = foundFeeder.substation_id;
        }
      }
    }

    let deviceId = (row.device_id || '').toString().trim().toUpperCase();
    if (!deviceId) {
      deviceId = generateNextDeviceCode(cleanDeviceType, feederId, substationId);
    }
    if (!name) {
      name = deviceId;
    }

    // Clean Google Maps URL
    let cleanMapsUrl: string | null = null;
    if (mapsUrl) {
      if (mapsUrl.startsWith('http://') || mapsUrl.startsWith('https://')) {
        cleanMapsUrl = mapsUrl;
      } else if (mapsUrl.includes(',') || /^\d/.test(mapsUrl)) {
        cleanMapsUrl = `https://maps.google.com/?q=${encodeURIComponent(mapsUrl)}`;
      } else {
        cleanMapsUrl = `https://${mapsUrl}`;
      }
    }

    let cleanStatus = 'ACTIVE';
    if (statusVal.includes('INACTIVE') || statusVal.includes('DỪNG') || statusVal.includes('NGỪNG')) {
      cleanStatus = 'INACTIVE';
    } else if (statusVal.includes('MAINTENANCE') || statusVal.includes('BẢO DƯỠNG') || statusVal.includes('SỬA CHỮA')) {
      cleanStatus = 'MAINTENANCE';
    }

    const poleNumber = (row.pole_number || '').toString().trim() || null;

    const cleanRow = {
      device_id: deviceId,
      name,
      device_type: cleanDeviceType,
      pole_number: poleNumber,
      substation_name: substationQuery,
      substation_id: substationId,
      feeder_name: feederQuery,
      feeder_id: feederId,
      unit,
      status: cleanStatus,
      current_setting: currentSetting,
      google_maps_url: cleanMapsUrl,
      notes: (row as any).notes || 'Import chuẩn'
    };

    validRows.push(cleanRow);

    if (!fileDeviceIdMap.has(deviceId)) {
      fileDeviceIdMap.set(deviceId, [rowNum]);
    } else {
      fileDeviceIdMap.get(deviceId)!.push(rowNum);
    }
  });

  fileDeviceIdMap.forEach((indices, devId) => {
    if (indices.length > 1) {
      fileDuplicates.push({ device_id: devId, rowIndices: indices });
    }
  });

  // Compare with Database for Existing & Conflicts
  const dbDevices = dbQuery(
    `SELECT d.id, d.device_id, d.name, d.device_type, d.status, d.google_maps_url,
            f.feeder_code, f.name as feeder_name, s.substation_code, s.name as substation_name
     FROM devices d
     LEFT JOIN feeders f ON d.feeder_id = f.id
     LEFT JOIN substations s ON d.substation_id = s.id
     WHERE d.deleted_at IS NULL`
  );

  const dbDeviceMap = new Map<string, any>();
  dbDevices.forEach(d => dbDeviceMap.set(d.device_id.toUpperCase(), d));

  const newRows: any[] = [];
  const exactDuplicates: any[] = [];
  const conflicts: any[] = [];

  validRows.forEach((row) => {
    const existing = dbDeviceMap.get(row.device_id);
    if (!existing) {
      newRows.push(row);
    } else {
      const differences: string[] = [];
      if (existing.name !== row.name) {
        differences.push(`Tên (DB: "${existing.name}" vs File: "${row.name}")`);
      }
      if (row.google_maps_url && (existing.google_maps_url || '') !== row.google_maps_url) {
        differences.push(`Link Google (DB mới vs Cũ khác nhau)`);
      }

      if (differences.length > 0) {
        conflicts.push({
          device_id: row.device_id,
          fileData: row,
          dbData: existing,
          differences
        });
      } else {
        exactDuplicates.push(row);
      }
    }
  });

  const summary = {
    total_rows: rows.length,
    valid_rows: validRows.length,
    new_rows: newRows.length,
    existing_rows: validRows.length - newRows.length,
    file_duplicates_count: fileDuplicates.length,
    exact_duplicates_count: exactDuplicates.length,
    conflicts_count: conflicts.length,
    error_rows_count: invalidRows.length
  };

  return res.json({
    success: true,
    data: {
      summary,
      validRows,
      invalidRows,
      fileDuplicates,
      conflicts,
      exactDuplicates,
      newRows
    }
  });
});

// 2. POST /api/import/confirm - Perform atomic transactional import for 8-field schema
router.post('/confirm', requirePermission('GRID_DATA_IMPORT'), (req: AuthenticatedRequest, res) => {
  const { newRows, conflictResolutions } = req.body as {
    newRows: any[];
    conflictResolutions: {
      device_id: string;
      action: 'KEEP_OLD' | 'UPDATE_FROM_FILE' | 'SKIP';
      fileData: any;
    }[];
  };

  let importedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const successItems: any[] = [];
  const failedItems: any[] = [];
  const skippedItems: any[] = [];

  try {
    dbRun('BEGIN TRANSACTION');

    if (newRows && Array.isArray(newRows)) {
      newRows.forEach((row, idx) => {
        try {
          dbRun(
            `INSERT INTO devices (device_id, name, device_type, pole_number, feeder_id, substation_id, unit, team, status, current_setting, google_maps_url, notes, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              row.device_id,
              row.name,
              row.device_type,
              row.pole_number || null,
              row.feeder_id || null,
              row.substation_id || null,
              row.unit || 'Công ty Điện lực',
              'ĐỘI VẬN HÀNH LƯỚI ĐIỆN',
              row.status || 'ACTIVE',
              row.current_setting || null,
              row.google_maps_url || null,
              row.notes || 'Import 8 trường',
              req.user!.username
            ]
          );
          importedCount++;
          successItems.push({
            row_index: row.row_index || idx + 1,
            code: row.device_id,
            name: row.name,
            type: row.device_type,
            status: 'SUCCESS',
            action: 'INSERTED',
            details: `Thêm mới thành công thiết bị ${row.device_type}`
          });
        } catch (err: any) {
          failedItems.push({
            row_index: row.row_index || idx + 1,
            code: row.device_id,
            name: row.name,
            type: row.device_type,
            status: 'FAILED',
            reason: `Lỗi chèn thiết bị ${row.device_id}: ${err.message}`
          });
        }
      });
    }

    if (conflictResolutions && Array.isArray(conflictResolutions)) {
      conflictResolutions.forEach((resItem, idx) => {
        if (resItem.action === 'SKIP' || resItem.action === 'KEEP_OLD') {
          skippedCount++;
          skippedItems.push({
            row_index: resItem.fileData?.row_index || idx + 1,
            code: resItem.device_id,
            name: resItem.fileData?.name || resItem.device_id,
            type: resItem.fileData?.device_type || 'LBS',
            status: 'SKIPPED',
            action: 'SKIPPED',
            details: resItem.action === 'KEEP_OLD' ? 'Giữ nguyên dữ liệu cũ theo lựa chọn' : 'Bỏ qua không cập nhật'
          });
        } else if (resItem.action === 'UPDATE_FROM_FILE') {
          try {
            const row = resItem.fileData;
            dbRun(
              `UPDATE devices
               SET name = ?, device_type = ?,
                   pole_number = COALESCE(?, pole_number),
                   feeder_id = COALESCE(?, feeder_id),
                   substation_id = COALESCE(?, substation_id),
                   unit = ?, status = ?, current_setting = ?, google_maps_url = ?, notes = ?,
                   updated_by = ?, updated_at = CURRENT_TIMESTAMP
               WHERE device_id = ? AND deleted_at IS NULL`,
              [
                row.name,
                row.device_type,
                row.pole_number || null,
                row.feeder_id || null,
                row.substation_id || null,
                row.unit || 'Công ty Điện lực',
                row.status || 'ACTIVE',
                row.current_setting || null,
                row.google_maps_url || null,
                row.notes || 'Cập nhật',
                req.user!.username,
                row.device_id
              ]
            );
            updatedCount++;
            successItems.push({
              row_index: row.row_index || idx + 1,
              code: row.device_id,
              name: row.name,
              type: row.device_type,
              status: 'SUCCESS',
              action: 'UPDATED',
              details: `Cập nhật thành công thông tin thiết bị ${row.device_type}`
            });
          } catch (err: any) {
            failedItems.push({
              row_index: resItem.fileData?.row_index || idx + 1,
              code: resItem.device_id,
              name: resItem.fileData?.name || resItem.device_id,
              type: resItem.fileData?.device_type || 'LBS',
              status: 'FAILED',
              reason: `Lỗi cập nhật thiết bị ${resItem.device_id}: ${err.message}`
            });
          }
        }
      });
    }

    dbRun('COMMIT');

    dbRun(
      `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user!.id,
        req.user!.username,
        req.user!.full_name,
        'IMPORT_DEVICES_8_FIELDS',
        'IMPORT',
        `BATCH_${Date.now()}`,
        `Nhập 8 trường: Thành công ${successItems.length} (Thêm mới ${importedCount}, Cập nhật ${updatedCount}), Bỏ qua ${skippedCount}, Thất bại ${failedItems.length}`,
        'SUCCESS',
        req.ip || '127.0.0.1'
      ]
    );

    return res.json({
      success: successItems.length > 0 || failedItems.length === 0,
      message: `Nhập dữ liệu hoàn tất: ${successItems.length} thành công (${importedCount} thêm mới, ${updatedCount} cập nhật), ${failedItems.length} thất bại, ${skippedCount} bỏ qua.`,
      report: {
        total_processed: successItems.length + failedItems.length + skippedCount,
        success_count: successItems.length,
        imported_new: importedCount,
        updated_existing: updatedCount,
        failed_count: failedItems.length,
        skipped_count: skippedCount,
        success_items: successItems,
        failed_items: failedItems,
        skipped_items: skippedItems
      }
    });

  } catch (error: any) {
    dbRun('ROLLBACK');
    return res.status(500).json({
      success: false,
      message: `Giao dịch thất bại! Đã tự động khôi phục dữ liệu: ${error.message}`,
      report: {
        total_processed: (newRows?.length || 0) + (conflictResolutions?.length || 0),
        success_count: 0,
        imported_new: 0,
        updated_existing: 0,
        failed_count: (newRows?.length || 0) + (conflictResolutions?.length || 0),
        skipped_count: 0,
        success_items: [],
        failed_items: [{ row_index: 0, code: 'SYSTEM', name: 'Toàn bộ gói import', status: 'FAILED', reason: error.message }]
      }
    });
  }
});

// POST /api/import/substations - Import Substations
router.post('/substations', requirePermission('GRID_DATA_IMPORT'), async (req: AuthenticatedRequest, res) => {
  const { rows } = req.body;
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, message: 'Danh sách dữ liệu trạm rỗng.' });
  }
  let imported = 0;
  let updated = 0;
  const successItems: any[] = [];
  const failedItems: any[] = [];

  try {
    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const rowNum = idx + 1;
      const code = (row.substation_code || row.ma_tram || '').toString().trim().toUpperCase();
      const name = (row.name || row.ten_tram || code).toString().trim();
      const address = (row.address || row.dia_chi || '').toString().trim();
      const status = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'].includes((row.status || '').toString().trim().toUpperCase())
        ? row.status.toUpperCase()
        : 'ACTIVE';

      if (!code && !name) {
        failedItems.push({
          row_index: rowNum,
          code: '-',
          name: '(Trống)',
          type: 'SUBSTATION',
          status: 'FAILED',
          reason: 'Thiếu cả Mã trạm và Tên trạm 110kV'
        });
        continue;
      }
      const subCode = code || `SUB_${Date.now()}_${idx}`;
      const operationId = `IMPORT_SUBSTATION_${Date.now()}*${rowNum}*${subCode}`;

      try {
        if (CORE_DATA_SOURCE === 'firestore') {
            const existing = await substationRepo.findByCode(subCode);
            if (existing) {
                await substationRepo.update(existing.id, {
                    name,
                    address,
                    status
                }, existing.version, operationId);
                updated++;
                successItems.push({
                    row_index: rowNum,
                    code: subCode,
                    name: name,
                    type: 'Trạm 110kV',
                    status: 'SUCCESS',
                    action: 'UPDATED',
                    details: `Cập nhật thành công trạm 110kV: ${name}`
                });
            } else {
                await substationRepo.create({
                    substation_code: subCode,
                    name,
                    address,
                    status
                }, operationId);
                imported++;
                successItems.push({
                    row_index: rowNum,
                    code: subCode,
                    name: name,
                    type: 'Trạm 110kV',
                    status: 'SUCCESS',
                    action: 'INSERTED',
                    details: `Thêm mới thành công trạm 110kV: ${name}`
                });
            }
        } else {
            const existing = dbQueryOne(`SELECT id FROM substations WHERE substation_code = ? OR name = ?`, [subCode, name]);
            if (existing) {
                dbRun(`UPDATE substations SET name = ?, address = ?, status = ? WHERE id = ?`, [name, address, status, existing.id]);
                updated++;
                successItems.push({
                    row_index: rowNum,
                    code: subCode,
                    name: name,
                    type: 'Trạm 110kV',
                    status: 'SUCCESS',
                    action: 'UPDATED',
                    details: `Cập nhật thành công trạm 110kV: ${name}`
                });
            } else {
                dbRun(`INSERT INTO substations (substation_code, name, address, status) VALUES (?, ?, ?, ?)`, [subCode, name, address, status]);
                imported++;
                successItems.push({
                    row_index: rowNum,
                    code: subCode,
                    name: name,
                    type: 'Trạm 110kV',
                    status: 'SUCCESS',
                    action: 'INSERTED',
                    details: `Thêm mới thành công trạm 110kV: ${name}`
                });
            }
        }
      } catch (err: any) {
        failedItems.push({
          row_index: rowNum,
          code: subCode,
          name: name,
          type: 'Trạm 110kV',
          status: 'FAILED',
          reason: `Lỗi cơ sở dữ liệu: ${err.message}`
        });
      }
    }

    res.json({
      success: successItems.length > 0 || rows.length === 0,
      message: `Nhập trạm 110kV hoàn tất: ${successItems.length} thành công (Thêm mới ${imported}, Cập nhật ${updated}), ${failedItems.length} thất bại.`,
      report: {
        total_processed: rows.length,
        success_count: successItems.length,
        imported_new: imported,
        updated_existing: updated,
        failed_count: failedItems.length,
        skipped_count: 0,
        success_items: successItems,
        failed_items: failedItems
      }
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /api/import/feeders - Import Feeders
router.post('/feeders', requirePermission('GRID_DATA_IMPORT'), async (req: AuthenticatedRequest, res) => {
  const { rows } = req.body;
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, message: 'Danh sách dữ liệu phát tuyến rỗng.' });
  }
  let imported = 0;
  let updated = 0;
  const successItems: any[] = [];
  const failedItems: any[] = [];

  try {
    const substations = await substationRepo.list();
    const subMap = new Map<string, string>();
    substations.forEach(s => {
      subMap.set(s.substation_code.toUpperCase(), s.id);
      subMap.set(s.name.toUpperCase(), s.id);
    });

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const rowNum = idx + 1;
      const code = (row.feeder_code || row.ma_phat_tuyen || '').toString().trim().toUpperCase();
      const name = (row.name || row.ten_phat_tuyen || code).toString().trim();
      const subQuery = (row.substation_name || row.tram_110kv || '').toString().trim();
      const status = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'].includes((row.status || '').toString().trim().toUpperCase())
        ? row.status.toUpperCase()
        : 'ACTIVE';

      if (!code && !name) {
        failedItems.push({
          row_index: rowNum,
          code: '-',
          name: '(Trống)',
          type: 'Phát tuyến',
          status: 'FAILED',
          reason: 'Thiếu cả Mã phát tuyến và Tên phát tuyến'
        });
        continue;
      }

      const feederCode = code || `FD_${Date.now()}_${idx}`;
      const substationId = subMap.get(subQuery.toUpperCase());

      if (!substationId) {
        failedItems.push({
          row_index: rowNum,
          code: feederCode,
          name: name,
          type: 'Phát tuyến',
          status: 'FAILED',
          reason: `Không tìm thấy Trạm 110kV: ${subQuery}`
        });
        continue;
      }

      try {
        if (CORE_DATA_SOURCE === 'firestore') {
          const existing = await feederRepo.findByCode(feederCode);
          const operationId = `IMPORT_FEEDER_${Date.now()}*${rowNum}*${feederCode}`;

          if (existing) {
            await feederRepo.update(existing.id, {
              name,
              substation_id: String(substationId),
              status
            }, existing.version, operationId);
            updated++;
            successItems.push({
              row_index: rowNum,
              code: feederCode,
              name: name,
              type: 'Phát tuyến',
              status: 'SUCCESS',
              action: 'UPDATED',
              details: `Cập nhật thành công phát tuyến: ${name}`
            });
          } else {
            await feederRepo.create({
              feeder_code: feederCode,
              name,
              substation_id: substationId,
              status,
              createdBy: String(req.user!.id),
              updatedBy: String(req.user!.id)
            }, operationId);
            imported++;
            successItems.push({
              row_index: rowNum,
              code: feederCode,
              name: name,
              type: 'Phát tuyến',
              status: 'SUCCESS',
              action: 'INSERTED',
              details: `Thêm mới thành công phát tuyến: ${name}`
            });
          }
        } else {
          // Keep SQLite logic for backward compatibility if needed, but the prompt says 100% Firestore.
          throw new Error('Not implemented for SQLite');
        }
      } catch (err: any) {
        failedItems.push({
          row_index: rowNum,
          code: feederCode,
          name: name,
          type: 'Phát tuyến',
          status: 'FAILED',
          reason: `Lỗi cơ sở dữ liệu: ${err.message}`
        });
      }
    }

    res.json({
      success: true,
      message: `Nhập phát tuyến hoàn tất: ${successItems.length} thành công (Thêm mới ${imported}, Cập nhật ${updated}), ${failedItems.length} thất bại.`,
      report: {
        total_processed: rows.length,
        success_count: successItems.length,
        imported_new: imported,
        updated_existing: updated,
        failed_count: failedItems.length,
        skipped_count: 0,
        success_items: successItems,
        failed_items: failedItems
      }
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /api/import/loops - Import Loops
router.post('/loops', requirePermission('GRID_DATA_IMPORT'), async (req: AuthenticatedRequest, res) => {
  const { rows } = req.body;
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, message: 'Danh sách dữ liệu khép vòng rỗng.' });
  }
  let imported = 0;
  let updated = 0;
  const successItems: any[] = [];
  const failedItems: any[] = [];

  try {
    const substations = await substationRepo.list();
    const subMap = new Map<string, string>();
    substations.forEach(s => {
      subMap.set(s.substation_code.toUpperCase(), s.id);
      subMap.set(s.name.toUpperCase(), s.id);
    });

    const feeders = await feederRepo.list();
    const feederMap = new Map<string, { id: string; substation_id: string }>();
    feeders.forEach(f => {
      feederMap.set(f.feeder_code.toUpperCase(), { id: f.id, substation_id: f.substation_id });
      feederMap.set(f.name.toUpperCase(), { id: f.id, substation_id: f.substation_id });
    });

    const devices = await deviceRepo.list();
    const devMap = new Map<string, any>();
    devices.forEach(d => {
      if (d.device_id) devMap.set(d.device_id.toUpperCase(), d);
      if (d.name) devMap.set(d.name.toUpperCase(), d);
    });

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const rowNum = idx + 1;
      const loopId = (row.loop_id || row.ma_khep_vong || row.code || '').toString().trim().toUpperCase();
      const name = (row.name || row.ten_khep_vong || loopId).toString().trim();
      const subAStr = (row.station_a || row.tram_a || row.tram_phia_a || '').toString().trim();
      const feederAStr = (row.feeder_a || row.tuyen_a || row.phat_tuyen_a || row.phat_tuyen_phia_a || '').toString().trim();
      const deviceAStr = (row.device_a || row.thiet_bi_a || row.thiet_bi_phia_a || '').toString().trim();
      const loopDevStr = (row.loop_device || row.loop_device_id || row.thiet_bi_chinh || row.thiet_bi_khep_vong_chinh || '').toString().trim();
      const deviceBStr = (row.device_b || row.thiet_bi_b || row.thiet_bi_phia_b || '').toString().trim();
      const feederBStr = (row.feeder_b || row.tuyen_b || row.phat_tuyen_b || row.phat_tuyen_phia_b || '').toString().trim();
      const subBStr = (row.station_b || row.tram_b || row.tram_phia_b || '').toString().trim();
      
      if (!loopId && !name) {
        failedItems.push({ row_index: rowNum, code: '-', name: '(Trống)', type: 'Khép vòng', status: 'FAILED', reason: 'Thiếu cả Mã khép vòng và Tên khép vòng' });
        continue;
      }

      // Validations
      const devAObj = devMap.get(deviceAStr.toUpperCase());
      const devBObj = devMap.get(deviceBStr.toUpperCase());
      const loopDevObj = devMap.get(loopDevStr.toUpperCase());
      const feederAObj = feederMap.get(feederAStr.toUpperCase());
      const feederBObj = feederMap.get(feederBStr.toUpperCase());
      const subAId = subMap.get(subAStr.toUpperCase());
      const subBId = subMap.get(subBStr.toUpperCase());

      if (!subAId || !subBId || !feederAObj || !feederBObj || !devAObj || !devBObj || !loopDevObj) {
        const errors = [];
        if (!subAId) errors.push(`Không tìm thấy Trạm A: ${subAStr}`);
        if (!subBId) errors.push(`Không tìm thấy Trạm B: ${subBStr}`);
        if (!feederAObj) errors.push(`Không tìm thấy Phát tuyến A: ${feederAStr}`);
        if (!feederBObj) errors.push(`Không tìm thấy Phát tuyến B: ${feederBStr}`);
        if (!devAObj) errors.push(`Không tìm thấy Thiết bị A: ${deviceAStr}`);
        if (!devBObj) errors.push(`Không tìm thấy Thiết bị B: ${deviceBStr}`);
        if (!loopDevObj) errors.push(`Không tìm thấy Thiết bị khép vòng: ${loopDevStr}`);
        
        failedItems.push({ row_index: rowNum, code: loopId, name, type: 'Khép vòng', status: 'FAILED', reason: errors.join(', ') });
        continue;
      }

      // Validate relationships
      if (feederAObj.substation_id !== subAId) failedItems.push({ row_index: rowNum, code: loopId, name, type: 'Khép vòng', status: 'FAILED', reason: 'Phát tuyến A không thuộc Trạm A' });
      if (feederBObj.substation_id !== subBId) failedItems.push({ row_index: rowNum, code: loopId, name, type: 'Khép vòng', status: 'FAILED', reason: 'Phát tuyến B không thuộc Trạm B' });
      if (devAObj.feeder_id !== feederAObj.id) failedItems.push({ row_index: rowNum, code: loopId, name, type: 'Khép vòng', status: 'FAILED', reason: 'Thiết bị A không thuộc Phát tuyến A' });
      if (devBObj.feeder_id !== feederBObj.id) failedItems.push({ row_index: rowNum, code: loopId, name, type: 'Khép vòng', status: 'FAILED', reason: 'Thiết bị B không thuộc Phát tuyến B' });

      if (failedItems.length > 0 && failedItems[failedItems.length - 1].row_index === rowNum) continue;

      try {
        const existingLoops = await loopRepo.list();
        const existing = existingLoops.find(l => l.loop_id === loopId);

        const loopData = {
          loop_id: loopId,
          name,
          substation_id_a: subAId,
          feeder_id_a: feederAObj.id,
          device_id_a: devAObj.device_id,
          substation_id_b: subBId,
          feeder_id_b: feederBObj.id,
          device_id_b: devBObj.device_id,
          loop_device_id: loopDevObj.device_id,
          status: 'ACTIVE',
          createdBy: String(req.user!.id),
          updatedBy: String(req.user!.id)
        };

        if (existing) {
          await loopRepo.update(existing.id, loopData);
          updated++;
          successItems.push({ row_index: rowNum, code: loopId, name, type: 'Khép vòng', status: 'SUCCESS', action: 'UPDATED', details: 'Cập nhật thành công' });
        } else {
          await loopRepo.create(loopData);
          imported++;
          successItems.push({ row_index: rowNum, code: loopId, name, type: 'Khép vòng', status: 'SUCCESS', action: 'INSERTED', details: 'Thêm mới thành công' });
        }
      } catch (err: any) {
        failedItems.push({ row_index: rowNum, code: loopId, name, type: 'Khép vòng', status: 'FAILED', reason: err.message });
      }
    }

    res.json({
      success: true,
      message: `Nhập khép vòng hoàn tất`,
      report: {
        total_processed: rows.length,
        success_count: successItems.length,
        imported_new: imported,
        updated_existing: updated,
        failed_count: failedItems.length,
        skipped_count: 0,
        success_items: successItems,
        failed_items: failedItems
      }
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

export default router;
