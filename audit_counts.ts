
import { getTargetFirestore } from './server/firebaseAdmin';

async function auditData() {
  const db = getTargetFirestore();

  // 1. Tối ưu hoá đếm số lượng bằng AggregateQuery (count) để giảm chi phí reads
  const [
    feedersRaw, feedersDeleted, feedersActive,
    subsRaw, subsDeleted, subsActive
  ] = await Promise.all([
    db.collection('feeders').count().get(),
    db.collection('feeders').where('isDeleted', '==', true).count().get(),
    db.collection('feeders').where('isDeleted', '==', false).count().get(),
    db.collection('substations').count().get(),
    db.collection('substations').where('isDeleted', '==', true).count().get(),
    db.collection('substations').where('isDeleted', '==', false).count().get()
  ]);

  const stats = {
    feeders: {
      raw: feedersRaw.data().count,
      deleted: feedersDeleted.data().count,
      active: feedersActive.data().count,
      missing: feedersRaw.data().count - feedersDeleted.data().count - feedersActive.data().count
    },
    subs: {
      raw: subsRaw.data().count,
      deleted: subsDeleted.data().count,
      active: subsActive.data().count,
      missing: subsRaw.data().count - subsDeleted.data().count - subsActive.data().count
    }
  };

  // 2. Lấy dữ liệu rút gọn (chỉ lấy các trường cần thiết) để tính toán Relations
  // Giảm tối đa băng thông tải về thay vì lấy toàn bộ payload như trước đây
  const [feederSnap, subSnap, deviceSnap] = await Promise.all([
    db.collection('feeders').select('substation_id').get(),
    db.collection('substations').select().get(), // Chỉ lấy Document ID
    db.collection('devices').select('feeder_id', 'substation_id', 'isDeleted').get()
  ]);

  const feeders = feederSnap.docs.map(d => ({ id: d.id, substation_id: d.data().substation_id }));
  const subs = subSnap.docs.map(d => ({ id: d.id }));
  const devices = deviceSnap.docs.map(d => ({
    id: d.id,
    feeder_id: d.data().feeder_id,
    substation_id: d.data().substation_id,
    isDeleted: d.data().isDeleted
  }));

  // Relations
  const activeDevices = devices.filter(d => d.isDeleted !== true);
  let valid = 0, orphanFeeder = 0, orphanSub = 0, mismatch = 0;

  for (const d of activeDevices) {
    const f = feeders.find(x => String(x.id) === String(d.feeder_id));
    const s = subs.find(x => String(x.id) === String(d.substation_id));

    if (!f && d.feeder_id) orphanFeeder++;
    else if (!s && d.substation_id) orphanSub++;
    else if (f && s && String(f.substation_id) !== String(d.substation_id)) mismatch++;
    else valid++;
  }

  console.log(JSON.stringify({ stats, relations: { valid, orphanFeeder, orphanSub, mismatch } }));
}

auditData().catch(console.error);
