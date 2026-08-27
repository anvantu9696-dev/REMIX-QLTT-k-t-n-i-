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
import { substationRepo } from '../repositories/firestore/substationRepository';
import { feederRepo } from '../repositories/firestore/feederRepository';
import { deviceRepo } from '../repositories/firestore/deviceRepository';

const router = Router();

// 1. Get List of Substations (Trạm 110kV)
router.get('/', authenticateToken, requireAnyPermission(['equipment:read', 'SUBSTATION_VIEW']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, status, sortBy, sortOrder } = req.query;

    if (CORE_DATA_SOURCE === 'firestore') {
        const substations = await substationRepo.list();
        const feeders = await feederRepo.list();
        const devices = await deviceRepo.list();
        
        const enrichedSubstations = substations.map(s => {
            const feederCount = feeders.filter(f => String(f.substation_id) === String(s.id)).length;
            const deviceCount = devices.filter(d => String(d.substation_id) === String(s.id)).length;
            return {
                ...s,
                feeder_count: feederCount,
                device_count: deviceCount
            };
        });
        
        return res.json({ success: true, data: enrichedSubstations });
    }
    
    // Shadow read
    if (CORE_DATA_SOURCE === 'sqlite-shadow') {
        substationRepo.list().catch(e => console.error('Shadow read error:', e));
    }
    
    let sql = `
      SELECT 
        s.*,
        (SELECT COUNT(*) FROM feeders f WHERE f.substation_id = s.id AND f.deleted_at IS NULL) as feeder_count,
        (SELECT COUNT(*) FROM devices d WHERE d.substation_id = s.id AND d.deleted_at IS NULL) as device_count
      FROM substations s
      WHERE s.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (search) {
      sql += ` AND (s.substation_code LIKE ? OR s.name LIKE ? OR s.address LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (status) {
      sql += ` AND s.status = ?`;
      params.push(status);
    }
    
    // Sorting
    const validSortColumns = ['name', 'substation_code', 'status', 'feeder_count', 'device_count']; 
    const sortByCol = validSortColumns.includes(sortBy as string) ? `s.${sortBy}` : 's.id';
    const sortOrderVal = sortOrder?.toString().toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    
    sql += ` ORDER BY ${sortByCol} ${sortOrderVal}`;

    const substations = dbQuery(sql, params);
    return res.json({ success: true, data: substations });
  } catch (err: any) {
    console.error('Error fetching substations:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách trạm 110kV' });
  }
});

