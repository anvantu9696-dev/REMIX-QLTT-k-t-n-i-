import { Router, Response } from 'express';
import { validatePayload } from '../middlewares/validatePayload';
import { generateNextDeviceCode } from '../utils/deviceCode';
import { broadcastRealtimeEvent } from '../events';
import {
  authenticateToken,

  denyGuestMutations,
  requireRole,
 
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
import { uploadBase64ToStorage } from '../firebaseStorage';

const router = Router();




// Preview auto-generated device code
router.get('/preview-code', authenticateToken, validatePayload, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { device_type, feeder_id, substation_id } = req.query;
    if (!device_type) {
      return res.status(400).json({ success: false, message: 'Thiếu loại thiết bị' });
    }
    const code = await generateNextDeviceCode(
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
  authenticateToken, validatePayload,

  denyGuestMutations,
  requireRole(['ADMIN', 'MANAGER', 'SHIFT_LEADER']),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      return res.status(501).json({ success: false, message: 'Cập nhật hàng loạt chưa được hỗ trợ trên cơ sở dữ liệu hiện tại.' });
    } catch (err: any) {
      console.error('Error bulk updating devices:', err);
      return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật hàng loạt thiết bị' });
    }
  }
);

// 2. Get List of Devices with Search & Multi-Filters
router.get('/', authenticateToken, validatePayload, async (req: AuthenticatedRequest, res: Response) => {
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
      sortOrder,
      lastDocId
    } = req.query;
    
    const limit = Number(req.query.limit) || 10;

    
        const [devices, substations, feeders] = await Promise.all([
            deviceRepo.list({
            limit: Number(req.query.limit) || 10,
              substation_id: substation_id ? (substation_id as string) : undefined,
              feeder_id: feeder_id ? (feeder_id as string) : undefined,
              device_type: device_type ? (device_type as string) : undefined,
              status: status ? (status as string) : undefined,
              lastDocId: lastDocId ? (lastDocId as string) : undefined
            }),
            substationRepo.list({ limit: 100 }),
            feederRepo.list({ limit: 100 })
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

        if (switch_status) {
            // @ts-ignore
            enrichedDevices = enrichedDevices.filter(d => String(d.switch_status) === String(switch_status));
        }
        if (scada_status) {
            // @ts-ignore
            enrichedDevices = enrichedDevices.filter(d => String(d.scada_status) === String(scada_status));
        }
        if (pole_number) {
            const pn = pole_number.toString().toLowerCase();
            enrichedDevices = enrichedDevices.filter(d => d.pole_number && String(d.pole_number).toLowerCase().includes(pn));
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

        return res.json({ 
            success: true, 
            data: enrichedDevices,
            nextCursor: enrichedDevices.length > 0 ? enrichedDevices[enrichedDevices.length - 1].id : null
        });
    } catch (err: any) {
    console.error('Error fetching devices:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách thiết bị' });
  }
});

// 3. Get Single Device Details (with Images, Location History, Status History, Audit Logs)
router.get('/:id', authenticateToken, validatePayload, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    
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
    } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xem chi tiết thiết bị' });
  }
});

// 4. Create New Device
router.post(
  '/',
  authenticateToken, validatePayload,

  denyGuestMutations,
  requireRole(['ADMIN', 'MANAGER', 'SHIFT_LEADER']),
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

      
        // Verify relations
        const substation = await substationRepo.getById(substation_id.toString()) as any;
        if (!substation || substation.isDeleted) return res.status(400).json({ success: false, code: 'INVALID_SUBSTATION_REFERENCE', message: 'Trạm không tồn tại' });
        const feeder = await feederRepo.getById(feeder_id.toString()) as any;
        if (!feeder || feeder.isDeleted) return res.status(400).json({ success: false, code: 'INVALID_FEEDER_REFERENCE', message: 'Phát tuyến không tồn tại' });
        if (String(feeder.substation_id) !== String(substation_id)) {
            return res.status(400).json({ success: false, code: 'FEEDER_SUBSTATION_MISMATCH', message: 'Phát tuyến không thuộc trạm này' });
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
              google_maps_url: req.body.google_maps_url,
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
      } catch (err: any) {
      console.error('Error creating device:', err);
      return res.status(500).json({ success: false, message: 'Lỗi server khi thêm thiết bị' });
    }
  }
);

