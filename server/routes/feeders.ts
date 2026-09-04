import { Router, Response } from 'express';
import { validatePayload } from '../middlewares/validatePayload';
import { broadcastRealtimeEvent } from '../events';
import {
  authenticateToken,

  denyGuestMutations,
  requireRole,
 
  recordAuditLog,
  AuthenticatedRequest
} from '../middleware';
import { feederRepo } from '../repositories/firestore/feederRepository';
import { substationRepo } from '../repositories/firestore/substationRepository';
import { deviceRepo } from '../repositories/firestore/deviceRepository';

const router = Router();

// 1. Get List of Feeders (Phát tuyến)
router.get('/', authenticateToken, validatePayload, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, substation_id, status, sortBy, sortOrder, limit, lastDocId } = req.query;

    
        const feeders = await feederRepo.list({
            substation_id: substation_id ? (substation_id as string) : undefined,
            status: status ? (status as string) : undefined,
            limit: limit ? Number(limit) : undefined,
            lastDocId: lastDocId ? (lastDocId as string) : undefined
        });
        
        const subIdsToFetch = Array.from(new Set(feeders.map(f => String(f.substation_id)).filter(id => id && id !== 'undefined' && id !== 'null')));
        const substations = await Promise.all(subIdsToFetch.map(id => substationRepo.getById(id)));
        const subMap = new Map(substations.filter(s => s).map(s => [String(s!.id), s]));
        let enrichedFeeders = await Promise.all(feeders.map(async f => {
            const sub = subMap.get(String(f.substation_id));
            const dCount = await deviceRepo.count({ feeder_id: f.id });
            return {
                ...f,
                substation_name: sub ? sub.name : null,
                substation_code: sub ? sub.substation_code : null,
                device_count: dCount
            };
        }));

        if (search) {
          const q = search.toString().toLowerCase();
          enrichedFeeders = enrichedFeeders.filter(f =>
            (f.feeder_code && f.feeder_code.toLowerCase().includes(q)) ||
            (f.name && f.name.toLowerCase().includes(q)) ||
            (f.start_point && f.start_point.toLowerCase().includes(q)) ||
            (f.end_point && f.end_point.toLowerCase().includes(q))
          );
        }

        const nextCursor = feeders.length > 0 ? feeders[feeders.length - 1].id : null;
        return res.json({
            success: true,
            data: enrichedFeeders,
            nextCursor
        });
    } catch (err: any) {
    console.error('Error fetching feeders:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách phát tuyến' });
  }
});

// 2. Get Single Feeder Detail with Devices List
router.get('/:id', authenticateToken, validatePayload, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    
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
        // Only load devices belonging to this feeder
        const feederDevices = await deviceRepo.listByFeederId(feeder.id);
        
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
                 device_count: feederDevices.length,
                 devices: feederDevices
            }
        });
    } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy chi tiết phát tuyến' });
  }
});

// 3. Create Feeder
router.post(
  '/',
  authenticateToken, validatePayload,

  denyGuestMutations,
  requireRole(['ADMIN', 'MANAGER', 'SHIFT_LEADER']),
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
      } catch (err: any) {
      console.error('Error creating feeder:', err);
      return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi thêm phát tuyến' });
    }
  }
);

// 4. Update Feeder
router.put(
  '/:id',
  authenticateToken, validatePayload,

  denyGuestMutations,
  requireRole(['ADMIN', 'MANAGER', 'SHIFT_LEADER']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { feeder_code, name, substation_id, start_point, end_point, notes, status, operationId, expectedVersion } = req.body;

      if (!operationId) return res.status(400).json({ success: false, code: 'OPERATION_ID_REQUIRED' });
      

      
          const feeder = await feederRepo.getById(id);
          if (!feeder) return res.status(404).json({ success: false, message: 'Phát tuyến không tồn tại' });

          try {
              const updated = await feederRepo.update(id, {
                  substation_id: substation_id ? (isNaN(Number(substation_id)) ? substation_id : Number(substation_id)) : feeder.substation_id,
                  feeder_code: feeder_code?.trim(),
                  name: name?.trim(),
                  status,
                  updatedBy: req.user?.username || 'SYSTEM'
              }, expectedVersion === undefined ? 1 : expectedVersion, operationId);

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
      } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật phát tuyến' });
    }
  }
);

// 5. Soft Delete Feeder
router.delete(
  '/:id',
  authenticateToken, validatePayload,

  denyGuestMutations,
  requireRole(['ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { operationId } = req.body;
      if (!operationId) return res.status(400).json({ success: false, code: 'OPERATION_ID_REQUIRED' });

      
          // Verify devices dependency
          const deviceCount = await deviceRepo.count({ feeder_id: id });
          if (deviceCount > 0) return res.status(409).json({ success: false, code: 'FEEDER_HAS_ACTIVE_DEVICES', message: 'Phát tuyến đang có thiết bị hoạt động.' });
          
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
      } catch (err: any) {
      console.error('Error in feeder delete endpoint:', err);
      return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa phát tuyến' });
    }
  }
);


export default router;
