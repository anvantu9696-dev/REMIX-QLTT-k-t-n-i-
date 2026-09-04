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

// Check device ID uniqueness
router.get('/check-device-id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { device_id, excludeId } = req.query;
    if (!device_id) return res.json({ success: true, exists: false, message: 'Missing device_id' });
    
    const existingDevice = await deviceRepo.getByDeviceId(device_id as string);
    if (existingDevice && existingDevice.id !== excludeId) {
      return res.json({ success: true, exists: true, device: { name: existingDevice.name } });
    }
    
    return res.json({ success: true, exists: false });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

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
      lastDocId,
      updated_after
    } = req.query;
    
    const limit = req.query.limit ? Number(req.query.limit) : 50;

    // 1. Incremental / Delta Sync flow if updated_after is provided
    if (updated_after) {
      try {
        const delta = await deviceRepo.listDelta(updated_after as string);

        // Fetch relation metadata only for active (non-deleted) devices
        const activeChanged = delta.devices.filter(d => !d.isDeleted);
        const subIdsToFetch = Array.from(new Set(activeChanged.filter(d => !d.substation_name).map(d => String(d.substation_id)).filter(id => id && id !== 'undefined' && id !== 'null')));
        const feederIdsToFetch = Array.from(new Set(activeChanged.filter(d => !d.feeder_name).map(d => String(d.feeder_id)).filter(id => id && id !== 'undefined' && id !== 'null')));
        
        const substations = await Promise.all(subIdsToFetch.map(id => substationRepo.getById(id)));
        const feeders = await Promise.all(feederIdsToFetch.map(id => feederRepo.getById(id)));
        
        const subMap = new Map(substations.filter(s => s).map(s => [String(s!.id), s]));
        const feederMap = new Map(feeders.filter(f => f).map(f => [String(f!.id), f]));

        const enrichedDevices = delta.devices.map(d => {
          if (d.isDeleted) return d;
          const sub = subMap.get(String(d.substation_id));
          const feeder = feederMap.get(String(d.feeder_id));
          return {
            ...d,
            substation_name: d.substation_name || (sub ? sub.name : null),
            substation_code: d.substation_code || (sub ? sub.substation_code : null),
            feeder_name: d.feeder_name || (feeder ? feeder.name : null),
            feeder_code: d.feeder_code || (feeder ? feeder.feeder_code : null),
            device_type: d.device_type === 'RCL' ? 'REC' : d.device_type
          };
        });

        res.setHeader('X-Last-Sync-Timestamp', delta.last_sync_timestamp);
        return res.json({
          success: true,
          data: enrichedDevices,
          last_sync_timestamp: delta.last_sync_timestamp,
          is_delta: true,
          count: enrichedDevices.length
        });
      } catch (deltaErr: any) {
        console.warn('[devices.ts] Delta sync failed, falling back to full sync:', deltaErr.message);
        // Fall back to standard full query below
      }
    }

    // 2. Full Query
    const devices = await deviceRepo.list({
      limit,
      substation_id: substation_id ? (substation_id as string) : undefined,
      feeder_id: feeder_id ? (feeder_id as string) : undefined,
      device_type: device_type ? (device_type as string) : undefined,
      status: status ? (status as string) : undefined,
      lastDocId: lastDocId ? (lastDocId as string) : undefined
    });

    // Lấy danh sách ID trạm/phát tuyến CẦN FETCH (nếu document chưa được chuẩn hóa)
    const subIdsToFetch: string[] = Array.from(new Set(devices.filter(d => !d.substation_name).map(d => String(d.substation_id)).filter(id => id && id !== 'undefined' && id !== 'null')));
    const feederIdsToFetch: string[] = Array.from(new Set(devices.filter(d => !d.feeder_name).map(d => String(d.feeder_id)).filter(id => id && id !== 'undefined' && id !== 'null')));
    
    const substations = await Promise.all(subIdsToFetch.map((id: string) => substationRepo.getById(id)));
    const feeders = await Promise.all(feederIdsToFetch.map((id: string) => feederRepo.getById(id)));
    
    const subMap = new Map(substations.filter(s => s).map(s => [String(s!.id), s]));
    const feederMap = new Map(feeders.filter(f => f).map(f => [String(f!.id), f]));

    let enrichedDevices = devices.map(d => {
        const sub = subMap.get(String(d.substation_id));
        const feeder = feederMap.get(String(d.feeder_id));
        return {
            ...d,
            substation_name: d.substation_name || (sub ? sub.name : null),
            substation_code: d.substation_code || (sub ? sub.substation_code : null),
            feeder_name: d.feeder_name || (feeder ? feeder.name : null),
            feeder_code: d.feeder_code || (feeder ? feeder.feeder_code : null),
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

    const nowIso = new Date().toISOString();
    res.setHeader('X-Last-Sync-Timestamp', nowIso);
    return res.json({ 
        success: true, 
        data: enrichedDevices,
        last_sync_timestamp: nowIso,
        is_delta: false,
        nextCursor: enrichedDevices.length > 0 ? enrichedDevices[enrichedDevices.length - 1].id : null
    });
    } catch (err: any) {
    console.error('Error fetching devices:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách thiết bị' });
  }
});

