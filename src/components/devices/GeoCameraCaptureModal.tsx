import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, RefreshCw, Check, MapPin, Download, Upload, ShieldCheck, AlertCircle, Smartphone } from 'lucide-react';
import { api } from '../../lib/api';
import { DEVICE_IMAGE_FEATURE_ENABLED } from '../../../server/config';

interface GeoCameraCaptureModalProps {
  deviceId: number;
  deviceName: string;
  deviceCode: string;
  defaultLat?: number;
  defaultLng?: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const GeoCameraCaptureModal: React.FC<GeoCameraCaptureModalProps> = ({
  deviceId,
  deviceName,
  deviceCode,
  defaultLat,
  defaultLng,
  isOpen,
  onClose,
  onSuccess
}) => {
  if (!DEVICE_IMAGE_FEATURE_ENABLED) {
    return null;
  }
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [useFrontCamera, setUseFrontCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [loadingCamera, setLoadingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // GPS Location State
  const [lat, setLat] = useState<number | null>(defaultLat || null);
  const [lng, setLng] = useState<number | null>(defaultLng || null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [altitude, setAltitude] = useState<number | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [caption, setCaption] = useState('Khảo sát hiện trường định vị tọa độ thiết bị');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCapturedImage(null);
      setErrorMsg(null);
      startCamera();
      fetchCurrentLocation();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, useFrontCamera]);

  const fetchCurrentLocation = () => {
    setLocationLoading(true);
    setLocationError(null);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLat(position.coords.latitude);
          setLng(position.coords.longitude);
          setAccuracy(position.coords.accuracy);
          setAltitude(position.coords.altitude);
          setLocationLoading(false);
        },
        (error) => {
          console.warn('Geolocation notice:', error);
          setLocationError('Không thể lấy tọa độ GPS thời gian thực. Hệ thống đang sử dụng tọa độ mặc định của thiết bị.');
          setLocationLoading(false);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    } else {
      setLocationError('Trình duyệt không hỗ trợ định vị GPS.');
      setLocationLoading(false);
    }
  };

  const startCamera = async () => {
    setLoadingCamera(true);
    setCameraError(null);
    stopCamera();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Trình duyệt không hỗ trợ trực tiếp camera WebRTC. Bạn có thể sử dụng tính năng chụp từ máy ảnh hệ thống bên dưới.');
      setLoadingCamera(false);
      return;
    }

    let mediaStream: MediaStream | null = null;

    // Strategy 1: Ideal facingMode and resolution
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: useFrontCamera ? 'user' : 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
    } catch (err1) {
      console.warn('Strategy 1 failed, trying fallback to generic facingMode:', err1);
      // Strategy 2: Simple facingMode
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: useFrontCamera ? 'user' : 'environment'
          },
          audio: false
        });
      } catch (err2) {
        console.warn('Strategy 2 failed, trying fallback to any video camera:', err2);
        // Strategy 3: Any available video device (standard webcam / laptop camera)
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        } catch (err3: any) {
          console.warn('All camera constraints failed:', err3);
          const errorText = err3.name === 'NotAllowedError' || err3.name === 'PermissionDeniedError'
            ? 'Quyền truy cập Camera bị từ chối. Vui lòng cho phép quyền Camera trên trình duyệt.'
            : err3.name === 'NotFoundError' || err3.name === 'DevicesNotFoundError'
            ? 'Không tìm thấy thiết bị camera phần cứng trên máy. Bạn có thể chụp bằng máy ảnh điện thoại hoặc tải ảnh từ tệp.'
            : `Không thể kết nối camera (${err3.message || 'Lỗi thiết bị'}). Vui lòng sử dụng máy ảnh hệ thống hoặc tải ảnh.`;
          setCameraError(errorText);
        }
      }
    }

    if (mediaStream) {
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    }
    setLoadingCamera(false);
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const switchCamera = () => {
    setUseFrontCamera(prev => !prev);
  };

  const drawWatermarkOnCanvas = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) => {
    const now = new Date();
    const timestampStr = now.toLocaleString('vi-VN');
    const currentLat = lat !== null ? lat : defaultLat;
    const currentLng = lng !== null ? lng : defaultLng;
    const latStr = currentLat !== null && currentLat !== undefined ? currentLat.toFixed(6) : 'N/A';
    const lngStr = currentLng !== null && currentLng !== undefined ? currentLng.toFixed(6) : 'N/A';
    const accStr = accuracy !== null ? `±${Math.round(accuracy)}m` : 'Tiêu chuẩn';

    // Scale font & layout proportionally based on canvas dimensions
    const scale = Math.max(width / 1280, 0.7);
    const boxHeight = Math.round(135 * scale);
    const paddingLeft = Math.round(24 * scale);

    // Overlay background box at bottom
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fillRect(0, height - boxHeight, width, boxHeight);

    // Accent top line (EVN Blue)
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(0, height - boxHeight, width, Math.max(5 * scale, 3));

    // Device Header
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(20 * scale)}px sans-serif`;
    ctx.fillText(`⚡ ${deviceName} [${deviceCode}]`, paddingLeft, height - boxHeight + Math.round(36 * scale));

    // GPS coordinates line
    ctx.fillStyle = '#38bdf8';
    ctx.font = `bold ${Math.round(15 * scale)}px sans-serif`;
    ctx.fillText(`📍 Tọa độ GPS: Lat ${latStr}°, Lng ${lngStr}° (Độ chính xác: ${accStr})`, paddingLeft, height - boxHeight + Math.round(68 * scale));

    // Timestamp & Organization
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `${Math.round(13 * scale)}px sans-serif`;
    ctx.fillText(`🕒 ${timestampStr} | EVN Smart Grid Inspection`, paddingLeft, height - boxHeight + Math.round(98 * scale));
  };

  const takeSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 2. Draw Geo-Watermark Overlay
    drawWatermarkOnCanvas(ctx, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(dataUrl);
    stopCamera();
  };

  const processImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        canvas.width = img.width || 1280;
        canvas.height = img.height || 720;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        drawWatermarkOnCanvas(ctx, canvas.width, canvas.height);

        setCapturedImage(canvas.toDataURL('image/jpeg', 0.92));
        stopCamera();
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleSaveAndUpload = async () => {
    if (!capturedImage) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const currentLat = lat !== null ? lat : defaultLat;
      const currentLng = lng !== null ? lng : defaultLng;
      const latStr = currentLat !== null && currentLat !== undefined ? currentLat.toFixed(6) : 'N/A';
      const lngStr = currentLng !== null && currentLng !== undefined ? currentLng.toFixed(6) : 'N/A';

      await api.addDeviceImage(deviceId, {
        image_url: capturedImage,
        caption: `${caption} (Tọa độ GPS: ${latStr}, ${lngStr})`
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể lưu ảnh định vị vào thiết bị');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Camera className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-bold">Chụp ảnh định vị tọa độ thiết bị</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden inputs for Native Device Camera & File picker */}
        <input
          ref={nativeCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileUpload}
          className="hidden"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Device & Location Info Badge */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <p className="text-xs font-bold text-blue-900">{deviceName} <span className="font-mono text-blue-700">({deviceCode})</span></p>
              <div className="flex items-center space-x-2 mt-1 text-xs text-blue-800">
                <MapPin className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                <span>
                  {locationLoading
                    ? 'Đang xác định tọa độ GPS...'
                    : lat && lng
                    ? `GPS: ${lat.toFixed(6)}°, ${lng.toFixed(6)}°`
                    : defaultLat && defaultLng
                    ? `GPS Thiết bị: ${defaultLat.toFixed(6)}°, ${defaultLng.toFixed(6)}°`
                    : 'Chưa có tọa độ GPS'}
                </span>
                {accuracy && <span className="bg-blue-200 px-1.5 py-0.5 rounded text-[10px] font-mono">±{Math.round(accuracy)}m</span>}
              </div>
            </div>
            <button
              onClick={fetchCurrentLocation}
              disabled={locationLoading}
              className="px-3 py-1.5 bg-white border border-blue-300 text-blue-700 text-xs font-bold rounded-lg hover:bg-blue-100 flex items-center space-x-1 flex-shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${locationLoading ? 'animate-spin' : ''}`} />
              <span>Lấy lại GPS</span>
            </button>
          </div>

          {locationError && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
              <span>{locationError}</span>
            </div>
          )}

          {/* Camera / Captured Viewport */}
          <div className="relative bg-slate-950 rounded-xl overflow-hidden aspect-video flex items-center justify-center border border-slate-800">
            {!capturedImage ? (
              <>
                {loadingCamera && (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs space-x-2">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span>Đang khởi động camera...</span>
                  </div>
                )}
                {cameraError ? (
                  <div className="p-6 text-center space-y-3 max-w-md">
                    <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                    <p className="text-xs text-slate-300 font-medium">{cameraError}</p>
                    <div className="flex flex-wrap gap-2 justify-center pt-2">
                      <button
                        onClick={() => nativeCameraInputRef.current?.click()}
                        className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 shadow"
                      >
                        <Smartphone className="w-4 h-4" />
                        <span>Mở Máy ảnh Thiết bị</span>
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 shadow"
                      >
                        <Upload className="w-4 h-4" />
                        <span>Chọn ảnh từ tệp</span>
                      </button>
                      <button
                        onClick={startCamera}
                        className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-700"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Thử lại</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                )}
              </>
            ) : (
              <img src={capturedImage} alt="Captured with watermark" className="w-full h-full object-contain bg-black" />
            )}
            <canvas ref={canvasRef} className="hidden" />

            {/* Live watermark badge simulation on camera */}
            {!capturedImage && !cameraError && stream && (
              <div className="absolute bottom-3 left-3 right-3 bg-slate-900/85 backdrop-blur-sm border border-slate-700/60 rounded-lg p-2.5 text-white text-[11px] space-y-0.5 pointer-events-none">
                <div className="font-bold flex items-center justify-between">
                  <span>⚡ {deviceName}</span>
                  <span className="text-blue-400 font-mono text-[10px] bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-800">WATERMARK AUTO-STAMP</span>
                </div>
                <div className="text-slate-300 font-mono text-[10px]">
                  📍 {lat !== null ? `${lat.toFixed(5)}°, ${lng?.toFixed(5)}°` : defaultLat ? `${defaultLat.toFixed(5)}°, ${defaultLng?.toFixed(5)}°` : 'Đang lấy GPS...'}
                </div>
              </div>
            )}
          </div>

          {/* Caption Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú / Mô tả hiện trường</label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Nhập ghi chú khảo sát tọa độ..."
            />
          </div>

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {!capturedImage ? (
            <div className="flex items-center space-x-2">
              <button
                onClick={switchCamera}
                disabled={loadingCamera || !!cameraError}
                className="px-3 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-100 flex items-center space-x-1 disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Đổi camera</span>
              </button>
              <button
                onClick={() => nativeCameraInputRef.current?.click()}
                className="px-3 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-100 flex items-center space-x-1"
                title="Chụp trực tiếp bằng ứng dụng Máy ảnh của máy"
              >
                <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Máy ảnh máy</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-100 flex items-center space-x-1"
              >
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>Tải ảnh</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setCapturedImage(null);
                startCamera();
              }}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-100 flex items-center space-x-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Chụp lại</span>
            </button>
          )}

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 text-xs font-bold hover:text-slate-800"
            >
              Hủy
            </button>
            {!capturedImage ? (
              <button
                onClick={takeSnapshot}
                disabled={loadingCamera || !!cameraError}
                className="px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 flex items-center space-x-1.5 shadow-md shadow-blue-500/20 disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                <span>Chụp Ảnh Định Vị</span>
              </button>
            ) : (
              <button
                onClick={handleSaveAndUpload}
                disabled={submitting}
                className="px-5 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 flex items-center space-x-1.5 shadow-md shadow-emerald-500/25 disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{submitting ? 'Đang lưu vào thiết bị...' : 'Lưu & Đính Kèm Thiết Bị'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
