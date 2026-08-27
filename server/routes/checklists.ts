import { Router, Response } from 'express';
import { dbQuery, dbQueryOne, dbRun } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware';

const router = Router();

export const EVN_STANDARD_TEMPLATES = [
  {
    checklist_code: 'CHK-RCL-22KV',
    title: 'Biên bản Kiểm tra Máy cắt Tự đóng lại Trung thế (Recloser)',
    category: 'Kiểm tra định kỳ',
    target_device_type: 'REC',
    version: '2026.1',
    description: 'Mẫu biên bản kiểm tra kỹ thuật định kỳ máy cắt tự đóng lại Recloser 22kV theo quy định Đội Vận hành Lưới điện - PC Bình Dương / Tổng Công ty Điện lực',
    items: [
      { order: 1, code: 'RCL-01', content: 'Tình trạng vận hành Recloser đang ở vị trí: Đóng [ ] Cắt [ ]', std: 'Phù hợp phương thức vận hành lưới điện', unit: '-', type: 'PASS_FAIL' },
      { order: 2, code: 'RCL-02', content: 'Kiểm tra tình trạng cách điện, vỏ Recloser có bụi bẩn, nứt nẻ, sứt mẻ hay không ?', std: 'Sạch sẽ, không nứt nẻ, không sứt mẻ, không bám bụi rò điện', unit: '-', type: 'PASS_FAIL' },
      { order: 3, code: 'RCL-03', content: 'Kiểm tra các điểm đấu nối vào và ra của Recloser xem có bị nóng đỏ, chuyển màu ? (Kết hợp camera đo nhiệt độ)', std: 'Không nóng đỏ, không chuyển màu (Nhiệt độ ≤ 65°C, ΔT ≤ 5°C)', unit: '°C', type: 'PASS_FAIL' },
      { order: 4, code: 'RCL-04', content: 'Kiểm tra tiếp đất có bị tưa, đứt, có bị mất hay không ?', std: 'Tiếp địa nguyên vẹn, bắt chặt bu lông, không tưa đứt', unit: '-', type: 'PASS_FAIL' },
      { order: 5, code: 'RCL-05', content: 'Giá trị điện trở tiếp đất đo được (Rđ)', std: 'Rđ ≤ 10 Ω (Cột đường dây) hoặc ≤ 4 Ω (Trạm)', unit: 'Ω', type: 'NUMBER' },
      { order: 6, code: 'RCL-06', content: 'Kiểm tra cáp đồng và bộ nối cáp đồng', std: 'Cáp đồng không tưa xơ, mối nối siết đúng lực, không oxy hóa', unit: '-', type: 'PASS_FAIL' },
      { order: 7, code: 'RCL-07', content: 'Kiểm tra nguồn pin tủ điều khiển, nguồn accu cung cấp cho relay bảo vệ: Giá trị Acqui 01 & Acqui 02 (Điện áp & Nội trở)', std: 'Acqui 01: U ≥ 12.5V, Rnt ≤ 25mΩ; Acqui 02: U ≥ 12.5V, Rnt ≤ 25mΩ', unit: 'V/mΩ', type: 'TEXT' },
      { order: 8, code: 'RCL-08', content: 'Các hiện tượng bất thường khác (tiếng ồn phóng điện corona, rò khí, chỉ thị áp suất SF6...)', std: 'Bình thường, không có âm thanh lạ hoặc hiện tượng phóng điện', unit: '-', type: 'PASS_FAIL' },
      { order: 9, code: 'RCL-09', content: 'Các thử nghiệm (nếu có): Đăng ký kế hoạch thử nghiệm định kỳ', std: 'Đã thử nghiệm định kỳ hoặc đăng ký kế hoạch kiểm định đúng hạn', unit: '-', type: 'TEXT' },
      { order: 10, code: 'RCL-10', content: 'Các lưu ý khác, đề xuất xử lý hoặc kiến nghị kỹ thuật', std: 'Ghi nhận chi tiết hiện trường và đề xuất xử lý kỹ thuật nếu có', unit: '-', type: 'TEXT' }
    ]
  },
  {
    checklist_code: 'CHK-LBS-22KV',
    title: 'Biên bản Kiểm tra Định kỳ Dao cắt phụ tải LBS',
    category: 'Kiểm tra định kỳ',
    target_device_type: 'LBS',
    version: '2026.1',
    description: 'Biên bản kiểm tra kỹ thuật định kỳ dao cắt phụ tải trung thế ngoài trời LBS theo quy chuẩn Đội Vận hành Lưới điện - Cty Điện lực Bình Dương',
    items: [
      { order: 1, code: 'LBS-01', content: '1. Tình trạng vận hành đang ở vị trí: Đóng [ ] Cắt [ ]', std: 'Phù hợp phương thức vận hành lưới điện', unit: '-', type: 'PASS_FAIL' },
      { order: 2, code: 'LBS-02', content: '2. Kiểm tra xung quanh vị trí LBS có cây cối, dây leo che phủ hoặc gần chạm hay không ?', std: 'Không có cây cối, dây leo che phủ hoặc gần chạm vi phạm khoảng cách an toàn', unit: '-', type: 'PASS_FAIL' },
      { order: 3, code: 'LBS-03', content: '3. Kiểm tra xung quanh LBS có công trình, nhà ở... xây dựng vi phạm hành lang an toàn hay làm cản trở lối ra vào thao tác không ?', std: 'Đảm bảo khoảng cách HLATLĐ, lối ra vào thao tác thông thoáng', unit: '-', type: 'PASS_FAIL' },
      { order: 4, code: 'LBS-04', content: '4. Kiểm tra các chống sét van (CSV) có bị nám, bị phóng điện hay không ?', std: 'CSV bình thường, không nám đen, không rạn nứt, không vết phóng điện', unit: '-', type: 'PASS_FAIL' },
      { order: 5, code: 'LBS-05', content: '5. Kiểm tra cáp xuất, cò đấu, mối nối xem có bị chuyển màu do quá tải hoặc do tiếp xúc không tốt hay không ?', std: 'Tiếp xúc tốt, không đổi màu do nhiệt (Nhiệt độ mối nối ≤ 65°C)', unit: '°C', type: 'PASS_FAIL' },
      { order: 6, code: 'LBS-06', content: '6. Kiểm tra bao sứ cách điện có nứt nẻ, bể hay phóng điện rò không ?', std: 'Sứ cách điện nguyên vẹn, sạch sẽ, không sứt mẻ rạn nứt', unit: '-', type: 'PASS_FAIL' },
      { order: 7, code: 'LBS-07', content: '7. Kiểm tra kim chỉ áp suất khí (SF6) ở vạch xanh hay vạch đỏ ?', std: 'Kim chỉ áp suất ở vùng Vạch Xanh (Đủ áp suất dập hồ quang tiêu chuẩn)', unit: 'Bar', type: 'PASS_FAIL' },
      { order: 8, code: 'LBS-08', content: '8. Trụ lắp LBS có đảm bảo độ vững chắc không ?', std: 'Trụ thẳng đứng, đà xà chắc chắn, bu lông siết chặt không nghiêng lệch', unit: '-', type: 'PASS_FAIL' },
      { order: 9, code: 'LBS-09', content: '9. Kiểm tra tiếp địa có bị đứt, bị mất cắp không ?', std: 'Dây tiếp địa còn nguyên vẹn, không bị đứt tưa, không mất cắp', unit: '-', type: 'PASS_FAIL' },
      { order: 10, code: 'LBS-10', content: '10. Kiểm tra tiếp địa đấu nối vào vỏ máy đúng kỹ thuật không ?', std: 'Tiếp địa đấu nối vào vỏ máy đúng quy trình kỹ thuật, bắt chặt chắc chắn', unit: '-', type: 'PASS_FAIL' },
      { order: 11, code: 'LBS-11', content: '11. Kiểm tra nguồn pin tủ điều khiển, nguồn accu cung cấp cho relay/RTU (Acqui 01 & 02: U(V), Rnt(mΩ))', std: 'Acqui 01: U ≥ 12.5V, Rnt ≤ 25mΩ; Acqui 02: U ≥ 12.5V, Rnt ≤ 25mΩ', unit: 'V/mΩ', type: 'TEXT' },
      { order: 12, code: 'LBS-12', content: '12. Các hiện tượng bất thường khác & Đề xuất xử lý hoặc kiến nghị', std: 'Ghi nhận chi tiết hiện trường và đề xuất xử lý kỹ thuật nếu có', unit: '-', type: 'TEXT' }
    ]
  },
  {
    checklist_code: 'CHK-RMU-22KV',
    title: 'Biên bản Kiểm tra Định kỳ Tủ Đóng cắt Trung thế RMU 22kV',
    category: 'Kiểm tra định kỳ',
    target_device_type: 'RMU',
    version: '2026.1',
    description: 'Quy trình kiểm tra kỹ thuật định kỳ tủ RMU đóng cắt mạch vòng và bảo vệ trạm biến áp',
    items: [
      { order: 1, code: 'RMU-01', content: 'Kiểm tra ngoại quan vỏ tủ, khóa cửa, ron cao su chống ẩm và ngăn ngừa động vật xâm nhập', std: 'Kín khít, không rỉ sét, khóa an toàn', unit: '-', type: 'PASS_FAIL' },
      { order: 2, code: 'RMU-02', content: 'Kiểm tra đồng hồ chỉ thị áp suất khí SF6 các ngăn tủ', std: 'Tất cả các ngăn ở vùng Vạch Xanh an toàn', unit: 'Bar', type: 'PASS_FAIL' },
      { order: 3, code: 'RMU-03', content: 'Kiểm tra đèn chỉ thị điện áp pha (VPIS / LRM) 3 pha các ngăn cáp', std: 'Sáng rõ, tương ứng trạng thái mang điện thực tế', unit: '-', type: 'PASS_FAIL' },
      { order: 4, code: 'RMU-04', content: 'Kiểm tra đầu cáp T-Plug, chống sét van (elbow arrester) và đo nhiệt độ tiếp xúc', std: 'Không phóng điện, nhiệt độ ≤ 60°C', unit: '°C', type: 'PASS_FAIL' },
      { order: 5, code: 'RMU-05', content: 'Kiểm tra relay bảo vệ kỹ thuật số và nguồn cấp phụ trợ RTU/SCADA', std: 'Relay READY, không báo lỗi TRIP/ALARM', unit: '-', type: 'PASS_FAIL' },
      { order: 6, code: 'RMU-06', content: 'Giá trị điện trở tiếp đất vỏ tủ đo được (Rđ)', std: 'Rđ ≤ 4 Ω', unit: 'Ω', type: 'NUMBER' },
      { order: 7, code: 'RMU-07', content: 'Kiểm tra nguồn ắc quy DC tủ điều khiển (Điện áp & Nội trở)', std: 'U ≥ 24V DC, ắc quy hoạt động tốt', unit: 'V', type: 'TEXT' },
      { order: 8, code: 'RMU-08', content: 'Ghi nhận hiện tượng bất thường và đề xuất xử lý kỹ thuật', std: 'Không có hiện tượng bất thường', unit: '-', type: 'TEXT' }
    ]
  },
  {
    checklist_code: 'CHK-DS-22KV',
    title: 'Biên bản Kiểm tra Định kỳ Dao cách ly Ngoài trời DS 22kV',
    category: 'Kiểm tra định kỳ',
    target_device_type: 'DS',
    version: '2026.1',
    description: 'Biên bản kiểm tra kỹ thuật định kỳ dao cách ly phân đoạn và liên lạc đường dây trung thế 22kV',
    items: [
      { order: 1, code: 'DS-01', content: 'Tình trạng vận hành DS đang ở vị trí: Đóng [ ] Cắt [ ]', std: 'Đúng phương thức vận hành lưới điện', unit: '-', type: 'PASS_FAIL' },
      { order: 2, code: 'DS-02', content: 'Kiểm tra lưỡi dao và ngàm tiếp xúc (độ ngậm sâu, lực ép tiếp xúc lò xo)', std: 'Ngậm sâu đúng tiêu chuẩn, tiếp xúc phẳng khít', unit: '-', type: 'PASS_FAIL' },
      { order: 3, code: 'DS-03', content: 'Đo nhiệt độ tiếp xúc má dao, đầu cốt đấu nối bằng camera nhiệt hồng ngoại', std: 'Nhiệt độ mối nối ≤ 65°C, chênh lệch pha ΔT ≤ 5°C', unit: '°C', type: 'PASS_FAIL' },
      { order: 4, code: 'DS-04', content: 'Kiểm tra sứ đỡ cách điện và khoảng cách cách điện pha-pha, pha-đất', std: 'Sứ không nứt mẻ, khoảng cách an toàn đạt chuẩn', unit: '-', type: 'PASS_FAIL' },
      { order: 5, code: 'DS-05', content: 'Kiểm tra cơ cấu truyền động cơ khí, khóa liên động, tay thao tác', std: 'Thao tác nhẹ nhàng, khóa chắc chắn', unit: '-', type: 'PASS_FAIL' },
      { order: 6, code: 'DS-06', content: 'Kiểm tra dây nối đất và hệ thống tiếp địa trụ lắp DS', std: 'Dây tiếp đất nguyên vẹn, tiếp xúc tốt, Rđ ≤ 10 Ω', unit: '-', type: 'PASS_FAIL' },
      { order: 7, code: 'DS-07', content: 'Ghi nhận bất thường & Đề xuất kiến nghị xử lý', std: 'Không có bất thường', unit: '-', type: 'TEXT' }
    ]
  }
];

