import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Share2,
  Copy,
  Check,
  Download,
  ExternalLink,
  MapPin,
  QrCode,
  Smartphone,
  Printer,
  Zap,
  Info
} from 'lucide-react';
import { Device } from '../../types';

interface ZaloQRShareModalProps {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ZaloQRShareModal: React.FC<ZaloQRShareModalProps> = ({
  device,
  isOpen,
  onClose
}) => {
  const [qrMode, setQrMode] = useState<'maps' | 'app' | 'text'>('maps');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [loadingQr, setLoadingQr] = useState(true);
  const printableCardRef = useRef<HTMLDivElement>(null);

  const lat = device?.latitude;
  const lng = device?.longitude;
  const hasCoordinates = lat !== null && lat !== undefined && lng !== null && lng !== undefined;

  // 1. Google Maps Navigation URL
  const mapsUrl = hasCoordinates
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : device?.google_maps_url || (typeof window !== 'undefined' ? window.location.href : '');

  // 2. Direct App URL to device
  const appUrl = device && typeof window !== 'undefined' ? `${window.location.origin}/#device-${device.id}` : '';

  // 3. Formatted message for Zalo chat
  const zaloMessage = device
    ? `⚡ [EVN GRID] THÔNG TIN THIẾT BỊ LƯỚI ĐIỆN
━━━━━━━━━━━━━━━━━━━━
📌 Tên thiết bị: ${device.name}
🏷️ Mã quản lý (DEVICE_ID): ${device.device_id}
⚡ Phân loại: ${device.device_type === 'RCL' ? 'REC (Recloser)' : device.device_type}
🏢 Trạm 110kV: ${device.substation_name || 'N/A'}
🔌 Phát tuyến: ${device.feeder_name || device.feeder_code || 'N/A'}
📍 Vị trí cột/trụ: ${device.pole_number || 'Chưa cập nhật'}
🧭 Tọa độ GPS: ${hasCoordinates ? `${lat?.toFixed(6)}, ${lng?.toFixed(6)}` : 'Chưa cập nhật'}
${hasCoordinates ? `🗺️ Chỉ đường Google Maps: ${mapsUrl}` : ''}
🔘 Trạng thái tiếp điểm: ${device.switch_status === 'CLOSED' ? 'ĐANG ĐÓNG' : 'ĐANG MỞ'}
📡 Trạng thái SCADA: ${device.scada_status || 'SIGNAL'}
🏢 Đơn vị quản lý: ${device.unit || 'Công ty Điện lực'} - ${device.team || 'Đội QLVH'}
━━━━━━━━━━━━━━━━━━━━
Truy cập phần mềm quản trị: ${typeof window !== 'undefined' ? window.location.origin : ''}`
    : '';

  // Generate QR based on selected mode
  useEffect(() => {
    if (!isOpen || !device) return;

    let payload = mapsUrl;
    if (qrMode === 'app') {
      payload = appUrl;
    } else if (qrMode === 'text') {
      payload = `EVN-DEVICE:${device.device_id}|${device.name}|${device.device_type}|GPS:${lat || 0},${lng || 0}`;
    }

    setLoadingQr(true);
    QRCode.toDataURL(payload, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    })
      .then(url => {
        setQrDataUrl(url);
        setLoadingQr(false);
      })
      .catch(err => {
        console.error('QR code generation failed', err);
        setLoadingQr(false);
      });
  }, [isOpen, device, qrMode, mapsUrl, appUrl]);

  if (!isOpen || !device) return null;

