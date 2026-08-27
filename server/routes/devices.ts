import { Router, Response } from 'express';
import { dbQuery, dbQueryOne, dbRun } from '../db';
import { generateNextDeviceCode } from '../utils/deviceCode';
import { broadcastRealtimeEvent } from '../events';
import {
  authenticateToken,
  denyGuestMutations,
  requirePermission,
  requireAnyPermission,
  recordAuditLog,
  AuthenticatedRequest
} from '../middleware';
import { CORE_DATA_SOURCE, DEVICE_IMAGE_FEATURE_ENABLED } from '../config';
import { getTargetFirestore } from '../firebaseAdmin';
import { deviceRepo } from '../repositories/firestore/deviceRepository';
import { deviceStatusHistoryRepo } from '../repositories/firestore/deviceStatusHistoryRepository';
import { deviceImageRepo } from '../repositories/firestore/deviceImageRepository';
import { substationRepo } from '../repositories/firestore/substationRepository';
import { feederRepo } from '../repositories/firestore/feederRepository';
import { deviceLocationRepo } from '../repositories/firestore/deviceLocationRepository';

// Helper for SQLite write guard
function checkSqliteGuard() {
  if (CORE_DATA_SOURCE === 'firestore') {
    throw new Error('SQLITE_WRITE_FORBIDDEN');
  }
}

const router = Router();

function cleanRelay79(val: any, fallback = 'N_A'): string {
  if (!val || typeof val !== 'string') return fallback;
  const firstWord = val.trim().split(' ')[0].toUpperCase();
  if (firstWord === 'ON') return 'ON';
  if (firstWord === 'OFF') return 'OFF';
  if (['N_A', 'NA', 'N/A'].includes(firstWord)) return 'N_A';
  return fallback;
}

function cleanSwitchStatus(val: any, fallback = 'UNKNOWN'): string {
  if (!val || typeof val !== 'string') return fallback;
  const firstWord = val.trim().split(' ')[0].toUpperCase();
  if (['CLOSED', 'OPEN', 'UNKNOWN'].includes(firstWord)) return firstWord;
  return fallback;
}

function cleanScadaStatus(val: any, fallback = 'UNKNOWN'): string {
  if (!val || typeof val !== 'string') return fallback;
  const firstWord = val.trim().split(' ')[0].toUpperCase();
  if (['SIGNAL', 'NO_SIGNAL', 'UNKNOWN'].includes(firstWord)) return firstWord;
  return fallback;
}

function cleanStatus(val: any, fallback = 'ACTIVE'): string {
  if (!val || typeof val !== 'string') return fallback;
  const firstWord = val.trim().split(' ')[0].toUpperCase();
  if (['ACTIVE', 'INACTIVE', 'MAINTENANCE'].includes(firstWord)) return firstWord;
  return fallback;
}

function cleanBatteryStatus(val: any, fallback = 'UNCHECKED'): string {
  if (!val || typeof val !== 'string') return fallback;
  const v = val.trim().toUpperCase();
  if (['GOOD', 'TỐT'].includes(v)) return 'GOOD';
  if (['WEAK', 'YẾU'].includes(v)) return 'WEAK';
  if (['BROKEN', 'HỎNG'].includes(v)) return 'BROKEN';
  if (['REPLACING', 'ĐANG THAY'].includes(v)) return 'REPLACING';
  if (['UNCHECKED', 'CHƯA KIỂM TRA'].includes(v)) return 'UNCHECKED';
  if (['GOOD', 'WEAK', 'BROKEN', 'REPLACING', 'UNCHECKED'].includes(v)) return v;
  return fallback;
}

