import { Router, Response } from 'express';
import { dbQuery, dbQueryOne, dbRun } from '../db';
import { broadcastRealtimeEvent } from '../events';
import {
  authenticateToken,
  denyGuestMutations,
  requirePermission,
  requireAnyPermission,
  recordAuditLog,
  AuthenticatedRequest
} from '../middleware';
import { CORE_DATA_SOURCE } from '../config';
import { feederRepo } from '../repositories/firestore/feederRepository';
import { substationRepo } from '../repositories/firestore/substationRepository';
import { deviceRepo } from '../repositories/firestore/deviceRepository';

const router = Router();

// 1. Get List of Feeders (Phát tuyến)
router.get('/', authenticateToken, requireAnyPermission(['equipment:read', 'FEEDER_VIEW']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, substation_id, status, sortBy, sortOrder } = req.query;

    if (CORE_DATA_SOURCE === 'firestore') {
        const feeders = await feederRepo.list();
        const substations = await substationRepo.list();
        const devices = await deviceRepo.list();
        
        const subMap = new Map(substations.map(s => [String(s.id), s]));
        const enrichedFeeders = feeders.map(f => {
            const sub = subMap.get(String(f.substation_id));
            const deviceCount = devices.filter(d => String(d.feeder_id) === String(f.id)).length;
            return {
                ...f,
                substation_name: sub ? sub.name : null,
                substation_code: sub ? sub.substation_code : null,
                device_count: deviceCount
            };
        });
        return res.json({ success: true, data: enrichedFeeders });
    }
    
    // Shadow read
    if (CORE_DATA_SOURCE === 'sqlite-shadow') {
        feederRepo.list().catch(e => console.error('Shadow read error:', e));
    }

    let sql = `
      SELECT 
        f.*,
        s.name as substation_name,
        s.substation_code as substation_code,
        (SELECT COUNT(*) FROM devices d WHERE d.feeder_id = f.id AND d.deleted_at IS NULL) as device_count
      FROM feeders f
      LEFT JOIN substations s ON f.substation_id = s.id
      WHERE f.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (search) {
      sql += ` AND (f.feeder_code LIKE ? OR f.name LIKE ? OR f.start_point LIKE ? OR f.end_point LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (substation_id) {
      sql += ` AND f.substation_id = ?`;
      params.push(substation_id);
    }

    if (status) {
      sql += ` AND f.status = ?`;
      params.push(status);
    }
    
    // Sorting
    const validSortColumns = ['name', 'feeder_code', 'status', 'device_count', 'substation_name']; 
    const sortByCol = validSortColumns.includes(sortBy as string) ? `f.${sortBy}` : 'f.id';
    const sortOrderVal = sortOrder?.toString().toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    
    sql += ` ORDER BY ${sortByCol} ${sortOrderVal}`;

    const feeders = dbQuery(sql, params);
    return res.json({ success: true, data: feeders });
  } catch (err: any) {
    console.error('Error fetching feeders:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách phát tuyến' });
  }
});

// 2. Get Single Feeder Detail with Devices List
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (CORE_DATA_SOURCE === 'firestore') {
        const feeder = await feederRepo.getById(id);
        if (!feeder) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy phát tuyến' });
        }
        let subName = null, subCode = null;
        if (feeder.substation_id) {
             const sub = await substationRepo.getById(String(feeder.substation_id));
             if (sub) {
                  subName = sub.name;
                  subCode = sub.substation_code;
             }
        }
        const devices = await deviceRepo.list();
        const feederDevices = devices.filter(d => String(d.feeder_id) === String(feeder.id));
        
        feederDevices.sort((a, b) => {
             const pa = String(a.pole_number || '');
             const pb = String(b.pole_number || '');
             if (pa < pb) return -1;
             if (pa > pb) return 1;
             return String(a.id).localeCompare(String(b.id));
        });

        return res.json({ 
            success: true, 
            data: {
                 ...feeder,
                 substation_name: subName,
                 substation_code: subCode,
                 devices: feederDevices
            }
        });
    }

    const feeder = dbQueryOne(
      `SELECT f.*, s.name as substation_name, s.substation_code
       FROM feeders f
       LEFT JOIN substations s ON f.substation_id = s.id
       WHERE f.id = ? AND f.deleted_at IS NULL`,
      [id]
    );

    if (!feeder) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phát tuyến' });
    }

    const devices = dbQuery(
      `SELECT * FROM devices WHERE feeder_id = ? AND deleted_at IS NULL ORDER BY pole_number ASC, id ASC`,
      [id]
    );

    return res.json({
      success: true,
      data: {
        ...feeder,
        devices
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy chi tiết phát tuyến' });
  }
});