export function ensureEVNChecklists() {
  try {
    for (const tpl of EVN_STANDARD_TEMPLATES) {
      const existing = dbQueryOne("SELECT id FROM checklists WHERE checklist_code = ?", [tpl.checklist_code]);
      let chkId: number;

      if (!existing) {
        dbRun(
          `INSERT INTO checklists (checklist_code, title, category, description, version, target_device_type, is_template, created_by)
           VALUES (?, ?, ?, ?, ?, ?, 1, 'EVN_STANDARDS')`,
          [tpl.checklist_code, tpl.title, tpl.category, tpl.description, tpl.version, tpl.target_device_type]
        );
        const created = dbQueryOne("SELECT id FROM checklists WHERE checklist_code = ?", [tpl.checklist_code]);
        chkId = created.id;
      } else {
        chkId = existing.id;
        dbRun(
          `UPDATE checklists SET title = ?, category = ?, description = ?, version = ?, target_device_type = ?, is_template = 1, deleted_at = NULL
           WHERE id = ?`,
          [tpl.title, tpl.category, tpl.description, tpl.version, tpl.target_device_type, chkId]
        );
      }

      // Sync items
      dbRun("DELETE FROM checklist_items WHERE checklist_id = ?", [chkId]);
      for (const itm of tpl.items) {
        dbRun(
          `INSERT INTO checklist_items (checklist_id, item_order, item_code, content, standard_value, unit, input_type)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [chkId, itm.order, itm.code, itm.content, itm.std, itm.unit, itm.type]
        );
      }
    }
    console.log('[Checklists] EVN Standard Checklist Templates synchronized successfully.');
  } catch (err) {
    console.error('[Checklists] Error synchronizing EVN checklist templates:', err);
  }
}

function generateChecklistCode(): string {
  let maxSeq = 0;
  try {
    const existingRows = dbQuery("SELECT checklist_code FROM checklists WHERE checklist_code IS NOT NULL");
    for (const row of existingRows) {
      const code = String(row.checklist_code || '');
      const match = code.match(/CHK-(?:MAU-)?(\d+)/i);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
  } catch (err) {
    console.error('Error calculating max checklist sequence:', err);
  }

  let candidateNum = maxSeq + 1;
  let candidateCode = `CHK-MAU-${String(candidateNum).padStart(3, '0')}`;

  try {
    while (dbQueryOne("SELECT id FROM checklists WHERE checklist_code = ?", [candidateCode])) {
      candidateNum++;
      candidateCode = `CHK-MAU-${String(candidateNum).padStart(3, '0')}`;
    }
  } catch (err) {
    candidateCode = `CHK-MAU-${Date.now().toString().slice(-6)}`;
  }

  return candidateCode;
}

// 0. POST /api/checklists/sync-evn-templates - Force sync / reset EVN standard templates
router.post('/sync-evn-templates', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    ensureEVNChecklists();
    res.json({ success: true, message: 'Đã cập nhật đồng bộ toàn bộ Thư viện Mẫu Checklist Tiêu chuẩn EVN' });
  } catch (error: any) {
    console.error('Error syncing EVN checklists:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi đồng bộ thư viện mẫu checklist' });
  }
});

// 0.1 GET /api/checklists/presets - Get standard preset templates
router.get('/presets', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: EVN_STANDARD_TEMPLATES });
});

// 1. GET /api/checklists - List checklists
router.get('/', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, category, target_device_type } = req.query;

    let sql = `
      SELECT c.*,
             (SELECT COUNT(*) FROM checklist_items ci WHERE ci.checklist_id = c.id) as item_count
      FROM checklists c
      WHERE c.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (search) {
      sql += ` AND (c.title LIKE ? OR c.checklist_code LIKE ? OR c.description LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (category) {
      sql += ` AND c.category = ?`;
      params.push(category);
    }

    if (target_device_type) {
      sql += ` AND (c.target_device_type = ? OR c.target_device_type = 'ALL')`;
      params.push(target_device_type);
    }

    sql += ` ORDER BY c.created_at DESC`;

    const checklists = dbQuery(sql, params);
    res.json({ success: true, data: checklists });
  } catch (error: any) {
    console.error('Error fetching checklists:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách mẫu checklist' });
  }
});

// 2. GET /api/checklists/:id - Detail with items
router.get('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const checklist = dbQueryOne("SELECT * FROM checklists WHERE id = ? AND deleted_at IS NULL", [id]);

    if (!checklist) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu checklist' });
    }

    const items = dbQuery("SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY item_order ASC", [id]);

    res.json({ success: true, data: { ...checklist, items } });
  } catch (error: any) {
    console.error('Error fetching checklist detail:', error);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi lấy chi tiết checklist' });
  }
});

// 3. POST /api/checklists - Create checklist template
router.post('/', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, category, description, version, target_device_type, items } = req.body;

    if (!title || !category) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền Tên checklist và Danh mục' });
    }

    const code = generateChecklistCode();

    dbRun(
      `INSERT INTO checklists (
        checklist_code, title, category, description, version, target_device_type, is_template, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        code,
        title,
        category,
        description || '',
        version || '1.0',
        target_device_type || 'ALL',
        req.user?.username || 'SYSTEM'
      ]
    );

    const newChecklist = dbQueryOne("SELECT * FROM checklists WHERE checklist_code = ?", [code]);

    // Insert Items if provided
    if (Array.isArray(items) && items.length > 0) {
      items.forEach((item: any, idx: number) => {
        dbRun(
          `INSERT INTO checklist_items (
            checklist_id, item_order, item_code, content, standard_value, unit, input_type, options_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newChecklist.id,
            idx + 1,
            item.item_code || `ITEM-${idx + 1}`,
            item.content,
            item.standard_value || '',
            item.unit || '-',
            item.input_type || 'PASS_FAIL',
            item.options_json ? JSON.stringify(item.options_json) : null
          ]
        );
      });
    }

    // Audit Log
    dbRun(
      `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result)
       VALUES (?, ?, ?, 'TAO_CHECKLIST', 'CHECKLIST', ?, ?, 'SUCCESS')`,
      [
        req.user?.id || 1,
        req.user?.username || 'SYSTEM',
        req.user?.full_name || 'Hệ thống',
        code,
        `Tạo mới mẫu checklist "${title}" v${version || '1.0'}`
      ]
    );

    res.json({ success: true, message: 'Tạo mẫu checklist thành công', data: newChecklist });
  } catch (error: any) {
    console.error('Error creating checklist:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tạo mới mẫu checklist' });
  }
});

// 4. POST /api/checklists/:id/clone - Duplicate/Clone checklist
router.post('/:id/clone', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = dbQueryOne("SELECT * FROM checklists WHERE id = ?", [id]);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy checklist gốc' });
    }

    const items = dbQuery("SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY item_order ASC", [id]);

    const newCode = generateChecklistCode();
    const newTitle = `${existing.title} (Bản sao)`;
    const newVersion = `${parseFloat(existing.version || '1.0') + 0.1}`.substring(0, 3);

    dbRun(
      `INSERT INTO checklists (
        checklist_code, title, category, description, version, target_device_type, is_template, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        newCode,
        newTitle,
        existing.category,
        `Nhân bản từ mẫu ${existing.checklist_code}`,
        newVersion,
        existing.target_device_type,
        req.user?.username || 'SYSTEM'
      ]
    );

    const cloned = dbQueryOne("SELECT * FROM checklists WHERE checklist_code = ?", [newCode]);

    items.forEach((item: any) => {
      dbRun(
        `INSERT INTO checklist_items (
          checklist_id, item_order, item_code, content, standard_value, unit, input_type, options_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cloned.id,
          item.item_order,
          item.item_code,
          item.content,
          item.standard_value,
          item.unit,
          item.input_type,
          item.options_json
        ]
      );
    });

    dbRun(
      `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result)
       VALUES (?, ?, ?, 'NHAN_BAN_CHECKLIST', 'CHECKLIST', ?, ?, 'SUCCESS')`,
      [
        req.user?.id || 1,
        req.user?.username || 'SYSTEM',
        req.user?.full_name || 'Hệ thống',
        newCode,
        `Nhân bản mẫu checklist "${existing.title}" thành "${newTitle}"`
      ]
    );

    res.json({ success: true, message: 'Nhân bản mẫu checklist thành công', data: cloned });
  } catch (error: any) {
    console.error('Error cloning checklist:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi nhân bản mẫu checklist' });
  }
});

// 5. PUT /api/checklists/:id - Update checklist
router.put('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { title, category, description, version, target_device_type, items } = req.body;

    const existing = dbQueryOne("SELECT * FROM checklists WHERE id = ?", [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu checklist' });
    }

    dbRun(
      `UPDATE checklists SET
        title = ?, category = ?, description = ?, version = ?, target_device_type = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [title, category, description, version, target_device_type, id]
    );

    if (Array.isArray(items)) {
      dbRun("DELETE FROM checklist_items WHERE checklist_id = ?", [id]);
      items.forEach((item: any, idx: number) => {
        dbRun(
          `INSERT INTO checklist_items (
            checklist_id, item_order, item_code, content, standard_value, unit, input_type, options_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            idx + 1,
            item.item_code || `ITEM-${idx + 1}`,
            item.content,
            item.standard_value || '',
            item.unit || '-',
            item.input_type || 'PASS_FAIL',
            item.options_json ? JSON.stringify(item.options_json) : null
          ]
        );
      });
    }

    dbRun(
      `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result)
       VALUES (?, ?, ?, 'CAP_NHAT_CHECKLIST', 'CHECKLIST', ?, ?, 'SUCCESS')`,
      [
        req.user?.id || 1,
        req.user?.username || 'SYSTEM',
        req.user?.full_name || 'Hệ thống',
        existing.checklist_code,
        `Cập nhật mẫu checklist "${title}"`
      ]
    );

    res.json({ success: true, message: 'Cập nhật mẫu checklist thành công' });
  } catch (error: any) {
    console.error('Error updating checklist:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật checklist' });
  }
});

// 6. DELETE /api/checklists/:id
router.delete('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = dbQueryOne("SELECT * FROM checklists WHERE id = ?", [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy checklist' });
    }

    dbRun("UPDATE checklists SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);

    res.json({ success: true, message: 'Đã xóa mẫu checklist' });
  } catch (error: any) {
    console.error('Error deleting checklist:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xóa checklist' });
  }
});

export default router;