// 1. Endpoint to check DEVICE_ID uniqueness in real-time
router.get('/check-device-id/:deviceId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { excludeId } = req.query;

    if (CORE_DATA_SOURCE === 'firestore') {
        const db = getTargetFirestore();
        let query = db.collection('devices')
            .where('device_id', '==', deviceId.trim().toUpperCase())
            .where('isDeleted', '==', false);
        
        const snapshot = await query.get();
        let existing: any = null;
        
        for (const doc of snapshot.docs) {
            if (String(doc.id) !== String(excludeId)) {
                existing = { id: doc.id, ...doc.data() };
                break;
            }
        }

        return res.json({
            success: true,
            exists: !!existing,
            device: existing || null,
            message: existing ? `DEVICE_ID "${deviceId}" đã bị trùng với thiết bị "${existing.name}"` : 'DEVICE_ID hợp lệ'
        });
    }

    let sql = `SELECT id, name, device_id FROM devices WHERE LOWER(device_id) = LOWER(?) AND deleted_at IS NULL`;
    const params: any[] = [deviceId.trim()];

    if (excludeId) {
      sql += ` AND id != ?`;
      params.push(excludeId);
    }

    const existing = dbQueryOne(sql, params);

    return res.json({
      success: true,
      exists: !!existing,
      device: existing || null,
      message: existing ? `DEVICE_ID "${deviceId}" đã bị trùng với thiết bị "${existing.name}"` : 'DEVICE_ID hợp lệ'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Lỗi kiểm tra DEVICE_ID' });
  }
});

// Preview auto-generated device code
router.get('/preview-code', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { device_type, feeder_id, substation_id } = req.query;
    if (!device_type) {
      return res.status(400).json({ success: false, message: 'Thiếu loại thiết bị' });
    }
    const code = generateNextDeviceCode(
      device_type.toString(),
      feeder_id ? Number(feeder_id) : null,
      substation_id ? Number(substation_id) : null
    );
    return res.json({ success: true, code });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Lỗi sinh mã dự kiến' });
  }
});

