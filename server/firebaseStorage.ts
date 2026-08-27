import { getTargetAdminApp } from './firebaseAdmin';
import { getStorage } from 'firebase-admin/storage';
import { v4 as uuidv4 } from 'uuid';

export async function uploadBase64ToStorage(base64String: string, folder: string = 'devices'): Promise<string> {
    const app = getTargetAdminApp();
    const storage = getStorage(app);
    // Usually target bucket is project_id.appspot.com
    const bucketName = `${app.options.projectId}.appspot.com`;
    const bucket = storage.bucket(bucketName);
    
    // Extract base64 info
    const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
        throw new Error('Chuỗi hình ảnh base64 không hợp lệ');
    }
    const type = matches[1];
    const data = Buffer.from(matches[2], 'base64');
    const ext = type.split('/')[1] || 'jpg';
    
    const fileName = `${folder}/${uuidv4()}.${ext}`;
    const file = bucket.file(fileName);
    
    await file.save(data, {
        metadata: {
            contentType: type,
        },
        public: true,
    });
    
    // Construct public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
    return publicUrl;
}
