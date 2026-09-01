import { getTargetFirestore } from './server/firebaseAdmin';

async function archiveDeletedDevices() {
  console.log('Bắt đầu quá trình lưu trữ thiết bị đã xóa...');
  const db = getTargetFirestore();

  // Truy vấn tất cả các thiết bị có trạng thái đã xóa
  const snapshot = await db.collection('devices').where('isDeleted', '==', true).get();

  if (snapshot.empty) {
    console.log('Không có thiết bị đã xóa nào cần lưu trữ.');
    return;
  }

  console.log(`Đã tìm thấy ${snapshot.size} thiết bị. Đang tiến hành xử lý theo lô...`);

  const docs = snapshot.docs;
  
  // Giới hạn của 1 batch trong Firestore là 500 operations.
  // Vì mỗi document yêu cầu 2 operations (1 copy/set + 1 delete), kích thước chunk an toàn là 250.
  const CHUNK_SIZE = 250; 
  let processedCount = 0;

  for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
    const chunk = docs.slice(i, i + CHUNK_SIZE);
    const batch = db.batch();

    for (const doc of chunk) {
      // 1. Tham chiếu lưu trữ bên collection devices_archive
      const archiveRef = db.collection('devices_archive').doc(doc.id);
      
      // Copy data sang archive
      batch.set(archiveRef, doc.data());
      
      // 2. Xóa data ở collection gốc
      batch.delete(doc.ref);
    }

    // Thực thi batch
    await batch.commit();
    
    processedCount += chunk.length;
    console.log(`Đã xử lý ${processedCount}/${docs.length} bản ghi...`);
  }

  console.log('Quá trình chuyển và lưu trữ hoàn tất thành công!');
}

archiveDeletedDevices().catch(console.error);