// Bulk Update Devices
router.post(
  '/bulk-update',
  authenticateToken,
  denyGuestMutations,
  requireAnyPermission(['equipment:update', 'DEVICE_EDIT']),
  (req: AuthenticatedRequest, res: Response) => {
    if (CORE_DATA_SOURCE === 'firestore') {
       return res.status(501).json({ success: false, message: 'Cập nhật hàng loạt chưa được hỗ trợ trên cơ sở dữ liệu hiện tại.' });
    }
    try {
      const { device_ids, updates, reason } = req.body;

      if (!Array.isArray(device_ids) || device_ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng chọn ít nhất một thiết bị để cập nhật.'
        });
      }

      if (!updates || typeof updates !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu cập nhật không hợp lệ.'
        });
      }

      const {
        status,
        switch_status,
        scada_status,
        relay_79,
        battery_status,
        notes
      } = updates;

      let updatedCount = 0;
      const updatedNames: string[] = [];

      for (const rawId of device_ids) {
        const id = Number(rawId);
        if (isNaN(id)) continue;

        const device = dbQueryOne(`SELECT * FROM devices WHERE id = ? AND deleted_at IS NULL`, [id]);
        if (!device) continue;

        const newStatus = status !== undefined ? cleanStatus(status, device.status) : device.status;
        const newSwitchStatus = switch_status !== undefined ? cleanSwitchStatus(switch_status, device.switch_status) : device.switch_status;
        const newScadaStatus = scada_status !== undefined ? cleanScadaStatus(scada_status, device.scada_status) : device.scada_status;
        const newRelay79 = relay_79 !== undefined ? cleanRelay79(relay_79, device.relay_79) : device.relay_79;
        const newBatteryStatus = battery_status !== undefined ? cleanBatteryStatus(battery_status, device.battery_status || 'UNCHECKED') : device.battery_status;
        const newNotes = notes !== undefined ? (notes ? `${device.notes ? device.notes + ' | ' : ''}${notes}` : device.notes) : device.notes;

        const switchChanged = newSwitchStatus !== device.switch_status;
        const scadaChanged = newScadaStatus !== device.scada_status;
        const relayChanged = newRelay79 !== device.relay_79;

        if (switchChanged || scadaChanged || relayChanged) {
          dbRun(
            `INSERT INTO device_status_history (device_id, old_switch_status, new_switch_status, old_scada_status, new_scada_status, old_relay_79, new_relay_79, note, updated_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              device.switch_status,
              newSwitchStatus,
              device.scada_status,
              newScadaStatus,
              device.relay_79,
              newRelay79,
              reason ? `Cập nhật hàng loạt: ${reason}` : 'Cập nhật trạng thái hàng loạt',
              req.user?.username || 'SYSTEM'
            ]
          );
        }

        dbRun(
          `UPDATE devices SET
            status = ?,
            switch_status = ?,
            scada_status = ?,
            relay_79 = ?,
            battery_status = ?,
            notes = ?,
            updated_at = CURRENT_TIMESTAMP,
            updated_by = ?
           WHERE id = ?`,
          [
            newStatus,
            newSwitchStatus,
            newScadaStatus,
            newRelay79,
            newBatteryStatus,
            newNotes,
            req.user?.username || 'SYSTEM',
            id
          ]
        );

        updatedCount++;
        updatedNames.push(device.name);
      }

      recordAuditLog({
        user_id: req.user!.id,
        username: req.user!.username,
        user_fullname: req.user!.full_name,
        action: 'BULK_UPDATE_DEVICES',
        module: 'QUAN_LY_THIET_BI',
        target_id: 0,
        details: `Cập nhật hàng loạt ${updatedCount} thiết bị: ${updatedNames.slice(0, 5).join(', ')}${updatedNames.length > 5 ? ` và ${updatedNames.length - 5} thiết bị khác` : ''}. ${reason ? `Lý do: ${reason}` : ''}`,
        result: 'SUCCESS',
        ip_address: req.ip
      });

      broadcastRealtimeEvent({
        type: 'BULK_UPDATE',
        entity: 'DEVICE',
        action: 'UPDATE',
        data: { count: updatedCount }
      });

      return res.json({
        success: true,
        message: `Đã cập nhật thành công ${updatedCount} thiết bị.`,
        updated_count: updatedCount
      });
    } catch (err: any) {
      console.error('Error bulk updating devices:', err);
      return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật hàng loạt thiết bị' });
    }
  }
);

// 2. Get List of Devices with Search & Multi-Filters
router.get('/', authenticateToken, requireAnyPermission(['equipment:read', 'DEVICE_VIEW']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      search,
      device_type,
      substation_id,
      feeder_id,
      status,
      switch_status,
      scada_status,
      pole_number,
      sortBy,
      sortOrder
    } = req.query;

    if (CORE_DATA_SOURCE === 'firestore') {
        const [devices, substations, feeders] = await Promise.all([
            deviceRepo.list(),
            substationRepo.list(),
            feederRepo.list()
        ]);
        const subMap = new Map(substations.map(s => [String(s.id), s]));
        const feederMap = new Map(feeders.map(f => [String(f.id), f]));

        let enrichedDevices = devices.map(d => {
            const sub = subMap.get(String(d.substation_id));
            const feeder = feederMap.get(String(d.feeder_id));
            return {
                ...d,
                substation_name: sub ? sub.name : null,
                substation_code: sub ? sub.substation_code : null,
                feeder_name: feeder ? feeder.name : null,
                feeder_code: feeder ? feeder.feeder_code : null,
                device_type: d.device_type === 'RCL' ? 'REC' : d.device_type
            };
        });

        if (substation_id) {
            enrichedDevices = enrichedDevices.filter(d => String(d.substation_id) === String(substation_id));
        }
        if (feeder_id) {
            enrichedDevices = enrichedDevices.filter(d => String(d.feeder_id) === String(feeder_id));
        }
        if (device_type) {
            const dt = device_type.toString().toUpperCase() === 'RCL' ? 'REC' : device_type.toString().toUpperCase();
            enrichedDevices = enrichedDevices.filter(d => d.device_type === dt || d.device_type === (dt === 'REC' ? 'RCL' : dt));
        }
        if (status) {
            enrichedDevices = enrichedDevices.filter(d => String(d.status) === String(status));
        }
        if (switch_status) {
            // @ts-ignore
            enrichedDevices = enrichedDevices.filter(d => String(d.switch_status) === String(switch_status));
        }
        if (scada_status) {
            // @ts-ignore
            enrichedDevices = enrichedDevices.filter(d => String(d.scada_status) === String(scada_status));
        }
        if (search) {
            const q = search.toString().toLowerCase();
            enrichedDevices = enrichedDevices.filter(d => 
                (d.device_id && String(d.device_id).toLowerCase().includes(q)) ||
                (d.device_code && String(d.device_code).toLowerCase().includes(q)) ||
                (d.name && String(d.name).toLowerCase().includes(q)) ||
                (d.pole_number && String(d.pole_number).toLowerCase().includes(q)) ||
                (d.notes && String(d.notes).toLowerCase().includes(q))
            );
        }

        return res.json({ success: true, data: enrichedDevices });
    }
    
    // Shadow read
    if (CORE_DATA_SOURCE === 'sqlite-shadow') {
        deviceRepo.list().catch(e => console.error('Shadow read error:', e));
    }

    let sql = `
      SELECT 
        d.*,
        s.name as substation_name,
        s.substation_code,
        f.name as feeder_name,
        f.feeder_code,
        (SELECT image_url FROM device_images img WHERE img.device_id = d.id AND img.is_primary = 1 LIMIT 1) as primary_image
      FROM devices d
      LEFT JOIN substations s ON d.substation_id = s.id
      LEFT JOIN feeders f ON d.feeder_id = f.id
      WHERE d.deleted_at IS NULL
    `;
    const params: any[] = [];

    // Filter by Scope if user is restricted
    if (req.user) {
      const scope = req.user.scopes[0];
      if (scope && scope.scope_type === 'TRAM') {
        sql += ` AND (s.name LIKE ? OR d.substation_id IN (SELECT id FROM substations WHERE name LIKE ?))`;
        const scopeTerm = `%${scope.scope_value}%`;
        params.push(scopeTerm, scopeTerm);
      } else if (scope && scope.scope_type === 'PHAT_TUYEN') {
        sql += ` AND (f.name LIKE ? OR d.feeder_id IN (SELECT id FROM feeders WHERE name LIKE ?))`;
        const scopeTerm = `%${scope.scope_value}%`;
        params.push(scopeTerm, scopeTerm);
      }
    }

    if (search) {
      sql += ` AND (d.device_id LIKE ? OR d.device_code LIKE ? OR d.name LIKE ? OR d.pole_number LIKE ? OR d.notes LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }

    if (device_type) {
      const dbType = device_type.toString().toUpperCase() === 'REC' ? 'RCL' : device_type;
      sql += ` AND d.device_type = ?`;
      params.push(dbType);
    }

    if (substation_id) {
      sql += ` AND d.substation_id = ?`;
      params.push(substation_id);
    }

    if (feeder_id) {
      sql += ` AND d.feeder_id = ?`;
      params.push(feeder_id);
    }

    if (status) {
      sql += ` AND d.status = ?`;
      params.push(status);
    }
    
    // Sorting
    const validSortColumns = ['name', 'device_id', 'substation_name', 'status']; // Add more as needed
    const sortByCol = validSortColumns.includes(sortBy as string) ? sortBy : 'd.id';
    const sortOrderVal = sortOrder?.toString().toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    
    if (switch_status) {
      sql += ` AND d.switch_status = ?`;
      params.push(switch_status);
    }

    if (scada_status) {
      sql += ` AND d.scada_status = ?`;
      params.push(scada_status);
    }

    if (pole_number) {
      sql += ` AND d.pole_number LIKE ?`;
      params.push(`%${pole_number}%`);
    }

    sql += ` ORDER BY ${sortByCol} ${sortOrderVal}`;

    const rawDevices = dbQuery(sql, params);
    const devices = rawDevices.map((d: any) => ({
      ...d,
      device_type: d.device_type === 'RCL' ? 'REC' : d.device_type
    }));
    return res.json({ success: true, data: devices });
  } catch (err: any) {
    console.error('Error fetching devices:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách thiết bị' });
  }
});