// 3. Get Single Device Details (Lazy-loaded: images, locations, history are fetched via sub-endpoints)
router.get('/:id', authenticateToken, validatePayload, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const device = await deviceRepo.getById(id);
    if (!device) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin thiết bị' });
    }
    const [sub, feeder] = await Promise.all([
      device.substation_id ? substationRepo.getById(String(device.substation_id)) : Promise.resolve(null),
      device.feeder_id ? feederRepo.getById(String(device.feeder_id)) : Promise.resolve(null)
    ]);
    return res.json({
      success: true,
      data: {
        ...device,
        substation_name: device.substation_name || (sub ? sub.name : null),
        substation_code: device.substation_code || (sub ? sub.substation_code : null),
        feeder_name: device.feeder_name || (feeder ? feeder.name : null),
        feeder_code: device.feeder_code || (feeder ? feeder.feeder_code : null)
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xem chi tiết thiết bị' });
  }
});

// 3.1 Get Device Location History (Lazy-loaded, max 20)
router.get('/:id/locations', authenticateToken, validatePayload, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string, 10) || 20), 50);
    const locations = await deviceLocationRepo.getByDeviceId(id, limit);
    return res.json({ success: true, data: locations });
  } catch (err: any) {
    console.error('Error fetching device locations:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy lịch sử vị trí' });
  }
});

// 3.2 Get Device Status & SCADA History (Lazy-loaded, max 20)
router.get('/:id/history', authenticateToken, validatePayload, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string, 10) || 20), 50);
    const history = await deviceStatusHistoryRepo.getByDeviceId(id, limit);
    return res.json({ success: true, data: history });
  } catch (err: any) {
    console.error('Error fetching device status history:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy lịch sử trạng thái' });
  }
});

// 3.3 Get Device Images (Lazy-loaded)
router.get('/:id/images', authenticateToken, validatePayload, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const images = await deviceImageRepo.getByDeviceId(id);
    return res.json({ success: true, data: images });
  } catch (err: any) {
    console.error('Error fetching device images:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy hình ảnh thiết bị' });
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
              primary_image: req.body.primary_image !== undefined ? req.body.primary_image : undefined,
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
      

      
          const device = await deviceRepo.getById(id);
          if (!device) return res.status(404).json({ success: false, message: 'Thiết bị không tồn tại' });

          const targetSubId = substation_id || device.substation_id;
          const targetFeederId = feeder_id || device.feeder_id;
          
          if (targetSubId && targetFeederId) {
             const feeder = await feederRepo.getById(targetFeederId.toString());
             if (feeder && String((feeder as any).substation_id) !== String(targetSubId)) {
                 return res.status(400).json({ success: false, code: 'FEEDER_SUBSTATION_MISMATCH', message: 'Phát tuyến không thuộc trạm này' });
             }
          }

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
                  primary_image: req.body.primary_image !== undefined ? req.body.primary_image : device.primary_image,
                  pole_number: req.body.pole_number !== undefined ? req.body.pole_number : device.pole_number,
                  switch_status: req.body.switch_status || device.switch_status,
                  scada_status: req.body.scada_status || device.scada_status,
                  relay_79: req.body.relay_79 || device.relay_79,
                  battery_status: req.body.battery_status || device.battery_status,
                  settings: req.body.settings || device.settings,
                  updatedBy: req.user?.username || 'SYSTEM'
              }, expectedVersion === undefined ? 1 : expectedVersion, operationId);

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
