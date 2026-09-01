import React, { useState } from 'react';
import { MapPin, Compass, Eye, Edit2, Trash2, Zap, Building2, GitCommitHorizontal, QrCode } from 'lucide-react';
import { Device } from '../../types';
import { ImageViewerModal } from './ImageViewerModal';
import { ZaloQRShareModal } from './ZaloQRShareModal';
import { DEVICE_IMAGE_FEATURE_ENABLED } from '../../../server/config';

interface DeviceCardProps {
  device: Device;
  onNavigateToDetail: (deviceId: number) => void;
  onEdit: (device: Device) => void;
  onDelete: (device: Device) => void;
  isGuest: boolean;
  hasRole: (permission: string) => boolean;
  isSelected?: boolean;
  onToggleSelect?: (deviceId: number) => void;
  getNormalizedRelations: (device: Device) => { substationName: string; feederName: string; };
}

export const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  onNavigateToDetail,
  onEdit,
  onDelete,
  isGuest,
  hasRole,
  isSelected = false,
  onToggleSelect,
  getNormalizedRelations
}) => {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [zaloQROpen, setZaloQROpen] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CLOSED': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'OPEN': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'CLOSED': return 'ĐANG ĐÓNG';
      case 'OPEN': return 'ĐANG MỞ';
      default: return 'KHÔNG RÕ';
    }
  };

  return (
    <div className={`rounded-xl border p-4 shadow-sm hover:shadow-md transition-all flex flex-col h-full relative ${
      isSelected ? 'bg-blue-50/40 border-blue-500 ring-2 ring-blue-500/20' : 'bg-white border-slate-200'
    }`}>
      {/* Top selection checkbox badge */}
      {onToggleSelect && (
        <div className="absolute top-3 right-3 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect(device.id);
            }}
            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer shadow-sm"
          />
        </div>
      )}

      {/* Image */}
      <div 
        onClick={() => {
          if (DEVICE_IMAGE_FEATURE_ENABLED && device.primary_image) {
            setViewerOpen(true);
          }
        }}
        className={`relative h-40 bg-slate-100 rounded-lg overflow-hidden mb-3 ${DEVICE_IMAGE_FEATURE_ENABLED && device.primary_image ? 'cursor-pointer group' : ''}`}
      >
        {device.primary_image ? (
          <>
            {DEVICE_IMAGE_FEATURE_ENABLED && (
                <>
                    <img src={device.primary_image} alt={device.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="bg-slate-900/80 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur">
                        Xem lớn
                      </span>
                    </div>
                </>
            )}
            {!DEVICE_IMAGE_FEATURE_ENABLED && (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-2 text-center bg-slate-50">
                    <p className="text-[10px] text-slate-500">Chức năng cập nhật hình ảnh đang tạm khóa.</p>
                </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-2 text-center">
            <span className="text-xs font-medium">Chưa có hình ảnh thiết bị.</span>
          </div>
        )}
        <div className="absolute top-2 left-2 px-2 py-1 bg-white/90 backdrop-blur rounded text-[10px] font-bold text-slate-800 border border-white">
          {device.device_type === 'RCL' ? 'REC' : device.device_type}
        </div>
      </div>

      <ImageViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        images={device.primary_image ? [{ url: device.primary_image, caption: device.name }] : []}
        title={`Thiết bị: ${device.name} (${device.device_id})`}
      />

      {/* Info */}
      <div className="flex-grow space-y-2">
        <h3 className="font-mono font-bold text-blue-700 text-xs">{device.device_id}</h3>
        <h4 className="font-bold text-slate-900 text-sm truncate">{device.name}</h4>
        
        <div className="text-[11px] text-slate-600 space-y-1">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate">{getNormalizedRelations(device).substationName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <GitCommitHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate">{getNormalizedRelations(device).feederName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate">Dòng chỉnh định: <strong>{device.current_setting || 'N/A'}</strong></span>
          </div>
        </div>

        <div className="pt-2">
           <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold border ${getStatusColor(device.switch_status)}`}>
              {getStatusLabel(device.switch_status)}
           </span>
        </div>
      </div>

      {/* Actions */}
      <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-2">
        <button
          onClick={() => onNavigateToDetail(device.id)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-bold transition"
        >
          <Eye className="w-3.5 h-3.5" /> CHI TIẾT
        </button>
        <button
          onClick={() => {
              // Reusing navigation logic from DevicesPage
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
                }
              }
              alert('Thông tin vị trí hoặc Google Maps chưa khả dụng.');
          }}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-xs font-bold transition"
        >
          <Compass className="w-3.5 h-3.5" /> CHỈ ĐƯỜNG
        </button>

        <button
          onClick={() => setZaloQROpen(true)}
          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
          title="Chia sẻ Zalo & Mã QR"
        >
          <QrCode className="w-4 h-4" />
        </button>

        {!isGuest && (hasRole('ADMIN') || hasRole('MANAGER')) && (
            <button
                onClick={() => onEdit(device)}
                className="p-1.5 text-slate-500 hover:text-blue-600 rounded hover:bg-slate-100"
                title="Sửa"
            >
                <Edit2 className="w-4 h-4" />
            </button>
        )}
        {!isGuest && hasRole('ADMIN') && (
            <button
                onClick={() => onDelete(device)}
                className="p-1.5 text-slate-500 hover:text-red-600 rounded hover:bg-slate-100"
                title="Xóa"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        )}
      </div>

      {/* Zalo & QR Share Modal */}
      <ZaloQRShareModal
        device={device}
        isOpen={zaloQROpen}
        onClose={() => setZaloQROpen(false)}
      />
    </div>
  );
};