// 3. Get Single Device Details (with Images, Location History, Status History, Audit Logs)
router.get('/:id', authenticateToken, requireAnyPermission(['equipment:read', 'DEVICE_VIEW']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (CORE_DATA_SOURCE === 'firestore') {
        const device = await deviceRepo.getById(id);
        if (!device) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin thiết bị' });
        }
        const [sub, feeder, images, locationHistory] = await Promise.all([
            device.substation_id ? substationRepo.getById(String(device.substation_id)) : Promise.resolve(null),
            device.feeder_id ? feederRepo.getById(String(device.feeder_id)) : Promise.resolve(null),
            deviceImageRepo.getByDeviceId(id),
            deviceLocationRepo.getByDeviceId(id)
        ]);
        return res.json({
            success: true,
            data: {
                ...device,
                substation_name: sub ? sub.name : null,
                substation_code: sub ? sub.substation_code : null,
                feeder_name: feeder ? feeder.name : null,
                feeder_code: feeder ? feeder.feeder_code : null,
                images,
                locationHistory
            }
        });
    }

    const device = dbQueryOne(
      `SELECT 
        d.*,
        s.name as substation_name,
        s.substation_code,
        f.name as feeder_name,
        f.feeder_code
       FROM devices d
       LEFT JOIN substations s ON d.substation_id = s.id
       LEFT JOIN feeders f ON d.feeder_id = f.id
       WHERE d.id = ? AND d.deleted_at IS NULL`,
      [id]
    );

    if (!device) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin thiết bị' });
    }

    // Get Images
    const images = dbQuery(
      `SELECT * FROM device_images WHERE device_id = ? ORDER BY is_primary DESC, id DESC`,
      [id]
    );

    // Get Location History
    const locationHistory = dbQuery(
      `SELECT * FROM device_locations WHERE device_id = ? ORDER BY created_at DESC LIMIT 20`,
      [id]
    );

    // Get Status History
    const statusHistory = dbQuery(
      `SELECT * FROM device_status_history WHERE device_id = ? ORDER BY created_at DESC LIMIT 20`,
      [id]
    );

    // Get Device Audit Trail
    const auditLogs = dbQuery(
      `SELECT * FROM audit_logs WHERE target_id = ? AND module = 'QUAN_LY_THIET_BI' ORDER BY created_at DESC LIMIT 20`,
      [id]
    );

    const mappedDevice = {
      ...device,
      device_type: device.device_type === 'RCL' ? 'REC' : device.device_type,
      images,
      location_history: locationHistory,
      status_history: statusHistory,
      audit_logs: auditLogs
    };

    return res.json({
      success: true,
      data: mappedDevice
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xem chi tiết thiết bị' });
  }
});

