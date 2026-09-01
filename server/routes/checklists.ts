import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest, denyGuestMutations } from '../middleware.js';
import { getTargetFirestore } from '../firebaseAdmin.js';

export const EVN_STANDARD_TEMPLATES = [
  {
    checklist_code: 'CHK-REC-EVN',
    title: 'Biểu mẫu kiểm tra Recloser (REC) định kỳ',
    category: 'Bảo trì định kỳ',
    description: 'Quy trình kiểm tra bảo dưỡng Recloser tiêu chuẩn EVN',
    version: '1.0',
    target_device_type: 'REC',
    items: [
      { order: 1, code: 'REC-01', content: '1. Kiểm tra tình trạng vỏ tủ điều khiển, thân máy (Có gỉ sét, móp méo không?)', std: 'Nguyên vẹn, không gỉ sét', unit: '-', type: 'PASS_FAIL' },
      { order: 2, code: 'REC-02', content: '2. Kiểm tra cáp điều khiển (Từ tủ lên thân máy)', std: 'Không xước, đứt', unit: '-', type: 'PASS_FAIL' },
      { order: 3, code: 'REC-03', content: '3. Kiểm tra các kẹp cực, điểm đấu nối', std: 'Chắc chắn, không lỏng lẻo', unit: '-', type: 'PASS_FAIL' },
      { order: 4, code: 'REC-04', content: '4. Kiểm tra sứ cách điện', std: 'Không nứt vỡ, sạch sẽ', unit: '-', type: 'PASS_FAIL' },
      { order: 5, code: 'REC-05', content: '5. Kiểm tra nhiệt độ tiếp xúc', std: '≤ 65°C', unit: '°C', type: 'PASS_FAIL' },
      { order: 6, code: 'REC-06', content: '6. Kiểm tra chỉ thị đóng cắt cơ khí', std: 'Đúng trạng thái thực tế', unit: '-', type: 'PASS_FAIL' },
      { order: 7, code: 'REC-07', content: '7. Kiểm tra kết nối 3G/4G/SCADA', std: 'Online, tín hiệu tốt', unit: '-', type: 'PASS_FAIL' },
      { order: 8, code: 'REC-08', content: '8. Kiểm tra nguồn ắc quy dự phòng', std: 'U ≥ 12.5V, Rnt ≤ 25mΩ', unit: 'V/mΩ', type: 'TEXT' },
      { order: 9, code: 'REC-09', content: '9. Kiểm tra hệ thống tiếp địa', std: 'Đảm bảo kết nối tốt', unit: '-', type: 'PASS_FAIL' },
      { order: 10, code: 'REC-10', content: '10. Đề xuất, kiến nghị khác', std: 'Ghi nhận hiện trường', unit: '-', type: 'TEXT' }
    ]
  },
  {
    checklist_code: 'CHK-LBS-EVN',
    title: 'Biểu mẫu kiểm tra LBS định kỳ',
    category: 'Bảo trì định kỳ',
    description: 'Quy trình kiểm tra bảo dưỡng LBS tiêu chuẩn EVN',
    version: '1.0',
    target_device_type: 'LBS',
    items: [
      { order: 1, code: 'LBS-01', content: '1. Vỏ tủ điều khiển và thân máy LBS', std: 'Nguyên vẹn', unit: '-', type: 'PASS_FAIL' },
      { order: 2, code: 'LBS-02', content: '2. Cáp ngầm nối tủ điều khiển', std: 'Không xước đứt', unit: '-', type: 'PASS_FAIL' },
      { order: 3, code: 'LBS-03', content: '3. Tình trạng các kẹp cực', std: 'Chắc chắn', unit: '-', type: 'PASS_FAIL' },
      { order: 4, code: 'LBS-04', content: '4. Máy biến áp cấp nguồn', std: 'Hoạt động tốt', unit: '-', type: 'PASS_FAIL' },
      { order: 5, code: 'LBS-05', content: '5. Kiểm tra các điểm tiếp xúc có chuyển màu do quá tải hoặc do tiếp xúc không tốt hay không ?', std: 'Tiếp xúc tốt, không đổi màu do nhiệt (Nhiệt độ mối nối ≤ 65°C)', unit: '°C', type: 'PASS_FAIL' },
      { order: 6, code: 'LBS-06', content: '6. Kiểm tra bao sứ cách điện có nứt nẻ, bể hay phóng điện rò không ?', std: 'Sứ cách điện nguyên vẹn, sạch sẽ, không sứt mẻ rạn nứt', unit: '-', type: 'PASS_FAIL' },
      { order: 7, code: 'LBS-07', content: '7. Kiểm tra kim chỉ áp suất khí (SF6) ở vạch xanh hay vạch đỏ ?', std: 'Kim chỉ áp suất ở vùng Vạch Xanh (Đủ áp suất dập hồ quang tiêu chuẩn)', unit: 'Bar', type: 'PASS_FAIL' },
      { order: 8, code: 'LBS-08', content: '8. Trụ lắp LBS có đảm bảo độ vững chắc không ?', std: 'Trụ thẳng đứng, đà xà chắc chắn, bu lông siết chặt không nghiêng lệch', unit: '-', type: 'PASS_FAIL' },
      { order: 9, code: 'LBS-09', content: '9. Kiểm tra tiếp địa có bị đứt, bị mất cắp không ?', std: 'Dây tiếp địa còn nguyên vẹn, không bị đứt tưa, không mất cắp', unit: '-', type: 'PASS_FAIL' },
      { order: 10, code: 'LBS-10', content: '10. Kiểm tra tiếp địa đấu nối vào vỏ máy đúng kỹ thuật không ?', std: 'Tiếp địa đấu nối vào vỏ máy đúng quy trình kỹ thuật, bắt chặt chắc chắn', unit: '-', type: 'PASS_FAIL' },
      { order: 11, code: 'LBS-11', content: '11. Kiểm tra nguồn pin tủ điều khiển, nguồn accu cung cấp cho relay/RTU (Acqui 01 & 02: U(V), Rnt(mΩ))', std: 'Acqui 01: U ≥ 12.5V, Rnt ≤ 25mΩ; Acqui 02: U ≥ 12.5V, Rnt ≤ 25mΩ', unit: 'V/mΩ', type: 'TEXT' },
      { order: 12, code: 'LBS-12', content: '12. Các hiện tượng bất thường khác & Đề xuất xử lý hoặc kiến nghị', std: 'Ghi nhận chi tiết hiện trường và đề xuất xử lý kỹ thuật nếu có', unit: '-', type: 'TEXT' }
    ]
  }
];