// 3. Create Feeder
router.post(
  '/',
  authenticateToken,
  denyGuestMutations,
  requirePermission('equipment:create'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { feeder_code, name, substation_id, start_point, end_point, notes, status, operationId } = req.body;

      if (!operationId) return res.status(400).json({ success: false, code: 'OPERATION_ID_REQUIRED' });
      if (!feeder_code || !name || !substation_id) {
        return res.status(400).json({
          success: false,
          message: 'Mã phát tuyến, Tên phát tuyến và Trạm 110kV là bắt buộc'
        });
      }

      if (CORE_DATA_SOURCE === 'firestore') {
          // Verify substation
          const station = await substationRepo.getById(substation_id.toString());
          if (!station || station.isDeleted) {
            return res.status(400).json({ success: false, message: 'Trạm 110kV được chọn không tồn tại' });
          }

          const created = await feederRepo.create({
              substation_id: (isNaN(Number(substation_id)) ? substation_id : Number(substation_id)),
              feeder_code: feeder_code.trim(),
              name: name.trim(),
              status: status || 'ACTIVE',
              createdBy: req.user?.username || 'SYSTEM',
              updatedBy: req.user?.username || 'SYSTEM'
          }, operationId);
          
          recordAuditLog({
            user_id: req.user!.id,
            username: req.user!.username,
            user_fullname: req.user!.full_name,
            action: 'CREATE_FEEDER',
            module: 'PHAT_TUYEN',
            target_id: created.id,
            details: `Tạo phát tuyến mới: ${name} (${feeder_code})`,
            result: 'SUCCESS',
            ip_address: req.ip
          });
          broadcastRealtimeEvent({ type: 'CREATE', entity: 'feeders', id: created.id });
          return res.status(201).json({ success: true, message: 'Tạo phát tuyến mới thành công', data: created });
      }

      // SQLite write guard
      console.error('SQLITE WRITE ATTEMPTED IN FEEDER ROUTE');
      return res.status(500).json({ success: false, message: 'Ghi SQLite bị chặn' });
    } catch (err: any) {
      console.error('Error creating feeder:', err);
      return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi thêm phát tuyến' });
    }
  }
);

// 4. Update Feeder
router.put(
  '/:id',
  authenticateToken,
  denyGuestMutations,
  requirePermission('equipment:update'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { feeder_code, name, substation_id, start_point, end_point, notes, status, operationId, expectedVersion } = req.body;

      if (!operationId) return res.status(400).json({ success: false, code: 'OPERATION_ID_REQUIRED' });
      if (expectedVersion === undefined) return res.status(400).json({ success: false, code: 'EXPECTED_VERSION_REQUIRED' });

      if (CORE_DATA_SOURCE === 'firestore') {
          const feeder = await feederRepo.getById(id);
          if (!feeder) return res.status(404).json({ success: false, message: 'Phát tuyến không tồn tại' });

          try {
              const updated = await feederRepo.update(id, {
                  substation_id: substation_id ? (isNaN(Number(substation_id)) ? substation_id : Number(substation_id)) : feeder.substation_id,
                  feeder_code: feeder_code?.trim(),
                  name: name?.trim(),
                  status,
                  updatedBy: req.user?.username || 'SYSTEM'
              }, expectedVersion, operationId);

              recordAuditLog({
                user_id: req.user!.id,
                username: req.user!.username,
                user_fullname: req.user!.full_name,
                action: 'UPDATE_FEEDER',
                module: 'PHAT_TUYEN',
                target_id: id,
                details: `Cập nhật thông tin phát tuyến: ${updated.name}`,
                result: 'SUCCESS',
                ip_address: req.ip
              });
              broadcastRealtimeEvent({ type: 'UPDATE', entity: 'feeders', id: id });
              return res.json({ success: true, message: 'Cập nhật phát tuyến thành công', data: updated });
          } catch (err: any) {
              if (err.message === 'VERSION_CONFLICT') return res.status(409).json({ success: false, code: 'VERSION_CONFLICT', message: 'Dữ liệu đã được thay đổi trên thiết bị khác. Vui lòng kiểm tra lại.' });
              throw err;
          }
      }

      // SQLite write guard
      console.error('SQLITE WRITE ATTEMPTED IN FEEDER ROUTE');
      return res.status(500).json({ success: false, message: 'Ghi SQLite bị chặn' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật phát tuyến' });
    }
  }
);

// 5. Soft Delete Feeder
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
          // Verify devices dependency (simplified for this cutover)
          // ... need to verify active devices
          
          try {
              const deleted = await feederRepo.delete(id, operationId);
              recordAuditLog({
                user_id: req.user!.id,
                username: req.user!.username,
                user_fullname: req.user!.full_name,
                action: 'DELETE_FEEDER',
                module: 'PHAT_TUYEN',
                target_id: id,
                details: `Xóa mềm Phát tuyến: ${id}`,
                result: 'SUCCESS',
                ip_address: req.ip
              });
              broadcastRealtimeEvent({ type: 'DELETE', entity: 'feeders', id: id });
              return res.json({ success: true, message: 'Đã xóa thành công phát tuyến' });
          } catch (err: any) {
              throw err;
          }
      }

      // SQLite write guard
      console.error('SQLITE WRITE ATTEMPTED IN FEEDER ROUTE');
      return res.status(500).json({ success: false, message: 'Ghi SQLite bị chặn' });
    } catch (err: any) {
      console.error('Error in feeder delete endpoint:', err);
      return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa phát tuyến' });
    }
  }
);


export default router;