// 4. Create New Device
router.post(
  '/',
  authenticateToken,
  denyGuestMutations,
  requirePermission('equipment:create'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        device_id,
        device_code,
        name,
        device_type,
        feeder_id,
        substation_id,
        status,
        operationId,
        latitude,
        longitude
      } = req.body;

      if (!operationId) return res.status(400).json({ success: false, code: 'OPERATION_ID_REQUIRED' });
      if (!name || !device_type || !substation_id || !feeder_id) {
          return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
      }

      if (CORE_DATA_SOURCE === 'firestore') {
          // Verify relations
          const substation = await substationRepo.getById(substation_id.toString()) as any;
          if (!substation || substation.isDeleted) return res.status(400).json({ success: false, message: 'Trạm không tồn tại' });
          const feeder = await feederRepo.getById(feeder_id.toString()) as any;
          if (!feeder || feeder.isDeleted || String(feeder.substation_id) !== String(substation_id)) {
              return res.status(400).json({ success: false, message: 'Phát tuyến không hợp lệ' });
          }

        const created = await deviceRepo.create({
              substation_id: (isNaN(Number(substation_id)) ? substation_id : Number(substation_id)),
              feeder_id: (isNaN(Number(feeder_id)) ? feeder_id : Number(feeder_id)),
              device_id: device_id || device_code,
              device_code: device_code || device_id,
              name: name.trim(),
              status: status || 'ACTIVE',
              device_type: device_type || 'OTHER',
              unit: req.body.unit,
              team: req.body.team,
              notes: req.body.notes,
              latitude: latitude ? parseFloat(latitude) : undefined,
              longitude: longitude ? parseFloat(longitude) : undefined,
              pole_number: req.body.pole_number,
              switch_status: req.body.switch_status,
              scada_status: req.body.scada_status,
              relay_79: req.body.relay_79,
              battery_status: req.body.battery_status,
              settings: req.body.settings,
              createdBy: req.user?.username || 'SYSTEM',
              updatedBy: req.user?.username || 'SYSTEM'
          }, operationId);
          
          recordAuditLog({
            user_id: req.user!.id,
            username: req.user!.username,
            user_fullname: req.user!.full_name,
            action: 'CREATE_DEVICE',
            module: 'QUAN_LY_THIET_BI',
            target_id: created.id,
            details: `Tạo thiết bị: ${name}`,
            result: 'SUCCESS',
            ip_address: req.ip
          });
          broadcastRealtimeEvent({ type: 'CREATE', entity: 'DEVICE', id: created.id });
          return res.status(201).json({ success: true, data: created });
      }

      checkSqliteGuard();
      return res.status(500).json({ success: false, message: 'Ghi SQLite bị chặn' });
    } catch (err: any) {
      console.error('Error creating device:', err);
      return res.status(500).json({ success: false, message: 'Lỗi server khi thêm thiết bị' });
    }
  }
);

