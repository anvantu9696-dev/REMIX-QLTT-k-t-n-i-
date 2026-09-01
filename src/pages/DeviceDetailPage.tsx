import React, { useState, useEffect } from 'react';
import {
  Zap,
  ArrowLeft,
  MapPin,
  ExternalLink,
  Camera,
  History,
  Activity,
  FileText,
  Building2,
  GitCommitHorizontal,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Radio,
  Clock,
  ShieldAlert,
  X,
  Upload,
  Check,
  QrCode,
  Share2
} from 'lucide-react';
import { api } from '../lib/api';
import { Device, DeviceImage, DeviceLocation, DeviceStatusHistory } from '../types';
import { useAuth } from '../context/AuthContext';
import { DeviceProposalModal } from '../components/devices/DeviceProposalModal';
import { ImageViewerModal } from '../components/devices/ImageViewerModal';
import { GeoCameraCaptureModal } from '../components/devices/GeoCameraCaptureModal';
import { ZaloQRShareModal } from '../components/devices/ZaloQRShareModal';
import { formatDateTime, formatRelativeTime } from '../utils/dateTime';

interface DeviceDetailPageProps {
  deviceId: number | string;
  onBack: () => void;
}

export const DeviceDetailPage: React.FC<DeviceDetailPageProps> = ({ deviceId, onBack }) => {
  const { isGuest, hasRole } = useAuth();
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState<'info' | 'location' | 'images' | 'status' | 'audit' | 'future'>('info');

  // Proposal Modal State
  const [proposalModalOpen, setProposalModalOpen] = useState(false);
  const [proposalMode, setProposalMode] = useState<'CREATE' | 'UPDATE' | 'LOCATION' | 'STATUS' | 'DELETE' | 'IMAGE'>('UPDATE');

  // Add Image Modal
  const [addImageModal, setAddImageModal] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageCaption, setImageCaption] = useState('');

  // Image Viewer Lightbox State
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [geoCameraModalOpen, setGeoCameraModalOpen] = useState(false);
  const [zaloQRModalOpen, setZaloQRModalOpen] = useState(false);

  const allImages = React.useMemo(() => {
    const list: { url: string; caption?: string }[] = [];
    if (device?.primary_image) {
      list.push({ url: device.primary_image, caption: `Ảnh đại diện - ${device.name}` });
    }
    if (device?.images && device.images.length > 0) {
      device.images.forEach(img => {
        if (!device.primary_image || img.image_url !== device.primary_image) {
          list.push({ url: img.image_url, caption: img.caption || 'Hình ảnh hiện trường' });
        }
      });
    }
    return list;
  }, [device]);

  useEffect(() => {
    fetchDeviceDetail();
  }, [deviceId]);

  const fetchDeviceDetail = async () => {
    setLoading(true);
    try {
      const res = await api.getDevice(deviceId);
      if (res.success) {
        setDevice(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tải chi tiết thiết bị');
    } finally {
      setLoading(false);
    }
  };

  const handleAddImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl.trim()) return;

    try {
      await api.addDeviceImage(deviceId, {
        image_url: imageUrl,
        caption: imageCaption
      });
      setSuccess('Đã thêm hình ảnh thiết bị thành công');
      setImageUrl('');
      setImageCaption('');
      setAddImageModal(false);
      fetchDeviceDetail();
    } catch (err: any) {
      setError(err.message || 'Không thể tải lên ảnh');
    }
  };

  const handleDeleteImage = async (imageId: number) => {
    if (isGuest()) return;
    if (!window.confirm('Xác nhận xóa hình ảnh này khỏi thư viện thiết bị?')) return;

    try {
      await api.deleteDeviceImage(deviceId, imageId);
      setSuccess('Đã xóa hình ảnh thiết bị');
      fetchDeviceDetail();
    } catch (err: any) {
      setError(err.message || 'Không thể xóa hình ảnh');
    }
  };

  const handleSetPrimaryImage = async (imageId: number) => {
    if (isGuest()) return;
    try {
      await api.setPrimaryDeviceImage(deviceId, imageId);
      setSuccess('Đã đặt làm hình ảnh đại diện chính');
      fetchDeviceDetail();
    } catch (err: any) {
      setError(err.message || 'Không thể cập nhật ảnh đại diện');
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex justify-center text-slate-500 text-xs font-semibold">
        <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mr-2" />
        Đang tải thông tin thiết bị...
      </div>
    );
  }

  if (!device) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 space-y-4">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
        <p className="text-sm font-bold text-slate-800">Không tìm thấy dữ liệu thiết bị (ID: {deviceId})</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"
        >
          Trở về Danh sách
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại Danh sách Thiết bị</span>
        </button>

        <div className="flex items-center gap-2">
          {!isGuest() && (
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => { setProposalMode('UPDATE'); setProposalModalOpen(true); }}
                className="px-2.5 py-1.5 bg-white text-slate-800 hover:bg-slate-50 border border-slate-300 rounded font-bold text-xs shadow-sm transition"
                title="Gửi đề xuất sửa thông tin thiết bị"
              >
                Đề xuất Sửa
              </button>
              <button
                onClick={() => { setProposalMode('STATUS'); setProposalModalOpen(true); }}
                className="px-2.5 py-1.5 bg-purple-600 text-white hover:bg-purple-700 rounded font-bold text-xs shadow-sm transition"
                title="Gửi đề xuất thay đổi trạng thái vận hành"
              >
                Đổi Trạng Thái
              </button>
              <button
                onClick={() => { setProposalMode('LOCATION'); setProposalModalOpen(true); }}
                className="px-2.5 py-1.5 bg-amber-600 text-white hover:bg-amber-700 rounded font-bold text-xs shadow-sm transition"
                title="Gửi đề xuất cập nhật tọa độ GPS"
              >
                Cập nhật Vị trí GPS
              </button>
              <button
                onClick={() => setGeoCameraModalOpen(true)}
                className="px-2.5 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded font-bold text-xs shadow-sm transition flex items-center gap-1"
                title="Chụp ảnh trực tiếp có hiển thị tọa độ GPS"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Chụp Ảnh GPS</span>
              </button>
              <button
                onClick={() => { setProposalMode('IMAGE'); setProposalModalOpen(true); }}
                className="px-2.5 py-1.5 bg-cyan-600 text-white hover:bg-cyan-700 rounded font-bold text-xs shadow-sm transition"
                title="Tải ảnh hiện trường gửi trình duyệt"
              >
                Tải Ảnh Hiện Trường
              </button>
              <button
                onClick={() => { setProposalMode('DELETE'); setProposalModalOpen(true); }}
                className="px-2.5 py-1.5 bg-red-600 text-white hover:bg-red-700 rounded font-bold text-xs shadow-sm transition"
                title="Gửi đề xuất xóa thiết bị"
              >
                Đề xuất Xóa
              </button>
            </div>
          )}

          <button
            onClick={() => setZaloQRModalOpen(true)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-sm transition flex items-center gap-1.5"
            title="Chia sẻ thông tin qua Zalo và tạo mã QR"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Chia sẻ Zalo & QR</span>
          </button>

          <div className="flex items-center gap-2 font-mono text-xs font-bold pl-2 border-l border-slate-200">
            <span className="text-slate-400">DEVICE_ID:</span>
            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded">
              {device.device_id}
            </span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-emerald-800 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="text-emerald-600 font-bold">✕</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-red-800 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-red-600 font-bold">✕</button>
        </div>
      )}

      {/* Device Summary Card */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-0.5 rounded font-mono text-[10px] font-extrabold uppercase ${
                (device.device_type === 'RCL' || device.device_type === 'REC') ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                device.device_type === 'LBS' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                'bg-slate-800 text-slate-300'
              }`}>
                {device.device_type === 'RCL' ? 'REC' : device.device_type}
              </span>
              <span className="text-xs text-slate-400 font-mono">Vị trí trụ: <strong className="text-white">{device.pole_number || 'N/A'}</strong></span>
            </div>

            <h1 className="text-2xl font-black text-white tracking-tight">{device.name}</h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-400" />
                <span>{device.substation_name || 'Trạm 110kV'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <GitCommitHorizontal className="w-4 h-4 text-blue-400" />
                <span>{device.feeder_name || 'Phát tuyến'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>{device.latitude && device.longitude ? `${device.latitude}, ${device.longitude}` : 'Chưa có GIS'}</span>
              </div>
            </div>
          </div>

          {/* Operational Status Indicators Box */}
          <div className="bg-slate-800/80 backdrop-blur-md p-4 rounded-xl border border-slate-700/80 space-y-3 shrink-0 w-full md:w-64">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Trạng thái đ.cắt:</span>
              <span className={`font-black text-xs px-2 py-0.5 rounded ${
                device.switch_status === 'CLOSED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                device.switch_status === 'OPEN' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-700 text-slate-300'
              }`}>
                {device.switch_status === 'CLOSED' ? 'ĐANG ĐÓNG' : device.switch_status === 'OPEN' ? 'ĐANG MỞ' : 'KHÔNG RÕ'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">SCADA Tín hiệu:</span>
              <span className={`font-mono font-bold text-[11px] flex items-center gap-1 ${
                device.scada_status === 'SIGNAL' ? 'text-blue-400' : 'text-amber-400'
              }`}>
                <Radio className="w-3 h-3 animate-pulse" />
                {device.scada_status === 'SIGNAL' ? 'KẾT NỐI OK' : 'MẤT KẾT NỐI'}
              </span>
            </div>

            <div className="text-[10px] text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800 text-center font-medium">
              * Hệ thống SCADA chỉ hiển thị trạng thái, KHÔNG tích hợp điều khiển xa.
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-2 flex overflow-x-auto gap-1">
        {[
          { id: 'info', label: 'THÔNG TIN CHUNG', icon: <FileText className="w-4 h-4" /> },
          { id: 'location', label: 'VỊ TRÍ & GIS', icon: <MapPin className="w-4 h-4" /> },
          { id: 'images', label: `HÌNH ẢNH (${device.images?.length || 0})`, icon: <Camera className="w-4 h-4" /> },
          { id: 'status', label: 'TRẠNG THÁI & SCADA', icon: <Activity className="w-4 h-4" /> },
          { id: 'audit', label: 'LỊCH SỬ AUDIT', icon: <History className="w-4 h-4" /> },
          { id: 'future', label: 'GIAI ĐOẠN SAU', icon: <Clock className="w-4 h-4" /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB CONTENT: THÔNG TIN CHUNG */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">Thông tin Quản lý Lưới</h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Mã DEVICE_ID (Unique):</span>
                <span className="font-mono font-bold text-blue-600">{device.device_id}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Tên Thiết Bị:</span>
                <span className="font-bold text-slate-900">{device.name}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Loại Thiết Bị:</span>
                <span className="font-bold text-slate-800">{device.device_type}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Vị trí trụ lắp đặt:</span>
                <span className="font-bold text-slate-800">{device.pole_number || 'Chưa cập nhật'}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Trạm Biến áp 110kV:</span>
                <span className="font-bold text-slate-900">{device.substation_name || 'N/A'}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Phát Tuyến Đường Dây:</span>
                <span className="font-bold text-slate-900">{device.feeder_name || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">Đơn vị & Vận hành</h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Đơn vị Quản lý:</span>
                <span className="font-bold text-slate-900">{device.unit}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Đội / Phân xưởng:</span>
                <span className="font-bold text-slate-900">{device.team}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Trạng thái Thiết bị:</span>
                <span className="font-bold text-emerald-600 uppercase">{device.status}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Tự động đóng lại 79:</span>
                <span className="font-bold text-slate-900">{device.relay_79}</span>
              </div>

              <div className="pt-2">
                <span className="text-slate-500 font-medium block mb-1">Ghi chú kỹ thuật:</span>
                <p className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-slate-700 italic">
                  "{device.notes || 'Không có ghi chú thêm.'}"
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: VỊ TRÍ & GIS */}
      {activeTab === 'location' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                Tọa độ Không gian Vị trí Hiện tại
              </h3>

              <div className="flex items-center gap-2">
                {device.google_maps_url && (
                  <a
                    href={device.google_maps_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 inline-flex items-center gap-1"
                  >
                    [ MỞ BẢN ĐỒ GOOGLE MAPS ] <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  onClick={() => {
                    if (device.latitude != null && device.longitude != null && !isNaN(Number(device.latitude)) && !isNaN(Number(device.longitude))) {
                      const lat = Number(device.latitude);
                      const lng = Number(device.longitude);
                      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
                        return;
                      }
                    }
                    if (device.google_maps_url && typeof device.google_maps_url === 'string' && device.google_maps_url.trim().length > 0) {
                      const gUrl = device.google_maps_url.trim();
                      if (gUrl.startsWith('http://') || gUrl.startsWith('https://')) {
                        window.open(gUrl, '_blank');
                        return;
                      } else {
                        alert('Liên kết Google Maps của thiết bị không hợp lệ.');
                        return;
                      }
                    }
                    alert('Thiết bị chưa được cập nhật vị trí.');
                  }}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 inline-flex items-center gap-1 shadow-sm"
                >
                  🧭 CHỈ ĐƯỜNG
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Latitude (Vĩ độ)</span>
                <span className="text-lg font-mono font-bold text-slate-900">{device.latitude || 'Chưa có'}</span>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Longitude (Kinh độ)</span>
                <span className="text-lg font-mono font-bold text-slate-900">{device.longitude || 'Chưa có'}</span>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Vị trí trụ lắp đặt</span>
                <span className="text-lg font-bold text-slate-900">{device.pole_number || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Location History Log Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-800">
              Nhật ký Lịch sử Thay đổi Vị trí Tọa độ
            </div>
            {device.location_history && device.location_history.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold">
                    <th className="p-3">Thời Gian</th>
                    <th className="p-3">Latitude / Longitude</th>
                    <th className="p-3">Ghi Chú</th>
                    <th className="p-3">Cập Nhật Bởi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {device.location_history.map(loc => (
                    <tr key={loc.id}>
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-mono text-xs font-semibold text-slate-800">
                          {formatDateTime(loc.created_at)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{formatRelativeTime(loc.created_at)}</span>
                        </div>
                      </td>
                      <td className="p-3 font-mono font-bold text-blue-600">
                        {loc.latitude}, {loc.longitude}
                      </td>
                      <td className="p-3 text-slate-700">{loc.note || 'Thay đổi tọa độ'}</td>
                      <td className="p-3 font-semibold text-slate-800">{loc.updated_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs font-semibold">
                Chưa có ghi nhận thay đổi vị trí lịch sử nào.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: HÌNH ẢNH */}
      {activeTab === 'images' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-600" />
              Thư viện Hình ảnh Thực tế
            </h3>

            {!isGuest() && (
              <button
                onClick={() => setAddImageModal(true)}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Tải lên Ảnh Thiết bị
              </button>
            )}
          </div>

          {/* Primary Avatar Image Preview */}
          {(!device.images || device.images.length === 0) && !device.primary_image ? (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3 shadow-sm">
              <Camera className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">Chưa có hình ảnh thiết bị.</p>
              <p className="text-xs text-slate-400">Thiết bị này chưa có ảnh đại diện hoặc thư viện ảnh hiện trường.</p>
            </div>
          ) : (
            <>
              {device.primary_image && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4 shadow-sm">
                  <span className="text-xs font-bold text-slate-700 block">Ảnh Đại Diện Chính (Nhấp để phóng to):</span>
                  <div 
                    onClick={() => {
                      setViewerIndex(0);
                      setViewerOpen(true);
                    }}
                    className="w-full max-w-xl h-64 bg-slate-900 rounded-xl overflow-hidden relative cursor-pointer group shadow"
                  >
                    <img
                      src={device.primary_image}
                      alt={device.name}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="bg-slate-900/80 text-white text-xs font-bold px-3 py-1.5 rounded-lg backdrop-blur">
                        🔍 Nhấp để xem lớn
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded text-white text-xs font-bold">
                      Ảnh Đại Diện Chính
                    </div>
                  </div>
                </div>
              )}

              {/* Gallery Grid */}
              {device.images && device.images.length > 0 && (
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-700 block">Thư Viện Ảnh Hiện Trường ({device.images.length}):</span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {device.images.map((img, idx) => {
                      // Calculate global index in allImages
                      const globalIdx = device.primary_image ? idx + 1 : idx;
                      return (
                        <div key={img.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden group shadow-sm flex flex-col">
                          <div 
                            onClick={() => {
                              setViewerIndex(globalIdx < allImages.length ? globalIdx : 0);
                              setViewerOpen(true);
                            }}
                            className="h-40 bg-slate-800 relative cursor-pointer overflow-hidden"
                          >
                            <img 
                              src={img.image_url} 
                              alt={img.caption || device.name} 
                              onError={(e) => {
                                const target = e.target as HTMLElement;
                                target.style.display = 'none';
                              }}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" 
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="bg-slate-900/80 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg backdrop-blur shadow">
                                Phóng to
                              </span>
                            </div>
                            {Boolean(img.is_primary) && (
                              <span className="absolute top-2 left-2 bg-emerald-600 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow">
                                Ảnh Đại Diện
                              </span>
                            )}
                          </div>
                          <div className="p-3 text-xs space-y-2 flex-grow flex flex-col justify-between">
                            <div>
                              <p className="text-slate-600 font-medium truncate">{img.caption || 'Hình ảnh hiện trường'}</p>
                              <p className="text-[10px] text-slate-400 font-mono">
                                {formatDateTime(img.created_at, false)}
                              </p>
                            </div>

                            {!isGuest() && (
                              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                {!Boolean(img.is_primary) && (
                                  <button
                                    onClick={() => handleSetPrimaryImage(img.id)}
                                    className="text-[10px] text-blue-600 font-bold hover:underline"
                                  >
                                    Đặt đại diện
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteImage(img.id)}
                                  className="text-red-500 hover:text-red-700 p-1"
                                  title="Xóa ảnh"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ImageViewerModal Lightbox */}
          <ImageViewerModal
            isOpen={viewerOpen}
            onClose={() => setViewerOpen(false)}
            images={allImages}
            initialIndex={viewerIndex}
            title={`Thiết bị: ${device.name} (${device.device_id})`}
          />

          {/* Add Image Modal */}
          {addImageModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-sm text-slate-900">Thêm Hình Ảnh Thiết Bị</h3>
                  <button onClick={() => setAddImageModal(false)} className="text-slate-400 hover:text-slate-700">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleAddImage} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Đường dẫn URL Hình ảnh *</label>
                    <input
                      type="url"
                      required
                      placeholder="https://..."
                      value={imageUrl}
                      onChange={e => setImageUrl(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Chú thích ảnh</label>
                    <input
                      type="text"
                      placeholder="VD: Mặt tiền tủ Recloser sau kiểm tra..."
                      value={imageCaption}
                      onChange={e => setImageCaption(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="pt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setAddImageModal(false)}
                      className="px-3 py-1.5 border border-slate-200 rounded font-bold text-slate-600"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-blue-600 text-white font-bold rounded hover:bg-blue-700"
                    >
                      Tải Lên
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: TRẠNG THÁI & SCADA */}
      {activeTab === 'status' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-900 text-xs font-semibold">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
              <span>
                <strong>Quy định An toàn SCADA:</strong> Phân hệ này CHỈ phục vụ theo dõi, hiển thị trạng thái và thu thập dữ liệu tự động. KHÔNG tích hợp chức năng phát lệnh điều khiển từ xa để tránh thao tác nhầm.
              </span>
            </div>

            <h3 className="font-bold text-slate-900 text-sm">Trạng thái Thiết bị Hiện tại</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Trạng thái Thiết bị</span>
                <span className={`text-sm font-black ${
                  device.switch_status === 'CLOSED' ? 'text-emerald-600' :
                  device.switch_status === 'OPEN' ? 'text-red-600' : 'text-slate-600'
                }`}>
                  {device.switch_status === 'CLOSED' ? 'ĐANG ĐÓNG' : device.switch_status === 'OPEN' ? 'ĐANG MỞ' : 'CHƯA XÁC ĐỊNH'}
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">SCADA (Chỉ Hiển Thị)</span>
                <span className={`text-sm font-bold ${
                  device.scada_status === 'SIGNAL' ? 'text-blue-600' :
                  device.scada_status === 'NO_SIGNAL' ? 'text-amber-600' : 'text-slate-600'
                }`}>
                  {device.scada_status === 'SIGNAL' ? 'CÓ TÍN HIỆU' : device.scada_status === 'NO_SIGNAL' ? 'KHÔNG CÓ TÍN HIỆU' : 'CHƯA XÁC ĐỊNH'}
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Dòng chỉnh định</span>
                <span className="text-sm font-bold text-slate-900">
                  {device.current_setting || 'N/A'}
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Rơ le Tự đóng lại 79</span>
                <span className="text-sm font-bold text-slate-900">
                  {device.relay_79 === 'ON' ? 'ON' : device.relay_79 === 'OFF' ? 'OFF' : 'CHƯA XÁC ĐỊNH'}
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Ắc quy (LBS/REC)</span>
                <span className={`text-sm font-black ${
                  device.battery_status === 'GOOD' ? 'text-emerald-600' :
                  device.battery_status === 'WEAK' ? 'text-amber-600' :
                  device.battery_status === 'BROKEN' ? 'text-red-600' :
                  device.battery_status === 'REPLACING' ? 'text-blue-600' : 'text-slate-600'
                }`}>
                  {device.battery_status === 'GOOD' ? 'TỐT' :
                   device.battery_status === 'WEAK' ? 'YẾU' :
                   device.battery_status === 'BROKEN' ? 'HỎNG' :
                   device.battery_status === 'REPLACING' ? 'ĐANG THAY' : 'CHƯA KIỂM TRA'}
                </span>
              </div>
            </div>
          </div>

          {/* Status Change History Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-800">
              Nhật ký Lịch sử Đóng / Cắt & Tín hiệu SCADA
            </div>
            {device.status_history && device.status_history.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold">
                    <th className="p-3">Thời Gian</th>
                    <th className="p-3">Trạng Thái Đóng/Cắt</th>
                    <th className="p-3">Tín Hiệu SCADA</th>
                    <th className="p-3">Ghi Chú</th>
                    <th className="p-3">Cập Nhật Bởi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {device.status_history.map(sh => (
                    <tr key={sh.id}>
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-mono text-xs font-semibold text-slate-800">
                          {formatDateTime(sh.created_at)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{formatRelativeTime(sh.created_at)}</span>
                        </div>
                      </td>
                      <td className="p-3 font-bold">
                        <span className="text-slate-400">{sh.old_switch_status}</span> → <span className="text-blue-600">{sh.new_switch_status}</span>
                      </td>
                      <td className="p-3 font-mono">
                        {sh.old_scada_status} → {sh.new_scada_status}
                      </td>
                      <td className="p-3 text-slate-700">{sh.note || 'Cập nhật trạng thái'}</td>
                      <td className="p-3 font-semibold text-slate-800">{sh.updated_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs font-semibold">
                Chưa có nhật ký thay đổi trạng thái nào.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: AUDIT LOG */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-800 flex items-center gap-2">
            <History className="w-4 h-4 text-blue-600" />
            Lịch sử Thao tác & Audit Log Chi tiết Thiết bị
          </div>
          {device.audit_logs && device.audit_logs.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-900 text-slate-300 uppercase text-[10px] font-bold">
                  <th className="p-3">Thời Gian</th>
                  <th className="p-3">Người Thao Tác</th>
                  <th className="p-3">Hành Động</th>
                  <th className="p-3">Nội Dung Thao Tác</th>
                  <th className="p-3">Kết Quả</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {device.audit_logs.map(log => (
                  <tr key={log.id}>
                    <td className="p-3 whitespace-nowrap">
                      <div className="font-mono text-xs font-semibold text-slate-800">
                        {formatDateTime(log.created_at)}
                      </div>
                      <div className="text-[10px] text-blue-600 font-medium flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{formatRelativeTime(log.created_at)}</span>
                      </div>
                    </td>
                    <td className="p-3 font-bold text-slate-900">
                      {log.user_fullname} ({log.username})
                    </td>
                    <td className="p-3 font-bold text-blue-600">{log.action}</td>
                    <td className="p-3 text-slate-700">{log.details}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                        {log.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs font-semibold">
              Chưa có dữ liệu audit log liên quan tới thiết bị này.
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: GIAI ĐOẠN SAU (MOCK TABS) */}
      {activeTab === 'future' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { title: 'CHECKLIST KIỂM TRA', desc: 'Danh sách tiêu chuẩn kiểm tra an toàn định kỳ thiết bị.' },
            { title: 'QUẢN LÝ CÔNG VIỆC', desc: 'Lịch sử phiếu công việc, phiếu thao tác liên quan.' },
            { title: 'BẤT THƯỜNG & KHIẾM KHUYẾT', desc: 'Theo dõi sự cố, tồn tại điểm nóng kỹ thuật.' },
            { title: 'KHÉP VÒNG BẢO VỆ', desc: 'Phương án chuyển tải, khép vòng tự động mạch vòng.' }
          ].map((f, idx) => (
            <div key={idx} className="bg-white p-5 rounded-xl border border-slate-200 space-y-2 opacity-80 hover:opacity-100 transition-opacity">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-xs">{f.title}</h4>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-bold rounded">
                  Giai đoạn tiếp theo
                </span>
              </div>
              <p className="text-xs text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* Device Proposal Modal */}
      <DeviceProposalModal
        isOpen={proposalModalOpen}
        onClose={() => setProposalModalOpen(false)}
        onSuccess={() => {
          setSuccess('Đã gửi đề xuất thành công! Đề xuất đang chờ cấp quản lý phê duyệt.');
          fetchDeviceDetail();
        }}
        mode={proposalMode}
        device={device}
      />

      {/* Geo Camera Capture Modal */}
      <GeoCameraCaptureModal
        deviceId={device.id}
        deviceName={device.name}
        deviceCode={device.device_id}
        defaultLat={device.latitude}
        defaultLng={device.longitude}
        isOpen={geoCameraModalOpen}
        onClose={() => setGeoCameraModalOpen(false)}
        onSuccess={() => {
          setSuccess('Đã chụp và lưu ảnh định vị tọa độ thiết bị thành công!');
          fetchDeviceDetail();
        }}
      />

      {/* Zalo & QR Share Modal */}
      <ZaloQRShareModal
        device={device}
        isOpen={zaloQRModalOpen}
        onClose={() => setZaloQRModalOpen(false)}
      />
    </div>
  );
};