// 2. Get Single Substation Detail with Feeders
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    if (CORE_DATA_SOURCE === 'firestore') {
        const substation = await substationRepo.getById(id);
        if (!substation) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin trạm 110kV' });
        }
        
        const feeders = await feederRepo.list();
        const devices = await deviceRepo.list();
        const subFeeders = feeders.filter(f => String(f.substation_id) === String(substation.id)).map(f => {
            const deviceCount = devices.filter(d => String(d.feeder_id) === String(f.id)).length;
            return {
                ...f,
                device_count: deviceCount
            };
        });
        
        return res.json({
            success: true,
            data: {
                 ...substation,
                 feeders: subFeeders
            }
        });
    }

    const substation = dbQueryOne(
      `SELECT * FROM substations WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (!substation) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin trạm 110kV' });
    }

    const feeders = dbQuery(
      `SELECT f.*,
         (SELECT COUNT(*) FROM devices d WHERE d.feeder_id = f.id AND d.deleted_at IS NULL) as device_count
       FROM feeders f
       WHERE f.substation_id = ? AND f.deleted_at IS NULL
       ORDER BY f.id DESC`,
      [id]
    );

    return res.json({
      success: true,
      data: {
        ...substation,
        feeders
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy thông tin trạm 110kV' });
  }
});

// 3. Create Substation
router.post(
  '/',
  authenticateToken,
  denyGuestMutations,
  requirePermission('equipment:create'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        substation_code,
        name,
        address,
        latitude,
        longitude,
        google_maps_url,
        image_url,
        notes,
        status,
        operationId
      } = req.body;

      if (!operationId) return res.status(400).json({ success: false, code: 'OPERATION_ID_REQUIRED' });
      if (!substation_code || !name) {
        return res.status(400).json({ success: false, message: 'Mã trạm và Tên trạm là bắt buộc' });
      }

      if (CORE_DATA_SOURCE === 'firestore') {
          const existing = await substationRepo.findByCode(substation_code.trim());
          if (existing) {
              return res.status(400).json({
                success: false,
                message: `Mã trạm "${substation_code}" đã tồn tại trên hệ thống. Vui lòng nhập mã khác.`
              });
          }
          const created = await substationRepo.create({
              substation_code: substation_code.trim(),
              name: name.trim(),
              address: address || '',
              latitude: latitude ? parseFloat(latitude) : null,
              longitude: longitude ? parseFloat(longitude) : null,
              status: status || 'ACTIVE'
          }, operationId);
          
          recordAuditLog({
            user_id: req.user!.id,
            username: req.user!.username,
            user_fullname: req.user!.full_name,
            action: 'CREATE_SUBSTATION',
            module: 'TRAM_110KV',
            target_id: created.id,
            details: `Tạo mới Trạm 110kV: ${name} (${substation_code})`,
            result: 'SUCCESS',
            ip_address: req.ip
          });
          broadcastRealtimeEvent({ type: 'CREATE', entity: 'substations', id: created.id });
          return res.status(201).json({ success: true, message: 'Thêm mới Trạm 110kV thành công', data: created });
      }

      // SQLite write guard
      console.error('SQLITE WRITE ATTEMPTED IN SUBSTATION ROUTE');
      return res.status(500).json({ success: false, message: 'Ghi SQLite bị chặn' });
    } catch (err: any) {
      console.error('Error creating substation:', err);
      return res.status(500).json({ success: false, message: 'Lỗi server khi thêm trạm 110kV' });
    }
  }
);

// 4. Update Substation
router.put(
  '/:id',
  authenticateToken,
  denyGuestMutations,
  requirePermission('equipment:update'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const {
        substation_code,
        name,
        address,
        latitude,
        longitude,
        google_maps_url,
        image_url,
        notes,
        status,
        operationId,
        expectedVersion
      } = req.body;

      if (!operationId) return res.status(400).json({ success: false, code: 'OPERATION_ID_REQUIRED' });
      if (expectedVersion === undefined) return res.status(400).json({ success: false, code: 'EXPECTED_VERSION_REQUIRED' });

      if (CORE_DATA_SOURCE === 'firestore') {
          const substation = await substationRepo.getById(id);
          if (!substation) return res.status(404).json({ success: false, message: 'Không tìm thấy trạm' });

          try {
              const updated = await substationRepo.update(id, {
                  substation_code: substation_code?.trim(),
                  name: name?.trim(),
                  address,
                  latitude: latitude ? parseFloat(latitude) : null,
                  longitude: longitude ? parseFloat(longitude) : null,
                  status
              }, expectedVersion, operationId);

              recordAuditLog({
                user_id: req.user!.id,
                username: req.user!.username,
                user_fullname: req.user!.full_name,
                action: 'UPDATE_SUBSTATION',
                module: 'TRAM_110KV',
                target_id: id,
                details: `Cập nhật Trạm 110kV: ${updated.name}`,
                result: 'SUCCESS',
                ip_address: req.ip
              });
              broadcastRealtimeEvent({ type: 'UPDATE', entity: 'substations', id: id });
              return res.json({ success: true, message: 'Cập nhật thành công', data: updated });
          } catch (err: any) {
              if (err.message === 'VERSION_CONFLICT') return res.status(409).json({ success: false, code: 'VERSION_CONFLICT', message: 'Dữ liệu đã được thay đổi trên thiết bị khác. Vui lòng kiểm tra lại.' });
              throw err;
          }
      }

      // SQLite write guard
      console.error('SQLITE WRITE ATTEMPTED IN SUBSTATION ROUTE');
      return res.status(500).json({ success: false, message: 'Ghi SQLite bị chặn' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật trạm 110kV' });
    }
  }
);

// 5. Soft Delete Substation
router.delete(
  '/:id',
  authenticateToken,
  denyGuestMutations,
  requirePermission('equipment:delete'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { operationId, expectedVersion } = req.body;

      if (!operationId) return res.status(400).json({ success: false, code: 'OPERATION_ID_REQUIRED' });

      if (CORE_DATA_SOURCE === 'firestore') {
          // Verify dependencies
          const activeFeeders = await feederRepo.list();
          const hasFeeders = activeFeeders.some((f: any) => String(f.substation_id) === String(id));

          if (hasFeeders) return res.status(409).json({ success: false, code: 'SUBSTATION_HAS_ACTIVE_FEEDERS', message: 'Trạm đang có phát tuyến hoạt động.' });
          
          try {
              const deleted = await substationRepo.delete(id, operationId);
              recordAuditLog({
                user_id: req.user!.id,
                username: req.user!.username,
                user_fullname: req.user!.full_name,
                action: 'DELETE_SUBSTATION',
                module: 'TRAM_110KV',
                target_id: id,
                details: `Xóa mềm Trạm: ${id}`,
                result: 'SUCCESS',
                ip_address: req.ip
              });
              broadcastRealtimeEvent({ type: 'DELETE', entity: 'substations', id: id });
              return res.json({ success: true, message: 'Xóa mềm thành công' });
          } catch (err: any) {
              throw err;
          }
      }

      // SQLite write guard
      console.error('SQLITE WRITE ATTEMPTED IN SUBSTATION ROUTE');
      return res.status(500).json({ success: false, message: 'Ghi SQLite bị chặn' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Lỗi server khi xóa trạm 110kV' });
    }
  }
);

export default router;