// 5. Update Device
router.put(
  '/:id',
  authenticateToken,
  denyGuestMutations,
  requirePermission('equipment:update'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const {
        device_id,
        name,
        feeder_id,
        substation_id,
        status,
        operationId,
        expectedVersion,
        latitude,
        longitude
      } = req.body;

      if (!operationId) return res.status(400).json({ success: false, code: 'OPERATION_ID_REQUIRED' });
      if (expectedVersion === undefined) return res.status(400).json({ success: false, code: 'EXPECTED_VERSION_REQUIRED' });

      if (CORE_DATA_SOURCE === 'firestore') {
          const device = await deviceRepo.getById(id);
          if (!device) return res.status(404).json({ success: false, message: 'Thiết bị không tồn tại' });

          try {
              const updated = await deviceRepo.update(id, {
                  substation_id: substation_id ? (isNaN(Number(substation_id)) ? substation_id : Number(substation_id)) : device.substation_id,
                  feeder_id: feeder_id ? (isNaN(Number(feeder_id)) ? feeder_id : Number(feeder_id)) : device.feeder_id,
                  name: name?.trim() || device.name,
                  status: status || device.status,
                  device_type: req.body.device_type || device.device_type,
                  unit: req.body.unit || device.unit,
                  team: req.body.team || device.team,
                  notes: req.body.notes !== undefined ? req.body.notes : device.notes,
                  latitude: latitude ? parseFloat(latitude) : device.latitude,
                  longitude: longitude ? parseFloat(longitude) : device.longitude,
                  pole_number: req.body.pole_number !== undefined ? req.body.pole_number : device.pole_number,
                  switch_status: req.body.switch_status || device.switch_status,
                  scada_status: req.body.scada_status || device.scada_status,
                  relay_79: req.body.relay_79 || device.relay_79,
                  battery_status: req.body.battery_status || device.battery_status,
                  settings: req.body.settings || device.settings,
                  updatedBy: req.user?.username || 'SYSTEM'
              }, expectedVersion, operationId);

              // Log status/location history here if needed, in a real scenario this would be in a transaction
              
              recordAuditLog({
                user_id: req.user!.id,
                username: req.user!.username,
                user_fullname: req.user!.full_name,
                action: 'UPDATE_DEVICE',
                module: 'QUAN_LY_THIET_BI',
                target_id: id,
                details: `Cập nhật thiết bị: ${updated.name}`,
                result: 'SUCCESS',
                ip_address: req.ip
              });
              broadcastRealtimeEvent({ type: 'UPDATE', entity: 'DEVICE', id: id });
              return res.json({ success: true, data: updated });
          } catch (err: any) {
              if (err.message === 'VERSION_CONFLICT') return res.status(409).json({ success: false, code: 'VERSION_CONFLICT', message: 'Dữ liệu đã được thay đổi trên thiết bị khác.' });
              throw err;
          }
      }

      checkSqliteGuard();
      return res.status(500).json({ success: false, message: 'Ghi SQLite bị chặn' });
    } catch (err: any) {
      console.error('Error updating device:', err);
      return res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật thiết bị' });
    }
  }
);

