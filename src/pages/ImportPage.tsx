import React, { useState } from 'react';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle,
  RefreshCw, Download, Database, Check, Eye, Building2, GitCommitHorizontal, Zap, Layers,
  Copy, ArrowUpRight, Search, FileDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api, ImportReport, ImportItemResult } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export const ImportPage: React.FC = () => {
  const { user, hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'devices' | 'substations' | 'feeders' | 'loops'>('devices');

  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [parsingErrors, setParsingErrors] = useState<{ index: number, reason: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1: Chọn file, 2: Xem trước, 3: Đang nhập, 4: Báo cáo kết quả
  const [importReport, setImportReport] = useState<ImportReport | null>(null);

  // Result filter state in Step 4
  const [resultFilter, setResultFilter] = useState<'ALL' | 'SUCCESS' | 'FAILED' | 'SKIPPED'>('ALL');
  const [resultSearch, setResultSearch] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  // Access check
  if (user && !user.roles?.includes('ADMIN') && !hasRole('ADMIN')) {
    return (
      <div className="p-8 text-center space-y-4 max-w-md mx-auto mt-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg">
        <XCircle className="w-16 h-16 text-red-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Truy cập bị từ chối</h2>
        <p className="text-xs text-slate-600 dark:text-slate-400">Chức năng Nhập/Xuất dữ liệu hệ thống chỉ dành cho Quản trị viên hoặc tài khoản được cấp quyền.</p>
        <a href="/" className="inline-block px-4 py-2 bg-sky-600 text-white text-xs font-bold rounded-lg hover:bg-sky-700">Quay lại Dashboard</a>
      </div>
    );
  }

  const handleTabChange = (tab: 'devices' | 'substations' | 'feeders' | 'loops') => {
    setActiveTab(tab);
    setFile(null);
    setRawRows([]);
    setErrorMsg(null);
    setSuccessMsg(null);
    setStep(1);
    setImportReport(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setErrorMsg(null);
    setSuccessMsg(null);
    setImportReport(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        if (!buffer) {
          setErrorMsg('File rỗng hoặc không đọc được dữ liệu.');
          return;
        }

        const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          setErrorMsg('File Excel/CSV không chứa Sheet dữ liệu nào.');
          return;
        }

        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const sheetData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        const parsed = parseSheetMatrix(sheetData, activeTab);

        if (parsed.rows.length === 0 && parsed.errors.length === 0) {
          setErrorMsg('Không tìm thấy dòng dữ liệu hợp lệ trong file. Vui lòng kiểm tra lại cấu trúc cột hoặc tải file mẫu chuẩn.');
          return;
        }

        setRawRows(parsed.rows);
        setParsingErrors(parsed.errors);
        setStep(2);
      } catch (err: any) {
        setErrorMsg(`Không thể đọc file: ${err.message || 'Lỗi định dạng file Excel/CSV'}`);
      }
    };
    reader.onerror = () => {
      setErrorMsg('Lỗi đọc file từ thiết bị.');
    };
    reader.readAsArrayBuffer(uploadedFile);
  };

  const parseSheetMatrix = (matrix: any[][], type: 'devices' | 'substations' | 'feeders' | 'loops'): { rows: any[], errors: { index: number, reason: string }[] } => {
    if (!matrix || matrix.length === 0) return { rows: [], errors: [] };

    let headerRowIdx = 0;
    // Find header row in first 5 rows
    for (let i = 0; i < Math.min(5, matrix.length); i++) {
      const rowStr = matrix[i].join(' ').toLowerCase();
      if (type === 'devices' && (rowStr.includes('thiết bị') || rowStr.includes('device') || rowStr.includes('mã') || rowStr.includes('loại'))) {
        headerRowIdx = i;
        break;
      }
      if (type === 'substations' && (rowStr.includes('trạm') || rowStr.includes('substation') || rowStr.includes('mã trạm'))) {
        headerRowIdx = i;
        break;
      }
      if (type === 'feeders' && (rowStr.includes('phát tuyến') || rowStr.includes('feeder') || rowStr.includes('xuất tuyến') || rowStr.includes('lộ'))) {
        headerRowIdx = i;
        break;
      }
      if (type === 'loops' && (rowStr.includes('khép vòng') || rowStr.includes('mã khép vòng') || rowStr.includes('loop'))) {
        headerRowIdx = i;
        break;
      }
    }

    const headers = matrix[headerRowIdx].map(h => (h || '').toString().trim().toLowerCase());
    const rows: any[] = [];
    const errors: { index: number, reason: string }[] = [];

    for (let i = headerRowIdx + 1; i < matrix.length; i++) {
      const row = matrix[i];
      if (!row || row.length === 0) continue;
      if (row.every(c => c === undefined || c === null || c.toString().trim() === '')) continue;

      const obj: any = {};
      headers.forEach((h, colIdx) => {
        const val = row[colIdx] !== undefined && row[colIdx] !== null ? row[colIdx].toString().trim() : '';
        if (!h) return;

        let mapped = false;
        if (type === 'devices') {
          // Khớp chính xác/regex theo thứ tự ưu tiên
          if (/(substation_code|substation|trạm|tram)/.test(h)) { obj.substation_code = val; mapped = true; }
          else if (/(feeder_code|feeder|tuyến|tuyen|lộ)/.test(h)) { obj.feeder_code = val; mapped = true; }
          else if (/(pole|trụ|cột|vi_tri)/.test(h)) { obj.pole_number = val; mapped = true; }
          else if (/(device_type|loại|type)/.test(h)) { obj.device_type = val; mapped = true; }
          else if (/(^name$|tên|ten)/.test(h)) { obj.name = val; mapped = true; }
          else if (/(device_id|code|mã|ma_tb)/.test(h)) { obj.device_id = val; mapped = true; }
          else if (/(unit|đơn vị)/.test(h)) { obj.unit = val; mapped = true; }
          else if (/(team|đội)/.test(h)) { obj.team = val; mapped = true; }
          else if (/(switch|đóng|mở)/.test(h)) { obj.switch_status = val; mapped = true; }
          else if (/(scada)/.test(h)) { obj.scada_status = val; mapped = true; }
          else if (/(relay|79)/.test(h)) { obj.relay_79 = val; mapped = true; }
          else if (/(status|trạng thái|trang_thai)/.test(h)) { obj.status = val; mapped = true; }
          else if (/(dòng chỉnh định|dòng cài đặt|current setting)/.test(h)) { obj.current_setting = val; mapped = true; }
          else if (/(map|link|tọa độ)/.test(h)) { obj.google_maps_url = val; mapped = true; }
          else if (/(ghi chú|notes)/.test(h)) { obj.notes = val; mapped = true; }
          
          if (!mapped) {
            console.warn(`[Import Diagnostic] Unmapped column header: '${h}' for row ${i}, value: '${val}'`);
          }
        } else if (type === 'substations') {
          if (h.includes('mã') || h.includes('code')) obj.substation_code = val;
          else if (h.includes('tên') || h.includes('name')) obj.name = val;
          else if (h.includes('địa chỉ') || h.includes('address')) obj.address = val;
          else if (h.includes('trạng thái') || h.includes('status')) obj.status = val;
        } else if (type === 'feeders') {
          if (h.includes('mã') || h.includes('code')) obj.feeder_code = val;
          else if (h.includes('tên') || h.includes('name')) obj.name = val;
          else if (h.includes('trạm') || h.includes('substation')) obj.substation_name = val;
          else if (h.includes('trạng thái') || h.includes('status')) obj.status = val;
        } else if (type === 'loops') {
          if (h.includes('mã') && h.includes('vòng')) obj.loop_id = val;
          else if (h.includes('tên') && h.includes('vòng')) obj.name = val;
          else if (h.includes('trạm') && h.includes('a')) obj.station_a = val;
          else if (h.includes('tuyến') && h.includes('a')) obj.feeder_a = val;
          else if (h.includes('thiết bị') && h.includes('a')) obj.device_a = val;
          else if (h.includes('thiết bị') && h.includes('chính')) obj.loop_device = val;
          else if (h.includes('thiết bị') && h.includes('b')) obj.device_b = val;
          else if (h.includes('tuyến') && h.includes('b')) obj.feeder_b = val;
          else if (h.includes('trạm') && h.includes('b')) obj.station_b = val;
          else if (h.includes('trạng thái')) obj.status = val;
          else if (h.includes('ghi chú')) obj.notes = val;
        }
      });

      if (Object.keys(obj).length > 0) {
        rows.push(obj);
      }
    }

    return { rows, errors };
  };

  const downloadSampleTemplate = () => {
    let data: any[][] = [];
    let filename = '';
    let sheetName = '';

    if (activeTab === 'devices') {
      data = [
        ["Mã thiết bị", "Tên thiết bị", "Loại thiết bị", "Vị trí trụ lắp đặt", "Trạm 110kV", "Phát tuyến", "Đơn vị", "Đội QLVH", "Trạng thái", "Trạng thái cắt", "SCADA", "Rơ le 79", "Dòng chỉnh định", "Vĩ độ (Lat)", "Kinh độ (Lng)", "Ghi chú"],
        ["LBS-001", "Cầu dao phụ tải LBS 001", "LBS", "Trụ 12", "T110-E1", "471-E1", "Điện lực Bình Dương", "ĐỘI QLVH", "ACTIVE", "CLOSED", "SIGNAL", "N_A", "300A", "10.762", "106.660", ""],
        ["REC-002", "Máy cắt Recloser 002", "RCL", "Trụ 45", "T110-E1", "472-E1", "Điện lực Bình Dương", "ĐỘI QLVH", "ACTIVE", "CLOSED", "SIGNAL", "N_A", "400A", "", "", ""]
      ];
      filename = 'Mau_Import_Thiet_Bi.xlsx';
      sheetName = 'ThietBi';
    } else if (activeTab === 'substations') {
      data = [
        ["Mã trạm", "Tên trạm", "Địa chỉ", "Trạng thái"],
        ["SUB_E1", "Trạm 110kV E1", "Quận 1, TP.HCM", "ACTIVE"],
        ["SUB_E2", "Trạm 110kV E2", "Quận 3, TP.HCM", "ACTIVE"]
      ];
      filename = 'Mau_Import_Tram_110kV.xlsx';
      sheetName = 'Tram110kV';
    } else if (activeTab === 'feeders') {
      data = [
        ["Mã phát tuyến", "Tên phát tuyến", "Trạm 110kV", "Trạng thái"],
        ["471-E1", "Lộ 471 E1", "Trạm 110kV E1", "ACTIVE"],
        ["472-E1", "Lộ 472 E1", "Trạm 110kV E1", "ACTIVE"]
      ];
      filename = 'Mau_Import_Phat_Tuyen.xlsx';
      sheetName = 'PhatTuyen';
    } else if (activeTab === 'loops') {
      data = [
        ["Mã khép vòng", "Tên khép vòng", "Trạm phía A", "Phát tuyến phía A", "Thiết bị phía A", "Thiết bị phía B", "Phát tuyến phía B", "Trạm phía B", "Trạng thái", "Ghi chú"],
        ["LOOP_01", "Khép vòng E1 - E2", "Trạm 110kV E1", "471-E1", "LBS-001", "LBS-002", "472-E2", "Trạm 110kV E2", "ACTIVE", "Khép vòng dự phòng"]
      ];
      filename = 'Mau_Import_Khep_Vong.xlsx';
      sheetName = 'KhepVong';
    }

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = async () => {
    try {
      setLoading(true);
      let resData: any[] = [];
      let filename = '';
      let sheetName = '';

      if (activeTab === 'devices') {
        const res = await api.getReportData('devices');
        resData = (res.data || []).map((d: any) => ({
          "Mã thiết bị": d.device_id || d.device_code || '',
          "Tên thiết bị": d.name || '',
          "Loại thiết bị": d.device_type || '',
          "Vị trí trụ lắp đặt": d.pole_number || '',
          "Trạm 110kV": d.substation_name || d.substation_code || '',
          "Phát tuyến": d.feeder_name || d.feeder_code || '',
          "Đơn vị": d.unit || '',
          "Đội QLVH": d.team || '',
          "Trạng thái": d.status || '',
          "Dòng chỉnh định": d.current_setting || '',
          "Vĩ độ (Lat)": d.latitude || '',
          "Kinh độ (Lng)": d.longitude || '',
          "Ghi chú": d.notes || ''
        }));
        filename = `Danh_Sach_Thiet_Bi_${new Date().toISOString().slice(0, 10)}.xlsx`;
        sheetName = 'ThietBi';
      } else if (activeTab === 'substations') {
        const res = await api.getSubstations();
        resData = res.data || [];
        filename = `Danh_Sach_Tram_110kV_${new Date().toISOString().slice(0, 10)}.xlsx`;
        sheetName = 'Tram110kV';
      } else if (activeTab === 'feeders') {
        const res = await api.getFeeders();
        resData = res.data || [];
        filename = `Danh_Sach_Phat_Tuyen_${new Date().toISOString().slice(0, 10)}.xlsx`;
        sheetName = 'PhatTuyen';
      } else if (activeTab === 'loops') {
        const res = await api.getLoops();
        resData = (res.data || []).map((l: any) => ({
          "Mã khép vòng": l.loop_id,
          "Tên khép vòng": l.name,
          "Trạm phía A": l.substation_name_a || '',
          "Phát tuyến phía A": l.feeder_code_a || '',
          "Thiết bị phía A": l.device_id_a || '',
          "Thiết bị phía B": l.device_id_b || '',
          "Phát tuyến phía B": l.feeder_code_b || '',
          "Trạm phía B": l.substation_name_b || '',
          "Trạng thái": l.status,
          "Ghi chú": l.notes || ''
        }));
        filename = `Danh_Sach_Khep_Vong_${new Date().toISOString().slice(0, 10)}.xlsx`;
        sheetName = 'KhepVong';
      }

      if (resData.length === 0) {
        alert('Không có dữ liệu để xuất.');
        setLoading(false);
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(resData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      XLSX.writeFile(workbook, filename);
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      alert(`Lỗi xuất Excel: ${err.message}`);
      setLoading(false);
    }
  };

  const handleExecuteImport = async () => {
    if (rawRows.length === 0) return;

    try {
      setLoading(true);
      setStep(3);
      setErrorMsg(null);
      setSuccessMsg(null);

      let res: any;
      if (activeTab === 'devices') {
        res = await api.importDirect(rawRows);
      } else if (activeTab === 'substations') {
        res = await api.importSubstations(rawRows);
      } else if (activeTab === 'feeders') {
        res = await api.importFeeders(rawRows);
      } else if (activeTab === 'loops') {
        res = await api.importLoops(rawRows);
      }

      const reportData: ImportReport = res.report || {
        total_processed: rawRows.length,
        success_count: res.success ? rawRows.length : 0,
        imported_new: res.success ? rawRows.length : 0,
        updated_existing: 0,
        failed_count: res.success ? 0 : rawRows.length,
        skipped_count: 0,
        success_items: res.success ? rawRows.map((r, i) => ({
          row_index: i + 1,
          code: r.device_id || r.substation_code || r.feeder_code || r.loop_id || `ITEM_${i+1}`,
          name: r.name || 'Hạng mục',
          type: r.device_type || 'Thiết bị',
          status: 'SUCCESS',
          action: 'INSERTED',
          details: 'Nhập thành công vào hệ thống'
        })) : [],
        failed_items: res.success ? [] : rawRows.map((r, i) => ({
          row_index: i + 1,
          code: r.device_id || r.substation_code || r.feeder_code || r.loop_id || `ITEM_${i+1}`,
          name: r.name || 'Hạng mục',
          type: r.device_type || 'Thiết bị',
          status: 'FAILED',
          reason: res.message || 'Lỗi không xác định khi ghi dữ liệu'
        }))
      };

      setImportReport(reportData);
      setStep(4);

      if (reportData.failed_count === 0) {
        setSuccessMsg(res.message || 'Nhập toàn bộ dữ liệu thành công 100%!');
      } else if (reportData.success_count > 0) {
        setSuccessMsg(`Nhập hoàn tất với cảnh báo: ${reportData.success_count} thành công, ${reportData.failed_count} thất bại.`);
      } else {
        setErrorMsg(res.message || 'Không có hạng mục nào được nhập thành công.');
      }
    } catch (err: any) {
      console.error('Import error:', err);
      const failedReport: ImportReport = {
        total_processed: rawRows.length,
        success_count: 0,
        imported_new: 0,
        updated_existing: 0,
        failed_count: rawRows.length,
        skipped_count: 0,
        success_items: [],
        failed_items: rawRows.map((r, i) => ({
          row_index: i + 1,
          code: r.device_id || r.substation_code || r.feeder_code || r.loop_id || `ROW_${i + 1}`,
          name: r.name || 'N/A',
          type: r.device_type || 'N/A',
          status: 'FAILED',
          reason: err.message || 'Lỗi xử lý hệ thống hoặc gián đoạn giao dịch'
        }))
      };
      setImportReport(failedReport);
      setErrorMsg(err.message || 'Đã xảy ra lỗi nghiêm trọng trong quá trình nhập dữ liệu.');
      setStep(4);
    } finally {
      setLoading(false);
    }
  };

  // Export results report to Excel
  const handleExportReportExcel = () => {
    if (!importReport) return;
    const allItems: any[] = [];

    (importReport.success_items || []).forEach(item => {
      allItems.push({
        "Dòng (File)": item.row_index,
        "Mã hạng mục": item.code,
        "Tên hạng mục": item.name,
        "Phân loại": item.type || '-',
        "Kết quả": "THÀNH CÔNG",
        "Hành động": item.action === 'UPDATED' ? 'Cập nhật dữ liệu cũ' : 'Thêm mới vào hệ thống',
        "Chi tiết / Nguyên nhân": item.details || 'Đã ghi nhận thành công'
      });
    });

    (importReport.failed_items || []).forEach(item => {
      allItems.push({
        "Dòng (File)": item.row_index,
        "Mã hạng mục": item.code,
        "Tên hạng mục": item.name,
        "Phân loại": item.type || '-',
        "Kết quả": "THẤT BẠI",
        "Hành động": "BỊ HỦY",
        "Chi tiết / Nguyên nhân": item.reason || 'Lỗi dữ liệu không xác định'
      });
    });

    (importReport.skipped_items || []).forEach(item => {
      allItems.push({
        "Dòng (File)": item.row_index,
        "Mã hạng mục": item.code,
        "Tên hạng mục": item.name,
        "Phân loại": item.type || '-',
        "Kết quả": "BỎ QUA",
        "Hành động": "BỎ QUA",
        "Chi tiết / Nguyên nhân": item.details || 'Bỏ qua theo cấu hình'
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(allItems);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'BaoCaoKetQua');
    XLSX.writeFile(workbook, `Bao_Cao_Ket_Qua_Import_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Copy report summary to clipboard
  const handleCopySummary = () => {
    if (!importReport) return;
    const text = [
      `=== BÁO CÁO KẾT QUẢ NHẬP DỮ LIỆU [${activeTab.toUpperCase()}] ===`,
      `- Tổng số dòng xử lý: ${importReport.total_processed}`,
      `- Thành công: ${importReport.success_count} (Thêm mới: ${importReport.imported_new}, Cập nhật: ${importReport.updated_existing})`,
      `- Thất bại: ${importReport.failed_count}`,
      `- Bỏ qua: ${importReport.skipped_count}`,
      '',
      importReport.failed_items?.length > 0 ? `DANH SÁCH HẠNG MỤC THẤT BẠI VÀ NGUYÊN NHÂN:` : 'Tất cả hạng mục đều nhập thành công!',
      ...(importReport.failed_items || []).map((f, i) => `${i + 1}. [Dòng ${f.row_index}] Mã: ${f.code} - Tên: ${f.name} => Nguyên nhân: ${f.reason}`)
    ].join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    });
  };

  // Filter items in Step 4
  const getFilteredItems = (): ImportItemResult[] => {
    if (!importReport) return [];
    let items: ImportItemResult[] = [];

    if (resultFilter === 'ALL') {
      items = [
        ...(importReport.success_items || []),
        ...(importReport.failed_items || []),
        ...(importReport.skipped_items || [])
      ];
    } else if (resultFilter === 'SUCCESS') {
      items = importReport.success_items || [];
    } else if (resultFilter === 'FAILED') {
      items = importReport.failed_items || [];
    } else if (resultFilter === 'SKIPPED') {
      items = importReport.skipped_items || [];
    }

    if (resultSearch.trim()) {
      const q = resultSearch.toLowerCase();
      items = items.filter(it => 
        (it.code && it.code.toLowerCase().includes(q)) ||
        (it.name && it.name.toLowerCase().includes(q)) ||
        (it.type && it.type.toLowerCase().includes(q)) ||
        (it.reason && it.reason.toLowerCase().includes(q)) ||
        (it.details && it.details.toLowerCase().includes(q))
      );
    }

    return items;
  };

  const filteredItems = getFilteredItems();

  const getTabLabel = (t: 'devices' | 'substations' | 'feeders' | 'loops') => {
    switch (t) {
      case 'devices': return 'Thiết Bị Lưới Điện';
      case 'substations': return 'Trạm 110kV';
      case 'feeders': return 'Phát Tuyến (Xuất tuyến)';
      case 'loops': return 'Mạch Khép Vòng';
    }
  };

  const getEntityPath = (t: 'devices' | 'substations' | 'feeders' | 'loops') => {
    switch (t) {
      case 'devices': return '/equipment';
      case 'substations': return '/substations';
      case 'feeders': return '/feeders';
      case 'loops': return '/loops';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="w-6 h-6 text-sky-600" />
            Nhập / Xuất Dữ Liệu Lưới Điện
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Đồng bộ dữ liệu tập trung với hệ thống phân tích, báo cáo kết quả chi tiết theo từng hạng mục thành công & thất bại.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className={`px-3 py-1.5 rounded-lg border ${step === 1 ? 'bg-sky-600 text-white border-sky-600 font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>
            1. Chọn file
          </span>
          <span className="text-slate-400">→</span>
          <span className={`px-3 py-1.5 rounded-lg border ${step === 2 ? 'bg-sky-600 text-white border-sky-600 font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>
            2. Xem trước
          </span>
          <span className="text-slate-400">→</span>
          <span className={`px-3 py-1.5 rounded-lg border ${step === 3 ? 'bg-amber-600 text-white border-amber-600 font-bold animate-pulse' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>
            3. Đang xử lý
          </span>
          <span className="text-slate-400">→</span>
          <span className={`px-3 py-1.5 rounded-lg border ${step === 4 ? 'bg-emerald-600 text-white border-emerald-600 font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>
            4. Báo cáo kết quả
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-2xl px-6 pt-4 gap-2 md:gap-4">
        <button
          onClick={() => handleTabChange('devices')}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'devices'
              ? 'border-sky-600 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Zap className="w-4 h-4" />
          Thiết Bị
        </button>
        <button
          onClick={() => handleTabChange('substations')}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'substations'
              ? 'border-sky-600 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Trạm 110kV
        </button>
        <button
          onClick={() => handleTabChange('feeders')}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'feeders'
              ? 'border-sky-600 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <GitCommitHorizontal className="w-4 h-4" />
          Phát Tuyến
        </button>
        <button
          onClick={() => handleTabChange('loops')}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'loops'
              ? 'border-sky-600 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          Khép Vòng
        </button>
      </div>

      {/* Main Content Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-6">
        {/* Actions Bar */}
        {step !== 4 && (
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={downloadSampleTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-100 shadow-xs transition-all"
              >
                <Download className="w-4 h-4 text-sky-600" />
                <span>Tải Mẫu Excel {activeTab === 'devices' ? 'Thiết Bị' : activeTab === 'substations' ? 'Trạm 110kV' : activeTab === 'feeders' ? 'Phát Tuyến' : 'Khép Vòng'}</span>
              </button>

              <button
                onClick={handleExportExcel}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 shadow-xs transition-all"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Xuất Excel Toàn Bộ {activeTab === 'devices' ? 'Thiết Bị' : activeTab === 'substations' ? 'Trạm 110kV' : activeTab === 'feeders' ? 'Phát Tuyến' : 'Khép Vòng'}</span>
              </button>
            </div>

            <label className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white text-xs font-bold rounded-xl hover:bg-sky-700 shadow-xs cursor-pointer transition-all">
              <Upload className="w-4 h-4" />
              <span>Tải Lên File Excel/CSV ({getTabLabel(activeTab)})</span>
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        )}

        {/* Global Notifications */}
        {errorMsg && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-600" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {/* Step 1: Initial upload prompt */}
        {step === 1 && (
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-12 text-center space-y-4 hover:border-sky-500 transition-colors">
            <div className="w-16 h-16 bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-full flex items-center justify-center mx-auto">
              <Upload className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Chọn file Excel hoặc kéo thả vào đây
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Hệ thống hỗ trợ các định dạng .xlsx, .xls và .csv. Hãy tải file mẫu chuẩn để đảm bảo nhận diện chính xác các trường dữ liệu.
              </p>
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <label className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer transition-all">
                Chọn File Từ Máy Tính
                <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="hidden" />
              </label>
              <button
                onClick={downloadSampleTemplate}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all"
              >
                Tải File Mẫu Chuẩn
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Preview Matrix */}
        {step === 2 && rawRows.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-sky-100 dark:bg-sky-900/40 text-sky-600 flex items-center justify-center">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Xem trước dữ liệu: <span className="text-sky-600">{file?.name}</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tìm thấy <span className="font-bold text-slate-700 dark:text-slate-300">{rawRows.length} dòng dữ liệu</span> sẵn sàng nhập vào {getTabLabel(activeTab)}.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setStep(1); setRawRows([]); setFile(null); }}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800 rounded-xl transition-all"
                >
                  Hủy & Chọn file khác
                </button>
                <button
                  onClick={handleExecuteImport}
                  disabled={loading}
                  className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Bắt Đầu Nhập ({rawRows.length} Dòng)
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-96 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-100 dark:bg-slate-800 uppercase font-bold sticky top-0 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3 w-12 text-center">STT</th>
                    {Object.keys(rawRows[0] || {}).map((k) => (
                      <th key={k} className="p-3 font-semibold">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                  {rawRows.slice(0, 50).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                      {Object.values(row).map((val: any, vIdx) => (
                        <td key={vIdx} className="p-3 truncate max-w-xs font-sans">{val || '-'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rawRows.length > 50 && (
              <p className="text-xs text-slate-500 italic">Đang hiển thị 50 dòng đầu tiên của bảng tính (Tổng cộng: {rawRows.length} dòng).</p>
            )}

            {parsingErrors.length > 0 && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4" />
                  Cảnh báo ánh xạ ({parsingErrors.length} lỗi):
                </div>
                <ul className="list-disc list-inside space-y-1">
                  {parsingErrors.slice(0, 10).map((err, i) => (
                    <li key={i}>Dòng {err.index}: {err.reason}</li>
                  ))}
                  {parsingErrors.length > 10 && <li>...và {parsingErrors.length - 10} lỗi khác</li>}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Loading Indicator */}
        {step === 3 && (
          <div className="p-16 text-center space-y-4">
            <RefreshCw className="w-12 h-12 text-sky-600 animate-spin mx-auto" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Đang xác thực và nhập dữ liệu vào cơ sở dữ liệu...
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Hệ thống đang kiểm tra tính toàn vẹn, cập nhật các bản ghi trùng lặp và ghi nhận lịch sử kiểm toán. Vui lòng không đóng trình duyệt.
            </p>
          </div>
        )}

        {/* Step 4: Comprehensive Import Results & Reason Breakdown */}
        {step === 4 && importReport && (
          <div className="space-y-6">
            {/* Top Summary Banner */}
            <div className={`p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              importReport.failed_count === 0
                ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                : importReport.success_count > 0
                ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                : 'bg-red-50/70 dark:bg-red-950/20 border-red-200 dark:border-red-800'
            }`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  importReport.failed_count === 0
                    ? 'bg-emerald-600 text-white'
                    : importReport.success_count > 0
                    ? 'bg-amber-600 text-white'
                    : 'bg-red-600 text-white'
                }`}>
                  {importReport.failed_count === 0 ? (
                    <CheckCircle2 className="w-7 h-7" />
                  ) : importReport.success_count > 0 ? (
                    <AlertTriangle className="w-7 h-7" />
                  ) : (
                    <XCircle className="w-7 h-7" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {importReport.failed_count === 0
                      ? 'Nhập dữ liệu thành công hoàn toàn (100%)'
                      : importReport.success_count > 0
                      ? 'Nhập dữ liệu hoàn tất với một số cảnh báo / lỗi'
                      : 'Toàn bộ dữ liệu nhập thất bại'}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Đã xử lý xong file <strong>{file?.name || 'Import'}</strong> cho phân hệ <strong>{getTabLabel(activeTab)}</strong>.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportReportExcel}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-100 shadow-xs transition-all"
                >
                  <FileDown className="w-4 h-4 text-emerald-600" />
                  <span>Xuất Báo Cáo Excel</span>
                </button>

                <button
                  onClick={handleCopySummary}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-100 shadow-xs transition-all"
                >
                  <Copy className="w-4 h-4 text-sky-600" />
                  <span>{copySuccess ? 'Đã Sao Chép!' : 'Sao Chép Tóm Tắt'}</span>
                </button>

                <a
                  href={getEntityPath(activeTab)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 text-white text-xs font-bold rounded-xl hover:bg-sky-700 shadow-xs transition-all"
                >
                  <span>Xem Danh Sách {getTabLabel(activeTab)}</span>
                  <ArrowUpRight className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng số dòng xử lý</span>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {importReport.total_processed}
                </p>
                <p className="text-xs text-slate-400 mt-1">Toàn bộ hàng trong file</p>
              </div>

              <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Thành công</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {importReport.success_count}
                </p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-1 font-medium">
                  Thêm mới: {importReport.imported_new} | Cập nhật: {importReport.updated_existing}
                </p>
              </div>

              <div className="p-4 bg-red-50/50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider">Thất bại</span>
                  <XCircle className="w-4 h-4 text-red-600" />
                </div>
                <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">
                  {importReport.failed_count}
                </p>
                <p className="text-xs text-red-700/80 dark:text-red-400/80 mt-1 font-medium">
                  {importReport.failed_count > 0 ? 'Có nguyên nhân chi tiết bên dưới' : 'Không có lỗi'}
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bỏ qua / Trùng lặp</span>
                <p className="text-2xl font-black text-slate-700 dark:text-slate-300 mt-1">
                  {importReport.skipped_count || 0}
                </p>
                <p className="text-xs text-slate-400 mt-1">Giữ nguyên dữ liệu cũ</p>
              </div>
            </div>

            {/* Detailed Items Table Header with Filter & Search */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setResultFilter('ALL')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      resultFilter === 'ALL'
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Tất Cả ({importReport.total_processed})
                  </button>
                  <button
                    onClick={() => setResultFilter('SUCCESS')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 ${
                      resultFilter === 'SUCCESS'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-50'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Thành Công ({importReport.success_count})
                  </button>
                  <button
                    onClick={() => setResultFilter('FAILED')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 ${
                      resultFilter === 'FAILED'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white dark:bg-slate-800 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50 hover:bg-red-50'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Thất Bại ({importReport.failed_count})
                  </button>
                  {importReport.skipped_count > 0 && (
                    <button
                      onClick={() => setResultFilter('SKIPPED')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        resultFilter === 'SKIPPED'
                          ? 'bg-slate-600 text-white border-slate-600'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Bỏ Qua ({importReport.skipped_count})
                    </button>
                  )}
                </div>

                <div className="relative min-w-[240px]">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm theo Mã, Tên, Nguyên nhân..."
                    value={resultSearch}
                    onChange={e => setResultSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto max-h-[460px] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-100 dark:bg-slate-800 uppercase font-bold sticky top-0 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3 w-16 text-center">Dòng</th>
                      <th className="p-3 w-32">Mã Hạng Mục</th>
                      <th className="p-3 w-48">Tên Hạng Mục</th>
                      <th className="p-3 w-24">Phân Loại</th>
                      <th className="p-3 w-32">Kết Quả</th>
                      <th className="p-3">Chi Tiết / Nguyên Nhân Thất Bại</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                          Không có hạng mục nào khớp với bộ lọc hiện tại.
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item, idx) => {
                        const isSuccess = item.status === 'SUCCESS';
                        const isFailed = item.status === 'FAILED';
                        const isSkipped = item.status === 'SKIPPED';

                        return (
                          <tr
                            key={idx}
                            className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                              isFailed ? 'bg-red-50/30 dark:bg-red-950/10' : ''
                            }`}
                          >
                            <td className="p-3 text-center font-mono font-bold text-slate-400">
                              #{item.row_index}
                            </td>
                            <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                              {item.code || '-'}
                            </td>
                            <td className="p-3 font-medium text-slate-800 dark:text-slate-200">
                              {item.name || '-'}
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-semibold text-[10px]">
                                {item.type || 'N/A'}
                              </span>
                            </td>
                            <td className="p-3">
                              {isSuccess ? (
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                  item.action === 'UPDATED'
                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                    : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                }`}>
                                  <CheckCircle2 className="w-3 h-3" />
                                  {item.action === 'UPDATED' ? 'Cập Nhật' : 'Thêm Mới'}
                                </span>
                              ) : isFailed ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                                  <XCircle className="w-3 h-3" />
                                  Thất Bại
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  Bỏ Qua
                                </span>
                              )}
                            </td>
                            <td className="p-3 font-medium">
                              {isFailed ? (
                                <div className="text-red-600 dark:text-red-400 font-semibold flex items-start gap-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                  <span>{item.reason || 'Dữ liệu không hợp lệ hoặc thiếu thông tin bắt buộc'}</span>
                                </div>
                              ) : isSuccess ? (
                                <span className="text-slate-600 dark:text-slate-400">
                                  {item.details || 'Đã xử lý và cập nhật thành công vào cơ sở dữ liệu'}
                                </span>
                              ) : (
                                <span className="text-slate-500 italic">
                                  {item.details || 'Không thay đổi'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => {
                  setStep(1);
                  setRawRows([]);
                  setFile(null);
                  setSuccessMsg(null);
                  setErrorMsg(null);
                  setImportReport(null);
                }}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all"
              >
                Nhập File Khác
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleExportReportExcel}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                >
                  <FileDown className="w-4 h-4" />
                  Xuất File Báo Cáo ({filteredItems.length} dòng)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
