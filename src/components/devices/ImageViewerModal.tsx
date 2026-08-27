import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, AlertTriangle } from 'lucide-react';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: { url: string; caption?: string }[];
  initialIndex?: number;
  title?: string;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  onClose,
  images = [],
  initialIndex = 0,
  title = 'Hình ảnh thiết bị'
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageError, setImageError] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setImageError(false);
  }, [initialIndex, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, images.length]);

  if (!isOpen) return null;

  if (!images || images.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <p className="font-bold text-slate-800 text-sm">Chưa có hình ảnh thiết bị.</p>
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
          >
            Đóng
          </button>
        </div>
      </div>
    );
  }

  const currentImage = images[currentIndex] || { url: '', caption: '' };

  const handlePrev = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setImageError(false);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNext = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setImageError(false);
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Dragging for Pan when zoomed
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile swipe & pinch
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    const diffX = touchEnd.x - touchStartRef.current.x;

    if (Math.abs(diffX) > 60 && scale === 1) {
      if (diffX > 0) {
        handlePrev();
      } else {
        handleNext();
      }
    }
    touchStartRef.current = null;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-between p-4 sm:p-6 select-none"
      onClick={onClose}
    >
      {/* Top Header Toolbar */}
      <div
        className="w-full max-w-5xl flex items-center justify-between text-white z-10 bg-slate-900/60 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs sm:text-sm font-bold truncate max-w-[200px] sm:max-w-md">{title}</span>
          <span className="bg-blue-600/80 text-white text-[11px] font-mono font-bold px-2.5 py-1 rounded-full">
            Ảnh {currentIndex + 1} / {images.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-white/10 rounded-xl transition text-white"
            title="Phóng to"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-white/10 rounded-xl transition text-white"
            title="Thu nhỏ"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-2 hover:bg-white/10 rounded-xl transition text-white"
            title="Đặt lại kích thước"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <div className="w-[1px] h-5 bg-white/20 mx-1" />
          <button
            onClick={onClose}
            className="p-2 bg-red-600/80 hover:bg-red-600 rounded-xl transition text-white shadow"
            title="Đóng (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div
        className="relative flex-1 w-full max-w-6xl flex items-center justify-center overflow-hidden my-2"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {images.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-2 sm:left-6 z-20 p-3 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full shadow-xl border border-white/10 backdrop-blur transition transform hover:scale-110"
              title="Ảnh trước"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 sm:right-6 z-20 p-3 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full shadow-xl border border-white/10 backdrop-blur transition transform hover:scale-110"
              title="Ảnh sau"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          {imageError ? (
            <div className="bg-slate-900/90 border border-red-500/50 rounded-2xl p-8 text-center space-y-3 max-w-md mx-auto text-white shadow-2xl">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto animate-bounce" />
              <p className="font-bold text-sm text-red-400">Không thể tải ảnh thiết bị.</p>
              <p className="text-xs text-slate-400 font-mono break-all">{currentImage.url}</p>
              <button
                onClick={() => setImageError(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg transition"
              >
                Thử tải lại
              </button>
            </div>
          ) : (
            <img
              src={currentImage.url}
              alt={currentImage.caption || title}
              onError={() => setImageError(true)}
              className="max-h-[75vh] max-w-full object-contain transition-transform duration-150 rounded-xl shadow-2xl"
              style={{
                transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in'
              }}
              onClick={() => {
                if (scale === 1) handleZoomIn();
                else handleResetZoom();
              }}
            />
          )}
        </div>
      </div>

      {/* Bottom Caption & Thumbnail Bar */}
      <div
        className="w-full max-w-4xl bg-slate-900/60 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-white z-10 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-medium text-slate-200 truncate max-w-md">
          {currentImage.caption || title}
        </p>

        {images.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto max-w-full py-1">
            {images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentIndex(idx);
                  setScale(1);
                  setPosition({ x: 0, y: 0 });
                  setImageError(false);
                }}
                className={`w-10 h-10 rounded-lg overflow-hidden border-2 transition flex-shrink-0 ${
                  currentIndex === idx ? 'border-blue-500 scale-105 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img src={img.url} alt={`Thumb ${idx}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
