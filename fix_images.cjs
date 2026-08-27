const fs = require('fs');
let code = fs.readFileSync('server/routes/devices.ts', 'utf8');

const target = `router.post(
  '/:id/images',
  authenticateToken,
  denyGuestMutations,
  requirePermission('equipment:update'),
  (req: AuthenticatedRequest, res: Response) => {
    if (!DEVICE_IMAGE_FEATURE_ENABLED) {
        return res.status(503).json({ success: false, code: 'IMAGE_FEATURE_TEMPORARILY_DISABLED', message: 'Chức năng cập nhật hình ảnh đang tạm khóa.' });
    }
    try {
      const { id } = req.params;
      const { image_url, caption, is_primary } = req.body;

      if (!image_url) {
        return res.status(400).json({ success: false, message: 'Đường dẫn hình ảnh là bắt buộc' });
      }

      if (is_primary) {
        // Reset previous primary images
        dbRun(\`UPDATE device_images SET is_primary = 0 WHERE device_id = ?\`, [id]);
      }

      dbRun(
        \`INSERT INTO device_images (device_id, image_url, is_primary, caption, created_by) VALUES (?, ?, ?, ?, ?)\`,
        [id, image_url, is_primary ? 1 : 0, caption || '', req.user?.username || 'SYSTEM']
      );

      const images = dbQuery(\`SELECT * FROM device_images WHERE device_id = ? ORDER BY is_primary DESC, id DESC\`, [id]);

      return res.status(201).json({
        success: true,
        message: 'Thêm hình ảnh thiết bị thành công',
        data: images
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Lỗi khi tải lên hình ảnh' });
    }
  }
);`;

const replacement = `router.post(
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
              finalUrl = await uploadBase64ToStorage(image_url, \`devices/\${id}\`);
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
        dbRun(\`UPDATE device_images SET is_primary = 0 WHERE device_id = ?\`, [id]);
      }

      dbRun(
        \`INSERT INTO device_images (device_id, image_url, is_primary, caption, created_by) VALUES (?, ?, ?, ?, ?)\`,
        [id, finalUrl, is_primary ? 1 : 0, caption || '', req.user?.username || 'SYSTEM']
      );

      const images = dbQuery(\`SELECT * FROM device_images WHERE device_id = ? ORDER BY is_primary DESC, id DESC\`, [id]);

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
);`;

// Regex based replacement to handle whitespace differences safely
const regex = /router\.post\(\s*'\/[:a-zA-Z0-9\/]+images',\s*authenticateToken,\s*denyGuestMutations,\s*requirePermission\('equipment:update'\),\s*\(req: AuthenticatedRequest, res: Response\) => \{[\s\S]*?return res\.status\(500\)\.json\(\{ success: false, message: 'Lỗi khi tải lên hình ảnh' \}\);\s*\}\s*\}\s*\);/g;

code = code.replace(regex, replacement);
fs.writeFileSync('server/routes/devices.ts', code);
console.log("Replaced");
