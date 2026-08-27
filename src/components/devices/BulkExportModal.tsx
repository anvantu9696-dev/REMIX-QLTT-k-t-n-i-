import React, { useState } from 'react';
import { X, Download, FileSpreadsheet, FileText, MapPin, CheckCircle2, Radio, CheckSquare, Layers, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Device } from '../../types';

interface BulkExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDevices: Device[];
}

export const BulkExportModal: React.FC<BulkExportModalProps> = ({
  isOpen,
  onClose,
  selectedDevices
}) => {
  const [reportType, setReportType] = useState<'full' | 'operation' | 'inspection' | 'gis'>('full');
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [exporting, setExporting] = useState(false);

  if (!isOpen) return null;

  const handleExport = () => {
    setExporting(true);
    try {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = `${now.getHours()}h${now.getMinutes()}`;

      if (reportType === 'full') {
        // 1. Full Technical & Operational Report
        const data = selectedDevices.map((d, index) => ({
          "STT": index + 1,
          "Mã thiết bị (DEVICE_ID)": d.device_id || '',
          "Mã thiết bị nội bộ": d.device_code || '',
          "Tên thiết bị": d.name || '',
          "Loại thiết bị": d.device_type === 'RCL' ? 'REC' : d.device_type,
          "Vị trí trụ lắp đặt": d.pole_number || '',
          "Trạm 110kV": d.substation_name || '',
          "Mã trạm": d.substation_code || '',
          "Phát tuyến": d.feeder_name || '',
          "Mã phát tuyến": d.feeder_code || '',
          "Đơn vị quản lý": d.unit || '',
          "Đội QLVH": d.team || '',
          "Trạng thái vận hành": d.status === 'ACTIVE' ? 'ĐANG VẬN HÀNH' : d.status === 'MAINTENANCE' ? 'BẢO DƯỠNG' : 'NGỪNG VẬN HÀNH',
          "Trạng thái dao/máy cắt": d.switch_status === 'CLOSED' ? 'ĐANG ĐÓNG' : d.switch_status === 'OPEN' ? 'ĐANG MỞ' : 'CHƯA RÕ',
          "Tín hiệu SCADA": d.scada_status === 'SIGNAL' ? 'CÓ TÍN HIỆU' : d.scada_status === 'NO_SIGNAL' ? 'MẤT TÍN HIỆU' : 'UNKNOWN',
          "Rơ le 79": d.relay_79 === 'ON' ? 'BẬT' : d.relay_79 === 'OFF' ? 'TẮT' : 'N/A',
          "Tình trạng Ắc quy": d.battery_status === 'GOOD' ? 'TỐT' : d.battery_status === 'WEAK' ? 'YẾU' : d.battery_status === 'BROKEN' ? 'HỎNG' : d.battery_status === 'REPLACING' ? 'ĐANG THAY' : 'CHƯA KIỂM TRA',
          "Vĩ độ (Latitude)": d.latitude != null ? d.latitude : '',
          "Kinh độ (Longitude)": d.longitude != null ? d.longitude : '',
          "Liên kết Google Maps": d.google_maps_url || (d.latitude && d.longitude ? `https://maps.google.com/?q=${d.latitude},${d.longitude}` : ''),
          "Ghi chú kỹ thuật": d.notes || ''
        }));

        if (format === 'xlsx') {
          const ws = XLSX.utils.json_to_sheet(data);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "DanhSachThietBi");
          XLSX.writeFile(wb, `Bao_Cao_Tong_Hop_Thiet_Bi_${dateStr}_${timeStr}.xlsx`);
        } else {
          exportCSV(data, `Bao_Cao_Tong_Hop_Thiet_Bi_${dateStr}.csv`);
        }

      } else if (reportType === 'operation') {
        // 2. Operational & SCADA Status Report
        const data = selectedDevices.map((d, index) => ({
          "STT": index + 1,
          "Mã thiết bị": d.device_id || '',
          "Tên thiết bị": d.name || '',
          "Loại": d.device_type === 'RCL' ? 'REC' : d.device_type,
          "Vị trí trụ": d.pole_number || '',
          "Phát tuyến": d.feeder_name || '',
          "Trạng thái đóng/mở": d.switch_status === 'CLOSED' ? 'ĐANG ĐÓNG' : d.switch_status === 'OPEN' ? 'ĐANG MỞ' : 'CHƯA RÕ',
          "Tín hiệu SCADA": d.scada_status === 'SIGNAL' ? 'CÓ TÍN HIỆU' : d.scada_status === 'NO_SIGNAL' ? 'MẤT TÍN HIỆU' : 'UNKNOWN',
          "Rơ le 79": d.relay_79 || 'N_A',
          "Ắc quy": d.battery_status || 'UNCHECKED',
          "Tình trạng vận hành": d.status || 'ACTIVE',
          "Ghi chú": d.notes || ''
        }));

        if (format === 'xlsx') {
          const ws = XLSX.utils.json_to_sheet(data);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "HienTrangVanHanh");
          XLSX.writeFile(wb, `Bao_Cao_Hien_Trang_Van_Hanh_${dateStr}.xlsx`);
        } else {
          exportCSV(data, `Bao_Cao_Hien_Trang_Van_Hanh_${dateStr}.csv`);
        }

      } else if (reportType === 'inspection') {
        // 3. Field Inspection Checklist
        const data = selectedDevices.map((d, index) => ({
          "STT": index + 1,
          "Mã thiết bị": d.device_id || '',
          "Tên thiết bị": d.name || '',
          "Loại TB": d.device_type === 'RCL' ? 'REC' : d.device_type,
          "Vị trí trụ lắp đặt": d.pole_number || '',
          "Trạm & Tuyến": `${d.substation_name || ''} - ${d.feeder_name || ''}`,
          "Trạng thái hiện tại": d.switch_status === 'CLOSED' ? 'Đóng' : 'Mở',
          "Tiếp xúc má dao / Đầu cosse": "",
          "Mức dầu / Áp lực khí SF6": "",
          "Tủ điều khiển & Tiếp địa": "",
          "Điện áp ắc quy (V)": "",
          "Kết quả kiểm tra (ĐẠT / K.ĐẠT)": "",
          "Biện pháp xử lý / Kiến nghị": "",
          "Ngày kiểm tra": dateStr,
          "Người kiểm tra": ""
        }));

        if (format === 'xlsx') {
          const ws = XLSX.utils.json_to_sheet(data);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "PhieuKiemTra");
          XLSX.writeFile(wb, `Phieu_Kiem_Tra_Hien_Truong_${dateStr}.xlsx`);
        } else {
          exportCSV(data, `Phieu_Kiem_Tra_Hien_Truong_${dateStr}.csv`);
        }

      } else if (reportType === 'gis') {
        // 4. GIS & Navigation Report
        const data = selectedDevices.map((d, index) => {
          const hasGps = d.latitude != null && d.longitude != null;
          const mapLink = hasGps 
            ? `https://maps.google.com/?q=${d.latitude},${d.longitude}` 
            : d.google_maps_url || '';
          
          return {
            "STT": index + 1,
            "Mã thiết bị": d.device_id || '',
            "Tên thiết bị": d.name || '',
            "Loại": d.device_type === 'RCL' ? 'REC' : d.device_type,
            "Vị trí trụ lắp đặt": d.pole_number || '',
            "Trạm 110kV": d.substation_name || '',
            "Phát tuyến": d.feeder_name || '',
            "Vĩ độ (Latitude)": d.latitude != null ? d.latitude : '',
            "Kinh độ (Longitude)": d.longitude != null ? d.longitude : '',
            "Tình trạng GPS": hasGps ? 'ĐÃ CÓ TỌA ĐỘ' : 'CHƯA CÓ TỌA ĐỘ',
            "Chỉ đường Google Maps": mapLink,
            "Đơn vị quản lý": d.unit || '',
            "Đội QLVH": d.team || ''
          };
        });

        if (format === 'xlsx') {
          const ws = XLSX.utils.json_to_sheet(data);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "ToaDoGIS");
          XLSX.writeFile(wb, `Danh_Sach_Toa_Do_GIS_${dateStr}.xlsx`);
        } else {
          exportCSV(data, `Danh_Sach_Toa_Do_GIS_${dateStr}.csv`);
        }
      }

      setTimeout(() => {
        setExporting(false);
        onClose();
      }, 500);
    } catch (err) {
      console.error('Error exporting report:', err);
      alert('Lỗi khi tạo báo cáo xuất dữ liệu');
      setExporting(false);
    }
  };

  const exportCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const rows = data.map(item =>
      headers.map(h => {
        const val = item[h] !== null && item[h] !== undefined ? String(item[h]) : '';
        return `"${val.replace(/"/g, '""')}"`;
      }).join(',')
    );

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Quick stats of selected items
  const totalCount = selectedDevices.length;
  const closedCount = selectedDevices.filter(d => d.switch_status === 'CLOSED').length;
  const openCount = selectedDevices.filter(d => d.switch_status === 'OPEN').length;
  const scadaCount = selectedDevices.filter(d => d.scada_status === 'SIGNAL').length;
  const gpsCount = selectedDevices.filter(d => d.latitude != null && d.longitude != null).length;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                Xuất Báo cáo Thiết bị Hàng loạt
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-mono font-bold">
                  {totalCount} thiết bị
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tạo các biểu mẫu báo cáo kỹ thuật, hiện trạng vận hành và phiếu kiểm tra.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5 text-xs flex-grow">
          {/* Quick Summary Cards */}
          <div className="grid grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
            <div className="bg-white p-2 rounded-lg border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500">ĐÃ CHỌN</div>
              <div className="text-sm font-extrabold text-blue-700 font-mono">{totalCount}</div>
            </div>
            <div className="bg-white p-2 rounded-lg border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500">ĐANG ĐÓNG</div>
              <div className="text-sm font-extrabold text-emerald-600 font-mono">{closedCount}</div>
            </div>
            <div className="bg-white p-2 rounded-lg border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500">CÓ SCADA</div>
              <div className="text-sm font-extrabold text-blue-600 font-mono">{scadaCount}</div>
            </div>
            <div className="bg-white p-2 rounded-lg border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500">CÓ TỌA ĐỘ</div>
              <div className="text-sm font-extrabold text-purple-600 font-mono">{gpsCount}</div>
            </div>
          </div>

          {/* Report Type Selection */}
          <div className="space-y-2">
            <label className="block font-bold text-slate-800 text-xs">
              Chọn Mẫu Biểu Báo Cáo Cần Xuất:
            </label>

            <div className="space-y-2">
              {/* Option 1 */}
              <label
                onClick={() => setReportType('full')}
                className={`p-3 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                  reportType === 'full'
                    ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="reportType"
                  checked={reportType === 'full'}
                  onChange={() => setReportType('full')}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-grow">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                    Báo cáo Tổng hợp Danh mục & Thông số Kỹ thuật
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Bao gồm 20 trường dữ liệu: Mã TB, vị trí trụ, trạm, phát tuyến, đóng/mở, SCADA, ắc quy, tọa độ GIS, liên kết bản đồ, ghi chú.
                  </p>
                </div>
              </label>

              {/* Option 2 */}
              <label
                onClick={() => setReportType('operation')}
                className={`p-3 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                  reportType === 'operation'
                    ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="reportType"
                  checked={reportType === 'operation'}
                  onChange={() => setReportType('operation')}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-grow">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Radio className="w-4 h-4 text-emerald-600" />
                    Báo cáo Hiện trạng Vận hành & Tín hiệu SCADA
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Chuyên sâu về trạng thái đóng cắt dao, rơ le 79, tín hiệu SCADA phục vụ giao ban điều độ và trực vận hành.
                  </p>
                </div>
              </label>

              {/* Option 3 */}
              <label
                onClick={() => setReportType('inspection')}
                className={`p-3 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                  reportType === 'inspection'
                    ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="reportType"
                  checked={reportType === 'inspection'}
                  onChange={() => setReportType('inspection')}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-grow">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-purple-600" />
                    Phiếu Kiểm tra Kỹ thuật Hiện trường (Inspection Checklist)
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Mẫu phiếu in sẵn danh sách thiết bị kèm các cột tiêu chuẩn kiểm tra má dao, áp lực khí, tủ điều khiển, ắc quy cho kỹ thuật viên.
                  </p>
                </div>
              </label>

              {/* Option 4 */}
              <label
                onClick={() => setReportType('gis')}
                className={`p-3 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                  reportType === 'gis'
                    ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="reportType"
                  checked={reportType === 'gis'}
                  onChange={() => setReportType('gis')}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-grow">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-red-600" />
                    Danh sách Tọa độ GIS & Chỉ đường Google Maps
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tọa độ GPS Lat/Lng và liên kết điều hướng Google Maps trực tiếp phục vụ đội công tác di chuyển hiện trường.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Export Format Selection */}
          <div className="space-y-2 pt-1">
            <label className="block font-bold text-slate-800 text-xs">
              Định dạng tệp xuất:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat('xlsx')}
                className={`py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  format === 'xlsx'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Microsoft Excel (.xlsx)
              </button>
              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  format === 'csv'
                    ? 'bg-slate-800 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <FileText className="w-4 h-4" />
                Tập tin CSV (UTF-8 BOM)
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-slate-500 text-[11px] font-medium">
            Sẵn sàng tải xuống <span className="font-bold text-slate-800">{totalCount} bản ghi</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={exporting}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg font-bold border border-slate-200 transition-colors"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
            >
              {exporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Đang xử lý xuất...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>Tải Xuất Báo Cáo</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