  const handleCopyZaloText = async () => {
    try {
      await navigator.clipboard.writeText(zaloMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(mapsUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err) {
      console.error('Failed to copy link', err);
    }
  };

  const handleOpenZaloWeb = () => {
    // Copy message to clipboard first for convenience
    handleCopyZaloText();
    // Open Zalo Web or share intent
    const shareUrl = encodeURIComponent(mapsUrl);
    window.open(`https://chat.zalo.me/`, '_blank');
  };

  const handleDownloadQrCard = () => {
    if (!qrDataUrl) return;

    // Create a high-res canvas composite card
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // EVN Header
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, 140);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ TẬP ĐOÀN ĐIỆN LỰC VIỆT NAM (EVN)', canvas.width / 2, 60);

    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('HỆ THỐNG QUẢN LÝ THIẾT BỊ LƯỚI ĐIỆN THÔNG MINH', canvas.width / 2, 100);

    // QR Image in center
    const qrImg = new Image();
    qrImg.onload = () => {
      ctx.drawImage(qrImg, 175, 180, 450, 450);

      // Card Border around QR
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.strokeRect(165, 170, 470, 470);

      // Device Information box
      const infoY = 680;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(40, infoY, canvas.width - 80, 260);

      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(40, infoY, canvas.width - 80, 260);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(`⚡ ${device.name}`, 70, infoY + 45);

      ctx.fillStyle = '#2563eb';
      ctx.font = 'bold 20px monospace';
      ctx.fillText(`MÃ THIẾT BỊ: ${device.device_id}`, 70, infoY + 85);

      ctx.fillStyle = '#475569';
      ctx.font = '18px sans-serif';
      ctx.fillText(`Trạm: ${device.substation_name || 'N/A'}  |  Tuyến: ${device.feeder_name || device.feeder_code || 'N/A'}`, 70, infoY + 125);
      ctx.fillText(`Vị trí cột: ${device.pole_number || 'N/A'}  |  Loại: ${device.device_type}`, 70, infoY + 165);
      
      ctx.fillStyle = '#0284c7';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`📍 GPS: ${hasCoordinates ? `${lat?.toFixed(6)}, ${lng?.toFixed(6)}` : 'Chưa có tọa độ'}`, 70, infoY + 205);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Quét mã QR để mở bản đồ định vị và thông tin kỹ thuật`, canvas.width / 2, infoY + 245);

      // Trigger download
      const link = document.createElement('a');
      link.download = `THE_QR_${device.device_id}_${device.name}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    qrImg.src = qrDataUrl;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                Chia sẻ thông tin & Mã QR
                <span className="text-[11px] font-normal px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full">
                  Zalo / Bản đồ
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {device.name} [{device.device_id}]
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Top Options Tabs for QR Content */}
          <div className="flex items-center justify-between bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setQrMode('maps')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                qrMode === 'maps'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>QR Vị trí Google Maps</span>
            </button>
            <button
              onClick={() => setQrMode('app')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                qrMode === 'app'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>QR Liên kết Thiết bị</span>
            </button>
            <button
              onClick={() => setQrMode('text')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                qrMode === 'text'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>Mã QR Thông số</span>
            </button>
          </div>

          {/* QR Code Card Display */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
            {/* Left: QR Display Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-center text-center shadow-inner">
              <div className="bg-white p-3 rounded-xl shadow-md border border-slate-200 mb-3 relative group">
                {loadingQr ? (
                  <div className="w-48 h-48 flex items-center justify-center text-slate-400 text-xs">
                    Đang tạo mã QR...
                  </div>
                ) : (
                  <img
                    src={qrDataUrl}
                    alt={`QR Code ${device.name}`}
                    className="w-48 h-48 object-contain"
                  />
                )}
                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 rounded-xl transition flex items-center justify-center pointer-events-none">
                  <span className="bg-slate-900/80 text-white text-[11px] font-bold px-2 py-1 rounded backdrop-blur">
                    Quét bằng Zalo / Camera
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-800 block">
                  Quét mã QR qua Camera / Zalo
                </span>
                <p className="text-[11px] text-slate-500 max-w-[200px]">
                  {qrMode === 'maps'
                    ? 'Mở ứng dụng Bản đồ chỉ đường trực tiếp tới vị trí cột'
                    : qrMode === 'app'
                    ? 'Mở trang quản trị chi tiết thiết bị trên hệ thống'
                    : 'Đọc thông số kỹ thuật thiết bị'}
                </p>
              </div>

              <button
                onClick={handleDownloadQrCard}
                className="mt-3 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-100 flex items-center gap-1.5 shadow-sm transition"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>Tải Thẻ QR In Dán Cột</span>
              </button>
            </div>

            {/* Right: Quick Zalo Action Center */}
            <div className="space-y-4">
              {/* Primary Zalo Share Card */}
              <div className="bg-gradient-to-br from-blue-50 to-sky-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                      Z
                    </div>
                    <span className="text-xs font-bold text-blue-950">
                      Chia sẻ qua ứng dụng Zalo
                    </span>
                  </div>
                  <span className="text-[10px] bg-blue-200 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                    Tin nhắn chuẩn
                  </span>
                </div>

                <p className="text-xs text-blue-900 leading-relaxed">
                  Tự động định dạng toàn bộ thông số kỹ thuật, vị trí cột và liên kết Google Maps để gửi nhanh vào nhóm Zalo ca trực / điều độ.
                </p>

                <div className="flex flex-col gap-2 pt-1">
                  <button
                    onClick={handleCopyZaloText}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition ${
                      copied
                        ? 'bg-emerald-600 text-white shadow-emerald-500/25'
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Đã sao chép nội dung Zalo!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Sao chép Tin nhắn Zalo (1-Click)</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleOpenZaloWeb}
                    className="w-full py-2 px-3 bg-white border border-blue-300 text-blue-700 rounded-xl text-xs font-bold hover:bg-blue-50 flex items-center justify-center gap-1.5 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Mở Zalo Web để Dán Tin Nhắn</span>
                  </button>
                </div>
              </div>

              {/* Direct Maps Link Sharing */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 flex items-center justify-between">
                <div className="space-y-0.5 truncate pr-2">
                  <span className="text-[11px] font-bold text-slate-700 block">
                    Liên kết Chỉ đường Google Maps:
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono block truncate">
                    {mapsUrl}
                  </span>
                </div>
                <button
                  onClick={handleCopyLink}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-100 flex items-center gap-1 flex-shrink-0 shadow-sm"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Đã chép' : 'Chép link'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Preview of the Zalo message text */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Share2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Nội dung mẫu gửi qua Zalo / Tin nhắn:</span>
              </label>
              <button
                onClick={handleCopyZaloText}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800"
              >
                {copied ? 'Đã sao chép!' : 'Sao chép tất cả'}
              </button>
            </div>
            <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto border border-slate-800">
              {zaloMessage}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Mã QR tương thích với mọi camera điện thoại và ứng dụng Zalo</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
