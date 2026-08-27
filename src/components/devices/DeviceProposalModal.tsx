import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  PlusCircle,
  RefreshCw,
  MapPin,
  Activity,
  Trash2,
  Image as ImageIcon,
  Send,
  Building,
  Zap,
  Camera,
  Upload,
  Compass,
  BatteryCharging,
  Radio
} from 'lucide-react';
import { api } from '../../lib/api';
import { compressImage } from '../../lib/utils';

interface DeviceProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: 'CREATE' | 'UPDATE' | 'LOCATION' | 'STATUS' | 'DELETE' | 'IMAGE';
  device?: any;
  substations?: any[];
  feeders?: any[];
}

export const DeviceProposalModal: React.FC<DeviceProposalModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  mode,
  device,
  substations = [],
  feeders = []
}) => {
  // Form Fields State
  const [formData, setFormData] = useState<any>({
    device_id: device?.device_id || '',
    device_code: device?.device_code || '',
    name: device?.name || '',
    device_type: device?.device_type || 'LBS',
    pole_number: device?.pole_number || '',
    substation_id: device?.substation_id || '',
    feeder_id: device?.feeder_id || '',
    unit: device?.unit || 'Công ty Điện lực Bình Dương',
    team: device?.team || 'ĐỘI VẬN HÀNH LƯỚI ĐIỆN',
    manufacturer: device?.manufacturer || '',
    model: device?.model || '',
    serial_number: device?.serial_number || '',
    manufacture_year: device?.manufacture_year || '',
    commissioning_year: device?.commissioning_year || '',
    voltage_level: device?.voltage_level || '22kV',
    
    // Status & Operations
    status: device?.status || 'ĐANG VẬN HÀNH',
    switch_status: device?.switch_status || 'ĐANG VẬN HÀNH',
    scada_status: device?.scada_status || 'CÓ TÍN HIỆU',
    relay_79: device?.relay_79 || 'ON',
    
    // Battery Status (for LBS & RCL)
    battery_status: device?.battery_status || 'TỐT',
    battery_voltage: device?.battery_voltage || '',
    battery_checked_date: device?.battery_checked_date || '',
    battery_notes: device?.battery_notes || '',

    // Location
    latitude: device?.latitude || '',
    longitude: device?.longitude || '',
    google_maps_url: device?.google_maps_url || '',
    address: device?.address || '',

    // Images
    image_url: '',
    images: device?.images || [],
    caption: '',
    notes: device?.notes || ''
  });

  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [duplicateCheck, setDuplicateCheck] = useState<{
    is_duplicate: boolean;
    warning_message: string;
    matched_devices: any[];
    matched_proposals: any[];
  } | null>(null);
  const [checkingDup, setCheckingDup] = useState(false);
  const [showLocationConfirm, setShowLocationConfirm] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  // Check if device is LBS or RCL
  const isLbsOrRcl = ['LBS', 'RCL', 'REC', 'LBS_SCADA'].includes(formData.device_type);

  // Auto-parse Google Maps URL
  const handleGoogleMapsUrlChange = (url: string) => {
    setFormData((prev: any) => ({ ...prev, google_maps_url: url }));
    if (!url.trim()) return;

    // Try parsing lat/lng from various Google Maps URL formats
    try {
      // Format 1: @lat,lng
      const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (atMatch) {
        setFormData((prev: any) => ({
          ...prev,
          google_maps_url: url,
          latitude: atMatch[1],
          longitude: atMatch[2]
        }));
        return;
      }

      // Format 2: q=lat,lng or ll=lat,lng
      const qMatch = url.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (qMatch) {
        setFormData((prev: any) => ({
          ...prev,
          google_maps_url: url,
          latitude: qMatch[1],
          longitude: qMatch[2]
        }));
        return;
      }

      // Format 3: /place/.../data=...!-?\d+\.\d+!-?\d+\.\d+
      const placeMatch = url.match(/(!3d(-?\d+\.\d+)!4d(-?\d+\.\d+))/);
      if (placeMatch) {
        setFormData((prev: any) => ({
          ...prev,
          google_maps_url: url,
          latitude: placeMatch[2],
          longitude: placeMatch[3]
        }));
        return;
      }
    } catch (e) {
      console.error('Error parsing maps url:', e);
    }
  };

  // Get GPS current location
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Trình duyệt không hỗ trợ định vị GPS!');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        if (formData.latitude && formData.longitude && Number(formData.latitude) !== 0) {
          setPendingLocation({ lat, lng });
          setShowLocationConfirm(true);
        } else {
          setFormData((prev: any) => ({
            ...prev,
            latitude: lat.toString(),
            longitude: lng.toString()
          }));
        }
      },
      (error) => {
        alert('Không thể lấy vị trí GPS: ' + error.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Confirm overwrite location
  const confirmUpdateLocation = () => {
    if (pendingLocation) {
      setFormData((prev: any) => ({
        ...prev,
        latitude: pendingLocation.lat.toString(),
        longitude: pendingLocation.lng.toString()
      }));
    }
    setShowLocationConfirm(false);
    setPendingLocation(null);
  };

  // Debounced duplicate check for CREATE mode
  useEffect(() => {
    if (mode !== 'CREATE') return;

    const timer = setTimeout(() => {
      if (formData.device_id || formData.name || formData.pole_number) {
        checkDuplicate();
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [formData.device_id, formData.name, formData.pole_number, formData.feeder_id]);

  const checkDuplicate = async () => {
    setCheckingDup(true);
    try {
      const res = await api.checkDuplicateDevice({
        device_id: formData.device_id,
        name: formData.name,
        pole_number: formData.pole_number,
        feeder_id: formData.feeder_id || undefined,
        substation_id: formData.substation_id || undefined,
        latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
        longitude: formData.longitude ? parseFloat(formData.longitude) : undefined
      });
      if (res.success) {
        setDuplicateCheck(res);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCheckingDup(false);
    }
  };

  // Handle image compression and selection
  const handleImageSelection = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Validate MIME type
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type)) {
        alert('Định dạng ảnh không hợp lệ. Vui lòng chọn ảnh định dạng JPEG, PNG hoặc WebP.');
        return;
      }

      console.log(`[IMAGE UPLOAD] Original file size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
      
      // Compress image (max 1200px, 0.8 quality) to prevent 413 Payload Too Large
      const compressedDataUrl = await compressImage(file, 1200, 1200, 0.8);
      console.log(`[IMAGE UPLOAD] Compressed successfully. DataURL length: ${compressedDataUrl.length}`);
      
      setFormData({ ...formData, image_url: compressedDataUrl });
    } catch (err: any) {
      console.error('Image compression error:', err);
      // Fallback to regular FileReader if canvas compression fails
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, image_url: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert('Vui lòng nhập lý do/căn cứ đề xuất!');
      return;
    }

    // Validation for lat/lng if provided
    if (formData.latitude !== '') {
      const lat = parseFloat(formData.latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        alert('Latitude phải là số hợp lệ trong khoảng từ -90 đến 90.');
        return;
      }
    }
    if (formData.longitude !== '') {
      const lng = parseFloat(formData.longitude);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        alert('Longitude phải là số hợp lệ trong khoảng từ -180 đến 180.');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await api.createProposal({
        type: mode,
        device_id: device?.id,
        target_device_id_str: formData.device_id || device?.device_id || 'N/A',
        device_name: formData.name || device?.name || 'Thiết bị mới',
        proposed_data: formData,
        reason: reason.trim()
      });

      if (res.success) {
        alert(res.message || 'Gửi đề xuất thành công!');
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      alert(err.message || 'Tạo đề xuất thất bại!');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'CREATE':
        return 'Đề xuất Thêm mới Thiết bị Lưới điện';
      case 'UPDATE':
        return `Đề xuất Cập nhật Thông số Thiết bị (${device?.device_id})`;
      case 'LOCATION':
        return `Đề xuất Cập nhật Vị trí / Tọa độ GPS (${device?.device_id})`;
      case 'STATUS':
        return `Đề xuất Thay đổi Trạng thái Vận hành (${device?.device_id})`;
      case 'DELETE':
        return `Đề xuất Xóa Thiết bị (${device?.device_id})`;
      case 'IMAGE':
        return `Đề xuất Tải ảnh Hiện trường (${device?.device_id})`;
      default:
        return 'Tạo Đề xuất Thay đổi';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto border border-slate-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 sticky top-0 z-10">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase text-blue-600 tracking-wider">
              QUY TRÌNH TRÌNH DUYỆT - NHÂN VIÊN VẬN HÀNH
            </span>
            <h3 className="text-base font-bold text-slate-900 mt-0.5">{getTitle()}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Notice Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              Quy trình phê duyệt tự động:
            </div>
            <p className="text-[11px] leading-relaxed">
              Dữ liệu đề xuất sẽ được gửi đến cấp Quản lý (Trưởng ca / Cán bộ phương thức). Dữ liệu chính thức trên bản đồ & danh mục lưới điện <strong>CHỈ ĐƯỢC CẬP NHẬT SAU KHI ĐƯỢC PHÊ DUYỆT</strong>.
            </p>
          </div>

          {/* Duplicate Detection Warning */}
          {mode === 'CREATE' && duplicateCheck?.is_duplicate && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-800 space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-red-900">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                {duplicateCheck.warning_message}
              </div>
              <ul className="list-disc list-inside text-[11px] space-y-0.5 font-medium">
                {duplicateCheck.matched_devices.map((d: any, idx: number) => (
                  <li key={idx}>
                    Trùng thiết bị chính thức: <strong>{d.name}</strong> ({d.device_id}) - {d.match_type}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* CREATE & UPDATE MODE */}
          {(mode === 'CREATE' || mode === 'UPDATE') && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                  <Zap className="w-4 h-4 text-blue-600" />
                  1. Thông tin cơ bản thiết bị
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Mã thiết bị (DEVICE_ID) *</label>
                    <input
                      type="text"
                      required
                      placeholder="VD: LBS-471-01"
                      value={formData.device_id}
                      onChange={(e) => setFormData({ ...formData, device_id: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Tên thiết bị *</label>
                    <input
                      type="text"
                      required
                      placeholder="VD: LBS Phân đoạn đường dây 22kV"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Loại thiết bị *</label>
                    <select
                      value={formData.device_type}
                      onChange={(e) => setFormData({ ...formData, device_type: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="LBS">LBS (Dao cắt phụ tải)</option>
                      <option value="RCL">RCL (Recloser - Máy cắt lặp lại)</option>
                      <option value="DS">DS (Dao cách ly)</option>
                      <option value="RMU">Tủ RMU</option>
                      <option value="SUBSTATION_110KV">Trạm 110kV</option>
                      <option value="OTHER">Thiết bị khác</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Vị trí trụ lắp đặt</label>
                    <input
                      type="text"
                      placeholder="VD: Trụ 45/2"
                      value={formData.pole_number}
                      onChange={(e) => setFormData({ ...formData, pole_number: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Mức điện áp</label>
                    <select
                      value={formData.voltage_level}
                      onChange={(e) => setFormData({ ...formData, voltage_level: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white"
                    >
                      <option value="22kV">22kV</option>
                      <option value="35kV">35kV</option>
                      <option value="110kV">110kV</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Trạm 110kV (Nguồn)</label>
                    <select
                      value={formData.substation_id}
                      onChange={(e) => setFormData({ ...formData, substation_id: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white"
                    >
                      <option value="">-- Chọn Trạm 110kV --</option>
                      {substations.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.substation_code})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Phát tuyến</label>
                    <select
                      value={formData.feeder_id}
                      onChange={(e) => setFormData({ ...formData, feeder_id: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white"
                    >
                      <option value="">-- Chọn Phát tuyến --</option>
                      {feeders
                        .filter((f) => !formData.substation_id || f.substation_id === Number(formData.substation_id))
                        .map((f) => (
                          <option key={f.id} value={f.id}>{f.feeder_code} - {f.name}</option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Đội quản lý trực tiếp</label>
                    <input
                      type="text"
                      value={formData.team}
                      onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-slate-100"
                    />
                  </div>
                </div>
              </div>

              {/* TECHNICAL SPECS */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  2. Thông số kỹ thuật & Thiết bị
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Hãng sản xuất</label>
                    <input
                      type="text"
                      placeholder="VD: Schneider / ABB"
                      value={formData.manufacturer}
                      onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Model</label>
                    <input
                      type="text"
                      placeholder="VD: ADVC / RL-38"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Serial Number</label>
                    <input
                      type="text"
                      placeholder="VD: SN-998231"
                      value={formData.serial_number}
                      onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Năm sản xuất / Vận hành</label>
                    <input
                      type="text"
                      placeholder="2024 / 2025"
                      value={formData.manufacture_year}
                      onChange={(e) => setFormData({ ...formData, manufacture_year: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DEVICE STATUS */}
          {(mode === 'CREATE' || mode === 'UPDATE' || mode === 'STATUS') && (
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                <CheckCircle2 className="w-4 h-4 text-purple-600" />
                3. Trạng thái vận hành thiết bị
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Trạng thái thiết bị *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white font-bold"
                  >
                    <option value="ĐANG VẬN HÀNH">🟢 ĐANG VẬN HÀNH</option>
                    <option value="ĐANG CẮT">🟠 ĐANG CẮT</option>
                    <option value="DỰ PHÒNG">🔵 DỰ PHÒNG</option>
                    <option value="HỎNG">🔴 HỎNG</option>
                    <option value="ĐANG BẢO TRÌ">🟡 ĐANG BẢO TRÌ</option>
                    <option value="NGỪNG VẬN HÀNH">⚫ NGỪNG VẬN HÀNH</option>
                    <option value="CHƯA ĐƯA VÀO VẬN HÀNH">⚪ CHƯA ĐƯA VÀO VẬN HÀNH</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* SPECIALIZED LBS & RCL GROUPS (SCADA, RELAY 79, BATTERY) */}
          {isLbsOrRcl && (mode === 'CREATE' || mode === 'UPDATE' || mode === 'STATUS') && (
            <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-200 space-y-3">
              <h4 className="font-bold text-blue-900 flex items-center gap-1.5 border-b border-blue-200 pb-2">
                <Radio className="w-4 h-4 text-blue-600" />
                4. Thông tin Vận hành Chuyên biệt (Riêng cho LBS & RCL)
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* SCADA */}
                <div className="bg-white p-2.5 rounded-lg border border-blue-100 shadow-sm space-y-1.5">
                  <label className="block font-bold text-slate-800 text-[11px]">Trạng thái SCADA (Chỉ hiển thị)</label>
                  <select
                    value={formData.scada_status}
                    onChange={(e) => setFormData({ ...formData, scada_status: e.target.value })}
                    className="w-full border border-slate-300 rounded p-1.5 text-xs bg-slate-50 font-bold"
                  >
                    <option value="CÓ TÍN HIỆU">CÓ TÍN HIỆU</option>
                    <option value="KHÔNG CÓ TÍN HIỆU">KHÔNG CÓ TÍN HIỆU</option>
                    <option value="CHƯA XÁC ĐỊNH">CHƯA XÁC ĐỊNH</option>
                  </select>
                  <p className="text-[10px] text-slate-500 italic">* Không có nút điều khiển đóng/cắt từ xa.</p>
                </div>

                {/* RELAY 79 */}
                <div className="bg-white p-2.5 rounded-lg border border-blue-100 shadow-sm space-y-1.5">
                  <label className="block font-bold text-slate-800 text-[11px]">Trạng thái Rơ le 79</label>
                  <select
                    value={formData.relay_79}
                    onChange={(e) => setFormData({ ...formData, relay_79: e.target.value })}
                    className="w-full border border-slate-300 rounded p-1.5 text-xs bg-slate-50 font-bold"
                  >
                    <option value="ON">ON</option>
                    <option value="OFF">OFF</option>
                    <option value="CHƯA XÁC ĐỊNH">CHƯA XÁC ĐỊNH</option>
                  </select>
                </div>

                {/* BATTERY */}
                <div className="bg-white p-2.5 rounded-lg border border-blue-100 shadow-sm space-y-1.5">
                  <label className="block font-bold text-slate-800 text-[11px]">Trạng thái Ắc quy nguồn</label>
                  <select
                    value={formData.battery_status}
                    onChange={(e) => setFormData({ ...formData, battery_status: e.target.value })}
                    className="w-full border border-slate-300 rounded p-1.5 text-xs bg-slate-50 font-bold"
                  >
                    <option value="TỐT">TỐT</option>
                    <option value="YẾU">YẾU</option>
                    <option value="HỎNG">HỎNG</option>
                    <option value="ĐANG THAY">ĐANG THAY</option>
                    <option value="CHƯA KIỂM TRA">CHƯA KIỂM TRA</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Điện áp / Ghi chú ắc quy..."
                    value={formData.battery_notes}
                    onChange={(e) => setFormData({ ...formData, battery_notes: e.target.value })}
                    className="w-full border border-slate-300 rounded p-1 text-[11px] mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* LOCATION & GPS & GOOGLE MAP URL */}
          {(mode === 'CREATE' || mode === 'LOCATION' || mode === 'UPDATE') && (
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                <MapPin className="w-4 h-4 text-red-600" />
                5. Vị trí thiết bị & Tọa độ GPS
              </h4>

              <div className="space-y-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Dán link Google Maps (Tự động bóc tách tọa độ)</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://maps.google.com/?q=21.0285,105.8542 hoặc dán link chia sẻ vị trí..."
                      value={formData.google_maps_url}
                      onChange={(e) => handleGoogleMapsUrlChange(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="grid grid-cols-2 gap-3 flex-1">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Latitude (Vĩ độ)</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="21.0285"
                        value={formData.latitude}
                        onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Longitude (Kinh độ)</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="105.8542"
                        value={formData.longitude}
                        onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="pt-5">
                    <button
                      type="button"
                      onClick={handleGetCurrentLocation}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm flex items-center gap-1.5 whitespace-nowrap transition"
                    >
                      <Compass className="w-4 h-4" />
                      Lấy GPS Hiện tại
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* IMAGES & CAMERA CAPTURE */}
          {(mode === 'CREATE' || mode === 'IMAGE' || mode === 'UPDATE') && (
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                <ImageIcon className="w-4 h-4 text-indigo-600" />
                6. Hình ảnh hiện trường
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Đường dẫn ảnh / URL</label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>

                <div className="flex items-end gap-2">
                  <label className="flex-1 cursor-pointer bg-white border border-slate-300 hover:bg-slate-100 rounded-lg p-2 text-center text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 transition">
                    <Upload className="w-4 h-4 text-blue-600" />
                    Chọn ảnh từ thiết bị
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      className="hidden"
                      onChange={handleImageSelection}
                    />
                  </label>

                  <label className="flex-1 cursor-pointer bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg p-2 text-center text-xs font-bold text-blue-700 flex items-center justify-center gap-1.5 transition">
                    <Camera className="w-4 h-4 text-blue-600" />
                    Chụp ảnh trực tiếp
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      capture="environment"
                      className="hidden"
                      onChange={handleImageSelection}
                    />
                  </label>
                </div>
              </div>

              {formData.image_url && (
                <div className="mt-2 relative w-full h-36 bg-slate-200 rounded-lg overflow-hidden border border-slate-300">
                  <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
                  <span className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded">
                    Xem trước ảnh hiện trường
                  </span>
                </div>
              )}
            </div>
          )}

          {/* REASON */}
          <div className="pt-2 border-t border-slate-200">
            <label className="block font-bold text-slate-800 mb-1">Lý do & Căn cứ đề xuất *</label>
            <textarea
              rows={3}
              required
              placeholder="Nhập chi tiết căn cứ thực tế, kết quả khảo sát hiện trường..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading || (mode === 'CREATE' && duplicateCheck?.is_duplicate)}
              className={`px-5 py-2 font-bold rounded-lg shadow-sm text-white flex items-center gap-1.5 transition ${
                mode === 'CREATE' && duplicateCheck?.is_duplicate
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Send className="w-4 h-4" />
              {loading ? 'Đang gửi...' : 'Gửi Đề xuất cho Quản lý'}
            </button>
          </div>
        </form>
      </div>

      {/* Location Overwrite Confirmation Modal */}
      {showLocationConfirm && (
        <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 space-y-4 text-xs">
            <h4 className="font-bold text-slate-900 text-sm">Xác nhận cập nhật tọa độ GPS</h4>
            <p className="text-slate-600">
              Thiết bị đã có sẵn vị trí tọa độ trước đó. Bạn có chắc chắn muốn cập nhật vị trí mới từ GPS hiện tại không?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLocationConfirm(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={confirmUpdateLocation}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg"
              >
                Cập nhật vị trí mới
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