// 6. Soft Delete Device
router.delete(
  '/:id',
  authenticateToken,
  denyGuestMutations,
  requirePermission('equipment:delete'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { operationId } = req.body;
      if (!operationId) return res.status(400).json({ success: false, code: 'OPERATION_ID_REQUIRED' });

      if (CORE_DATA_SOURCE === 'firestore') {
          const device = await deviceRepo.getById(id);
          if (!device) return res.status(404).json({ success: false, message: 'Thiết bị không tồn tại' });
          // Note: tasks are not fully migrated, but if they are, we'd check them here
          try {
              await deviceRepo.delete(id, operationId);
              
              recordAuditLog({
                user_id: req.user!.id,
                username: req.user!.username,
                user_fullname: req.user!.full_name,
                action: 'DELETE_DEVICE',
                module: 'QUAN_LY_THIET_BI',
                target_id: id,
                details: `Xóa mềm thiết bị: ${id}`,
                result: 'SUCCESS',
                ip_address: req.ip
              });
              broadcastRealtimeEvent({ type: 'DELETE', entity: 'DEVICE', id: id });
              return res.json({ success: true, message: 'Đã xóa thiết bị thành công' });
          } catch (err: any) {
              throw err;
          }
      }

      // SQLite-based dependency checks remain for now as other modules are not yet migrated
      const device = dbQueryOne(`SELECT * FROM devices WHERE id = ? AND deleted_at IS NULL`, [id]);
      if (!device) return res.status(404).json({ success: false, message: 'Thiết bị không tồn tại' });
      
      // ... check dependencies (simplified)
      // Check active tasks
      const activeTasks = dbQuery(`SELECT id FROM tasks WHERE device_id = ? AND status NOT IN ('COMPLETED', 'CANCELLED')`, [id]);
      if (activeTasks.length > 0) return res.status(409).json({ success: false, code: 'DEVICE_HAS_ACTIVE_RELATIONS' });

      checkSqliteGuard();
      return res.status(500).json({ success: false, message: 'Ghi SQLite bị chặn' });
    } catch (err: any) {
      console.error('Error deleting device:', err);
      return res.status(500).json({ success: false, message: 'Lỗi server khi xóa thiết bị' });
    }
  }
);