export async function ensureEVNChecklists() {
  try {
    const db = getTargetFirestore();
    const batch = db.batch();
    for (const tpl of EVN_STANDARD_TEMPLATES) {
      const chkRef = db.collection('checklists').doc(tpl.checklist_code);
      batch.set(chkRef, {
        checklist_code: tpl.checklist_code,
        title: tpl.title,
        category: tpl.category,
        description: tpl.description,
        version: tpl.version,
        target_device_type: tpl.target_device_type,
        is_template: 1,
        created_by: 'EVN_STANDARDS',
        deleted_at: null,
        items: tpl.items
      });
    }
    await batch.commit();
    console.log('[Checklists] EVN Standard Checklist Templates synchronized successfully (Firestore).');
  } catch (e) {
    console.error('[Checklists] Failed to sync EVN Templates to Firestore:', e);
  }
}

const router = Router();
router.use(authenticateToken);
router.use(denyGuestMutations);

// GET /api/checklists - Get all templates
router.get('/', async (req: AuthenticatedRequest, res) => {
  const { search, target_device_type } = req.query;
  try {
    const db = getTargetFirestore();
    let query: any = db.collection('checklists').where('is_template', '==', 1).where('deleted_at', '==', null);

    if (target_device_type) {
      query = query.where('target_device_type', '==', target_device_type);
    }

    const snapshot = await query.get();
    let templates = snapshot.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, ...data, item_count: (data.items || []).length };
    });

    if (search) {
      const s = (search as string).toLowerCase();
      templates = templates.filter((c: any) => 
        (c.title || '').toLowerCase().includes(s) || 
        (c.checklist_code || '').toLowerCase().includes(s)
      );
    }

    res.json({ success: true, data: templates });
  } catch(e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/checklists/presets
router.get('/presets', (req, res) => {
  res.json({ success: true, data: EVN_STANDARD_TEMPLATES });
});

// POST /api/checklists/sync-evn
router.post('/sync-evn', async (req, res) => {
  await ensureEVNChecklists();
  res.json({ success: true, message: 'Đã đồng bộ mẫu EVN chuẩn' });
});

// POST /api/checklists
router.post('/', async (req: AuthenticatedRequest, res) => {
  const { title, category, description, version, target_device_type, items } = req.body;
  if (!title) return res.status(400).json({ success: false, message: 'Thiếu tên mẫu' });
  try {
    const code = `CHK-${target_device_type || 'GN'}-${Math.floor(Math.random()*1000)}`;
    const db = getTargetFirestore();
    
    const checklistData = {
      checklist_code: code,
      title,
      category,
      description,
      version: version || '1.0',
      target_device_type,
      is_template: 1,
      created_by: req.user?.username || 'unknown',
      deleted_at: null,
      items: (items || []).map((itm: any, idx: number) => ({
        order: idx + 1,
        code: `ITM-${idx+1}`,
        content: itm.content,
        std: itm.standard_value || itm.std,
        unit: itm.unit,
        type: itm.input_type || itm.type || 'PASS_FAIL'
      }))
    };
    
    await db.collection('checklists').doc(code).set(checklistData);
    res.json({ success: true, message: 'Tạo mẫu thành công' });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// PATCH /api/checklists/:id
router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  const id = req.params.id;
  const { title, category, description, version, target_device_type, items } = req.body;
  try {
    const db = getTargetFirestore();
    const updateData: any = {
      title, category, description, version, target_device_type
    };
    if (items && Array.isArray(items)) {
      updateData.items = items.map((itm: any, idx: number) => ({
        order: idx + 1,
        code: itm.code || itm.item_code || `ITM-${idx+1}`,
        content: itm.content,
        std: itm.std || itm.standard_value,
        unit: itm.unit,
        type: itm.type || itm.input_type || 'PASS_FAIL'
      }));
    }
    
    await db.collection('checklists').doc(id).update(updateData);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// DELETE /api/checklists/:id
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getTargetFirestore();
    await db.collection('checklists').doc(req.params.id).update({
      deleted_at: new Date().toISOString()
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/checklists/:id
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getTargetFirestore();
    const doc = await db.collection('checklists').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'Not found' });
    
    const data = doc.data();
    if (data?.deleted_at) return res.status(404).json({ success: false, message: 'Not found' });
    
    res.json({ success: true, data: { id: doc.id, ...data } });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

export default router;
