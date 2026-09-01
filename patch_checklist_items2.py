import re

with open('server/db.ts', 'r', encoding='utf-8') as f:
    code = f.read()

migration_code = """
  // FORCE OVERWRITE CHECKLIST ITEMS FOR REC AND LBS
  try {
    const rclChk = dbInstance.exec("SELECT id FROM checklists WHERE checklist_code = 'CHK-RCL-22KV'");
    if (rclChk.length > 0 && rclChk[0].values.length > 0) {
      const chkRclId = rclChk[0].values[0][0];
      dbInstance.run("DELETE FROM checklist_items WHERE checklist_id = ?", [chkRclId]);
      
      const rclItems = [
        { order: 1, code: 'RCL-01', content: 'Tình trạng vận hành Recloser đang ở vị trí: Đóng [ ] Cắt [ ]', std: 'Phù hợp phương thức vận hành lưới điện', unit: '-', type: 'OPTION', options: '["Đóng", "Cắt"]' },
        { order: 2, code: 'RCL-02', content: 'Kiểm tra tình trạng cách điện, vỏ Recloser có bụi bẩn, nứt nẻ, sứt mẻ hay không ?', std: 'Sạch sẽ, không nứt nẻ, không sứt mẻ, không bám bụi rò điện', unit: '-', type: 'OPTION', options: '["Có", "Không"]' },
        { order: 3, code: 'RCL-03', content: 'Kiểm tra các điểm đấu nối vào và ra của Recloser xem có bị nóng đỏ, chuyển màu ? (Kết hợp camera đo nhiệt độ)', std: 'Không nóng đỏ, không chuyển màu (Nhiệt độ ≤ 65°C, ΔT ≤ 5°C)', unit: '°C', type: 'OPTION', options: '["Có", "Không"]' },
        { order: 4, code: 'RCL-04', content: 'Kiểm tra tiếp đất có bị tưa, đứt, có bị mất hay không ?', std: 'Tiếp địa nguyên vẹn, bắt chặt bu lông, không tưa đứt', unit: '-', type: 'OPTION', options: '["Có", "Không"]' },
        { order: 5, code: 'RCL-05', content: 'Giá trị điện trở tiếp đất đo được (Rđ)', std: 'Rđ ≤ 10 Ω (Cột đường dây) hoặc ≤ 4 Ω (Trạm)', unit: 'Ω', type: 'NUMBER', options: null },
        { order: 6, code: 'RCL-06', content: 'Kiểm tra cáp đồng và bộ nối cáp đồng', std: 'Cáp đồng không tưa xơ, mối nối siết đúng lực, không oxy hóa', unit: '-', type: 'OPTION', options: '["Có", "Không"]' },
        { order: 7, code: 'RCL-07', content: 'Kiểm tra nguồn pin tủ điều khiển, nguồn accu cung cấp cho relay bảo vệ: Giá trị Acqui 01 & Acqui 02 (Điện áp & Nội trở)', std: 'Acqui 01: U ≥ 12.5V, Rnt ≤ 25mΩ; Acqui 02: U ≥ 12.5V, Rnt ≤ 25mΩ', unit: 'V/mΩ', type: 'TEXT', options: null },
        { order: 8, code: 'RCL-08', content: 'Các hiện tượng bất thường khác (tiếng ồn phóng điện corona, rò khí, chỉ thị áp suất SF6...)', std: 'Bình thường, không có âm thanh lạ hoặc hiện tượng phóng điện', unit: '-', type: 'TEXT', options: null },
        { order: 9, code: 'RCL-09', content: 'Các thử nghiệm (nếu có): Đăng ký kế hoạch thử nghiệm định kỳ', std: 'Đã thử nghiệm định kỳ hoặc đăng ký kế hoạch kiểm định đúng hạn', unit: '-', type: 'TEXT', options: null },
        { order: 10, code: 'RCL-10', content: 'Các lưu ý khác, đề xuất xử lý hoặc kiến nghị kỹ thuật', std: 'Ghi nhận chi tiết hiện trường và đề xuất xử lý kỹ thuật nếu có', unit: '-', type: 'TEXT', options: null }
      ];
      for (const item of rclItems) {
        dbInstance.run(
          `INSERT INTO checklist_items (checklist_id, item_order, item_code, content, standard_value, unit, input_type, options_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [chkRclId, item.order, item.code, item.content, item.std, item.unit, item.type, item.options]
        );
      }
    }
    
    const lbsChk = dbInstance.exec("SELECT id FROM checklists WHERE checklist_code = 'CHK-LBS-22KV'");
    if (lbsChk.length > 0 && lbsChk[0].values.length > 0) {
      const chkLbsId = lbsChk[0].values[0][0];
      dbInstance.run("DELETE FROM checklist_items WHERE checklist_id = ?", [chkLbsId]);
      
      const lbsItems = [
        { order: 1, code: 'LBS-01', content: '1. Tình trạng vận hành đang ở vị trí: Đóng [ ] Cắt [ ]', std: 'Phù hợp phương thức vận hành lưới điện', unit: '-', type: 'OPTION', options: '["Đóng", "Cắt"]' },
        { order: 2, code: 'LBS-02', content: '2. Kiểm tra xung quanh vị trí LBS có cây cối, dây leo che phủ hoặc gần chạm hay không ?', std: 'Không có cây cối, dây leo che phủ hoặc gần chạm vi phạm khoảng cách an toàn', unit: '-', type: 'OPTION', options: '["Có", "Không"]' },
        { order: 3, code: 'LBS-03', content: '3. Kiểm tra xung quanh LBS có công trình, nhà ở... xây dựng vi phạm hành lang an toàn hay làm cản trở lối ra vào thao tác không ?', std: 'Đảm bảo khoảng cách HLATLĐ, lối ra vào thao tác thông thoáng', unit: '-', type: 'OPTION', options: '["Có", "Không"]' },
        { order: 4, code: 'LBS-04', content: '4. Kiểm tra các chống sét van (CSV) có bị nám, bị phóng điện hay không ?', std: 'CSV bình thường, không nám đen, không rạn nứt, không vết phóng điện', unit: '-', type: 'OPTION', options: '["Có", "Không"]' },
        { order: 5, code: 'LBS-05', content: '5. Kiểm tra cáp xuất, cò đấu, mối nối xem có bị chuyển màu do quá tải hoặc do tiếp xúc không tốt hay không ?', std: 'Tiếp xúc tốt, không đổi màu do nhiệt (Nhiệt độ mối nối ≤ 65°C)', unit: '°C', type: 'OPTION', options: '["Có", "Không"]' },
        { order: 6, code: 'LBS-06', content: '6. Kiểm tra bao sứ cách điện có nứt nẻ, bể hay phóng điện rò không ?', std: 'Sứ cách điện nguyên vẹn, sạch sẽ, không sứt mẻ rạn nứt', unit: '-', type: 'OPTION', options: '["Có", "Không"]' },
        { order: 7, code: 'LBS-07', content: '7. Kiểm tra kim chỉ áp suất khí (SF6) ở vạch xanh hay vạch đỏ ?', std: 'Kim chỉ áp suất ở vùng Vạch Xanh (Đủ áp suất dập hồ quang tiêu chuẩn)', unit: 'Bar', type: 'OPTION', options: '["Vạch xanh", "Vạch đỏ"]' },
        { order: 8, code: 'LBS-08', content: '8. Trụ lắp LBS có đảm bảo độ vững chắc không ?', std: 'Trụ thẳng đứng, đà xà chắc chắn, bu lông siết chặt không nghiêng lệch', unit: '-', type: 'OPTION', options: '["Có", "Không"]' },
        { order: 9, code: 'LBS-09', content: '9. Kiểm tra tiếp địa có bị đứt, bị mất cắp không ?', std: 'Dây tiếp địa còn nguyên vẹn, không bị đứt tưa, không mất cắp', unit: '-', type: 'OPTION', options: '["Có", "Không"]' },
        { order: 10, code: 'LBS-10', content: '10. Kiểm tra tiếp địa đấu nối vào vỏ máy đúng kỹ thuật không ?', std: 'Tiếp địa đấu nối vào vỏ máy đúng quy trình kỹ thuật, bắt chặt chắc chắn', unit: '-', type: 'OPTION', options: '["Có", "Không"]' },
        { order: 11, code: 'LBS-11', content: '11. Kiểm tra nguồn pin tủ điều khiển, nguồn accu cung cấp cho relay/RTU (Acqui 01 & 02: U(V), Rnt(mΩ))', std: 'Acqui 01: U ≥ 12.5V, Rnt ≤ 25mΩ; Acqui 02: U ≥ 12.5V, Rnt ≤ 25mΩ', unit: 'V/mΩ', type: 'TEXT', options: null },
        { order: 12, code: 'LBS-12', content: '12. Các hiện tượng bất thường khác & Đề xuất xử lý hoặc kiến nghị', std: 'Ghi nhận chi tiết hiện trường và đề xuất xử lý kỹ thuật nếu có', unit: '-', type: 'TEXT', options: null }
      ];
      for (const item of lbsItems) {
        dbInstance.run(
          `INSERT INTO checklist_items (checklist_id, item_order, item_code, content, standard_value, unit, input_type, options_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [chkLbsId, item.order, item.code, item.content, item.std, item.unit, item.type, item.options]
        );
      }
    }
    console.log("Forced overwrite of REC and LBS checklists successful.");
  } catch (err) {
    console.error("Failed to overwrite REC and LBS checklists", err);
  }
"""

# add right before return dbInstance in getDb()
code = code.replace('return dbInstance;', f'{migration_code}\n  return dbInstance;')

with open('server/db.ts', 'w', encoding='utf-8') as f:
    f.write(code)