// 7. Manage Device Images
router.post(
  '/:id/images',
  authenticateToken,
  denyGuestMutations,
  requirePermission('equipment:update'),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!DEVICE_IMAGE_FEATURE_ENABLED) {
        return res.status(503).json({ success: false, code: 'IMAGE_FEATURE_TEMPORARILY_DISABLED', message: 'Chức năng cập nhật hình ảnh đang tạm khóa.' });
    }
    try {
      const { id } = req.params;
      let { image_url, caption, is_primary } = req.body;

      if (!image_url) {
        return res.status(400).json({ success: false, message: 'Đường dẫn hình ảnh là bắt buộc' });
      }

      let finalUrl = image_url;
      if (image_url.startsWith('data:image')) {
          try {
              const { uploadBase64ToStorage } = require('../firebaseStorage');
              finalUrl = await uploadBase64ToStorage(image_url, `devices/${id}`);
          } catch (e: any) {
              console.error('Lỗi upload ảnh:', e);
              return res.status(500).json({ success: false, message: 'Không thể upload ảnh lên Storage' });
          }
      }

      if (CORE_DATA_SOURCE === 'firestore') {
          if (is_primary) {
              const db = getTargetFirestore();
              const existingPrimary = await db.collection('device_images')
                  .where('device_id', '==', id)
                  .where('isPrimary', '==', true)
                  .get();
              for (const doc of existingPrimary.docs) {
                  await doc.ref.update({ isPrimary: false });
              }
          }
          await deviceImageRepo.add({
              device_id: id,
              storagePath: finalUrl,
              downloadUrl: finalUrl,
              fileName: 'uploaded.jpg',
              mimeType: 'image/jpeg',
              size: 0,
              caption: caption || '',
              isPrimary: !!is_primary,
              createdBy: req.user?.username || 'SYSTEM',
              createdAt: null,
              operationId: 'api-upload',
              isDeleted: false
          }, 'api-upload');

          const db = getTargetFirestore();
          const imagesSnapshot = await db.collection('device_images')
              .where('device_id', '==', id)
              .where('isDeleted', '==', false)
              .get();
          
          const images = imagesSnapshot.docs.map(d => ({
              id: d.id,
              image_url: d.data().downloadUrl,
              caption: d.data().caption,
              is_primary: d.data().isPrimary ? 1 : 0
          }));
          return res.status(201).json({ success: true, message: 'Thêm hình ảnh thiết bị thành công', data: images });
      }

      if (is_primary) {
        dbRun(`UPDATE device_images SET is_primary = 0 WHERE device_id = ?`, [id]);
      }

      dbRun(
        `INSERT INTO device_images (device_id, image_url, is_primary, caption, created_by) VALUES (?, ?, ?, ?, ?)`,
        [id, finalUrl, is_primary ? 1 : 0, caption || '', req.user?.username || 'SYSTEM']
      );

      const images = dbQuery(`SELECT * FROM device_images WHERE device_id = ? ORDER BY is_primary DESC, id DESC`, [id]);

      return res.status(201).json({
        success: true,
        message: 'Thêm hình ảnh thiết bị thành công',
        data: images
      });
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Lỗi khi tải lên hình ảnh' });
    }
  }
);

router.delete(
  '/:id/images/:imageId',
  authenticateToken,
  denyGuestMutations,
  requirePermission('equipment:update'),
  (req: AuthenticatedRequest, res: Response) => {
    if (!DEVICE_IMAGE_FEATURE_ENABLED) {
        return res.status(503).json({ success: false, code: 'IMAGE_FEATURE_TEMPORARILY_DISABLED', message: 'Chức năng cập nhật hình ảnh đang tạm khóa.' });
    }
    try {
      const { id, imageId } = req.params;
      dbRun(`DELETE FROM device_images WHERE id = ? AND device_id = ?`, [imageId, id]);
      const images = dbQuery(`SELECT * FROM device_images WHERE device_id = ? ORDER BY is_primary DESC, id DESC`, [id]);

      return res.json({
        success: true,
        message: 'Đã xóa hình ảnh',
        data: images
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Lỗi khi xóa hình ảnh' });
    }
  }
);

router.put(
  '/:id/images/:imageId/primary',
  authenticateToken,
  denyGuestMutations,
  requirePermission('equipment:update'),
  (req: AuthenticatedRequest, res: Response) => {
    if (!DEVICE_IMAGE_FEATURE_ENABLED) {
        return res.status(503).json({ success: false, code: 'IMAGE_FEATURE_TEMPORARILY_DISABLED', message: 'Chức năng cập nhật hình ảnh đang tạm khóa.' });
    }
    try {
      const { id, imageId } = req.params;
      dbRun(`UPDATE device_images SET is_primary = 0 WHERE device_id = ?`, [id]);
      dbRun(`UPDATE device_images SET is_primary = 1 WHERE id = ? AND device_id = ?`, [imageId, id]);
      const images = dbQuery(`SELECT * FROM device_images WHERE device_id = ? ORDER BY is_primary DESC, id DESC`, [id]);

      return res.json({
        success: true,
        message: 'Đã đặt làm ảnh đại diện chính',
        data: images
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Lỗi khi cập nhật ảnh đại diện' });
    }
  }
);

export default router;