// 5. Update Device
router.put(
  '/:id',
  authenticateToken, validatePayload,

  denyGuestMutations,
  requireRole(['ADMIN', 'MANAGER', 'SHIFT_LEADER']),
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
                  google_maps_url: req.body.google_maps_url !== undefined ? req.body.google_maps_url : device.google_maps_url,
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
      } catch (err: any) {
      console.error('Error updating device:', err);
      return res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật thiết bị' });
    }
  }
);

// 6. Soft Delete Device
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

      
          const device = await deviceRepo.getById(id);
          if (!device) return res.status(404).json({ success: false, message: 'Thiết bị không tồn tại' });
          // Note: tasks are not fully migrated, but if they are, we'd check them here
          try {
              await deviceRepo.delete(id, operationId, req.user!.username);
              
              recordAuditLog({
                user_id: req.user!.id,
                username: req.user!.username,
                user_fullname: req.user!.full_name,
                action: 'DELETE_DEVICE',
                module: 'QUAN_LY_THIET_BI',
                target_id: id,
                details: `Xóa thiết bị: ${id}`,
                result: 'SUCCESS',
                ip_address: req.ip
              });
              broadcastRealtimeEvent({ type: 'DELETE', entity: 'DEVICE', id: id });
              return res.json({ success: true, message: 'Đã xóa thiết bị thành công' });
          } catch (err: any) {
              throw err;
          }
      } catch (err: any) {
      console.error('Error deleting device:', err);
      return res.status(500).json({ success: false, message: 'Lỗi server khi xóa thiết bị' });
    }
  }
);

// 7. Manage Device Images
router.post(
  '/:id/images',
  authenticateToken, validatePayload,

  denyGuestMutations,
  requireRole(['ADMIN', 'MANAGER', 'SHIFT_LEADER']),
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
              finalUrl = await uploadBase64ToStorage(image_url, `devices/${id}`);
          } catch (e: any) {
              console.error('Lỗi upload ảnh:', e);
              return res.status(500).json({ success: false, message: 'Không thể upload ảnh lên Storage' });
          }
      }

      
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
      } catch (err: any) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Lỗi khi tải lên hình ảnh' });
    }
  }
);

router.delete(
  '/:id/images/:imageId',
  authenticateToken, validatePayload,

  denyGuestMutations,
  requireRole(['ADMIN', 'MANAGER', 'SHIFT_LEADER']),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!DEVICE_IMAGE_FEATURE_ENABLED) {
        return res.status(503).json({ success: false, code: 'IMAGE_FEATURE_TEMPORARILY_DISABLED', message: 'Chức năng cập nhật hình ảnh đang tạm khóa.' });
    }
    try {
      const { id, imageId } = req.params;
      await deviceImageRepo.delete(imageId, id);
      const images = await deviceImageRepo.getByDeviceId(id);

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
  authenticateToken, validatePayload,

  denyGuestMutations,
  requireRole(['ADMIN', 'MANAGER', 'SHIFT_LEADER']),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!DEVICE_IMAGE_FEATURE_ENABLED) {
        return res.status(503).json({ success: false, code: 'IMAGE_FEATURE_TEMPORARILY_DISABLED', message: 'Chức năng cập nhật hình ảnh đang tạm khóa.' });
    }
    try {
      const { id, imageId } = req.params;
      await deviceImageRepo.setPrimary(imageId, id);
      const images = await deviceImageRepo.getByDeviceId(id);

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
