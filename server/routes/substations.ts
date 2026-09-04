import { Router, Response } from 'express';
import { broadcastRealtimeEvent } from '../events';
import {
  authenticateToken,
  denyGuestMutations,
  requireRole,
 
  recordAuditLog,
  AuthenticatedRequest
} from '../middleware';
import { substationRepo } from '../repositories/firestore/substationRepository';
import { feederRepo } from '../repositories/firestore/feederRepository';
import { deviceRepo } from '../repositories/firestore/deviceRepository';

const router = Router();

// 1. Get List of Substations (Trạm 110kV)
router.get('/', authenticateToken, requireRole(['ADMIN', 'MANAGER', 'SHIFT_LEADER', 'STAFF', 'VIEWER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, status, sortBy, sortOrder } = req.query;

    
        const limit = req.query.limit ? Number(req.query.limit) : undefined;
        const lastDocId = req.query.lastDocId as string | undefined;
        let substations = await substationRepo.list({ status: status as string, limit, lastDocId });
        
        if (search) {
          const q = search.toString().toLowerCase();
          substations = substations.filter(s =>
            (s.substation_code && s.substation_code.toLowerCase().includes(q)) ||
            (s.name && s.name.toLowerCase().includes(q)) ||
            (s.address && s.address.toLowerCase().includes(q))
          );
        }

        const enrichedSubstations = await Promise.all(substations.map(async s => {
          const fCount = await feederRepo.count({ substation_id: s.id });
          const dCount = await deviceRepo.count({ substation_id: s.id });
          return {
            ...s,
            feeder_count: fCount,
            device_count: dCount
          };
        }));
        
        return res.json({ success: true, data: enrichedSubstations });
    } catch (err: any) {
    console.error('Error fetching substations:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách trạm 110kV' });
  }
});

// 2. Get Single Substation Detail with Feeders
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    
        const substation = await substationRepo.getById(id);
        if (!substation) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin trạm 110kV' });
        }
        
        // Only load feeders and devices belonging specifically to this substation
        const [feeders, subDevices] = await Promise.all([
          feederRepo.listBySubstationId(substation.id),
          deviceRepo.listBySubstationId(substation.id)
        ]);

        const subFeeders = feeders.map(f => {
            const deviceCount = subDevices.filter(d => String(d.feeder_id) === String(f.id)).length;
            return {
                ...f,
                device_count: deviceCount
            };
        });
        
        return res.json({
            success: true,
            data: {
                 ...substation,
                 feeder_count: subFeeders.length,
                 device_count: subDevices.length,
                 feeders: subFeeders
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
  requireRole(['ADMIN', 'MANAGER', 'SHIFT_LEADER']),
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
  requireRole(['ADMIN', 'MANAGER', 'SHIFT_LEADER']),
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
              }, expectedVersion === undefined ? 1 : expectedVersion, operationId);

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
  requireRole(['ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { operationId, expectedVersion } = req.body;

      if (!operationId) return res.status(400).json({ success: false, code: 'OPERATION_ID_REQUIRED' });

      
          // Verify dependencies
          const feedersCount = await feederRepo.count({ substation_id: id });
          if (feedersCount > 0) return res.status(409).json({ success: false, code: 'SUBSTATION_HAS_ACTIVE_FEEDERS', message: 'Trạm đang có phát tuyến hoạt động.' });
          
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
      } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Lỗi server khi xóa trạm 110kV' });
    }
  }
);

export default router;
