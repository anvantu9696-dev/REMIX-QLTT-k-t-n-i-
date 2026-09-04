import { getTargetFirestore } from '../server/firebaseAdmin';
import { gridStructureRepo } from '../server/repositories/firestore/gridStructureRepository';
import { clearAllCache } from '../server/utils/firestoreCache';

async function backfillFeeders() {
  console.log('=== BẮT ĐẦU BACKFILL & ĐỒNG BỘ DỮ LIỆU PHÁT TUYẾN (FEEDERS) ===');
  const db = getTargetFirestore();

  // 1. Quét danh mục trạm để lấy map ID & Code
  const subSnap = await db.collection('substations').get();
  console.log(`Đã đọc ${subSnap.size} bản ghi trạm (substations) từ Firestore.`);
  const subById = new Map<string, any>();
  const subByCode = new Map<string, string>();

  const subBatch = db.batch();
  let subUpdatesCount = 0;

  for (const doc of subSnap.docs) {
    const data = doc.data();
    subById.set(doc.id, data);
    const code = String(data.substation_code || data.code || '').trim().toUpperCase();
    if (code) subByCode.set(code, doc.id);

    // Đồng bộ isDeleted cho trạm nếu thiếu
    const needsSubUpdate = data.isDeleted === undefined || data.isDeleted === null;
    if (needsSubUpdate) {
      const isDeleted = Boolean(data.deleted_at || data.deletedAt);
      subBatch.update(doc.ref, {
        isDeleted,
        deleted_at: data.deleted_at || null,
        updatedAt: new Date()
      });
      subUpdatesCount++;
    }
  }

  if (subUpdatesCount > 0) {
    await subBatch.commit();
    console.log(`Đã cập nhật trường isDeleted cho ${subUpdatesCount} trạm.`);
  }

  // 2. Quét toàn bộ collection feeders
  const feederSnap = await db.collection('feeders').get();
  console.log(`Đã đọc ${feederSnap.size} bản ghi phát tuyến (feeders) từ Firestore.`);

  let totalScanned = feederSnap.size;
  let updatedCount = 0;
  let alreadyValidCount = 0;

  const BATCH_SIZE = 400;
  let currentBatch = db.batch();
  let opCount = 0;

  for (const doc of feederSnap.docs) {
    const data = doc.data();
    let needsUpdate = false;
    const updates: Record<string, any> = {};

    // A. Kiểm tra & chuẩn hóa isDeleted
    const hasExplicitDeletedTimestamp = Boolean(data.deleted_at || data.deletedAt);
    if (data.isDeleted === undefined || data.isDeleted === null) {
      updates.isDeleted = hasExplicitDeletedTimestamp;
      updates.deleted_at = data.deleted_at || (hasExplicitDeletedTimestamp ? new Date() : null);
      needsUpdate = true;
    }

    // B. Chuẩn hóa mã phát tuyến (feeder_code)
    const feederCode = String(data.feeder_code || data.code || doc.id).trim();
    if (!data.feeder_code || data.feeder_code !== feederCode) {
      updates.feeder_code = feederCode;
      needsUpdate = true;
    }

    // C. Chuẩn hóa kiểu dữ liệu substation_id (String vs Number / Code mapping)
    if (data.substation_id !== undefined && data.substation_id !== null) {
      const rawSubIdStr = String(data.substation_id).trim();
      let targetSubId = rawSubIdStr;

      // Nếu rawSubIdStr không phải ID trạm thật nhưng khớp mã trạm
      if (!subById.has(rawSubIdStr)) {
        const matchedIdByCode = subByCode.get(rawSubIdStr.toUpperCase());
        if (matchedIdByCode) {
          targetSubId = matchedIdByCode;
        }
      }

      if (typeof data.substation_id !== 'string' || data.substation_id !== targetSubId) {
        updates.substation_id = String(targetSubId);
        needsUpdate = true;
      }
    } else {
      // Nếu substation_id bị null hoặc thiếu hoàn toàn
      updates.substation_id = '';
      needsUpdate = true;
    }

    // D. Đảm bảo các trường bắt buộc version, status
    if (data.version === undefined || data.version === null) {
      updates.version = 1;
      needsUpdate = true;
    }

    if (!data.status) {
      updates.status = 'ACTIVE';
      needsUpdate = true;
    }

    if (needsUpdate) {
      updates.updatedAt = new Date();
      currentBatch.update(doc.ref, updates);
      opCount++;
      updatedCount++;

      if (opCount >= BATCH_SIZE) {
        await currentBatch.commit();
        console.log(`Đã commit batch ${opCount} phát tuyến...`);
        currentBatch = db.batch();
        opCount = 0;
      }
    } else {
      alreadyValidCount++;
    }
  }

  if (opCount > 0) {
    await currentBatch.commit();
    console.log(`Đã commit batch cuối cùng ${opCount} phát tuyến.`);
  }

  console.log(`Tổng kết quét Feeders: Tổng = ${totalScanned}, Cần cập nhật = ${updatedCount}, Đã chuẩn = ${alreadyValidCount}`);

  // 3. Tái xây dựng lại metadata/grid_structure bundle và xóa cache
  console.log('Đang tái tạo metadata/grid_structure bundle...');
  clearAllCache();
  const bundle = await gridStructureRepo.rebuildGridStructure();
  console.log(`Hoàn thành! Grid Structure Bundle hiện có: ${bundle.substations.length} trạm, ${bundle.feeders.length} phát tuyến.`);
  console.log('=== KẾT THÚC BACKFILL FEEDERS ===');
}

backfillFeeders().catch(err => {
  console.error('Lỗi khi chạy backfillFeeders:', err);
  process.exit(1);
});
