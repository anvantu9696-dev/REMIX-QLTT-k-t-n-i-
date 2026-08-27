import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Sun, Moon, Zap } from 'lucide-react';

interface LiveClockWidgetProps {
  variant?: 'header' | 'card' | 'compact';
  showShift?: boolean;
}

export const LiveClockWidget: React.FC<LiveClockWidgetProps> = ({
  variant = 'header',
  showShift = false
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Format date parts in Vietnamese
  const daysOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const dayName = daysOfWeek[currentTime.getDay()];
  
  const day = String(currentTime.getDate()).padStart(2, '0');
  const month = String(currentTime.getMonth() + 1).padStart(2, '0');
  const year = currentTime.getFullYear();
  const dateStr = `${day}/${month}/${year}`;

  const hours = String(currentTime.getHours()).padStart(2, '0');
  const minutes = String(currentTime.getMinutes()).padStart(2, '0');
  const seconds = String(currentTime.getSeconds()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}:${seconds}`;

  // Calculate Operational Shift (Ca trực vận hành EVN)
  const hourNum = currentTime.getHours();
  let shiftName = 'Ca 1 (06:00 - 14:00)';
  let shiftColor = 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800';
  if (hourNum >= 14 && hourNum < 22) {
    shiftName = 'Ca 2 (14:00 - 22:00)';
    shiftColor = 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800';
  } else if (hourNum >= 22 || hourNum < 6) {
    shiftName = 'Ca 3 (22:00 - 06:00)';
    shiftColor = 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800';
  }

  if (variant === 'compact') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-200 text-xs font-mono font-bold border border-slate-200/80 dark:border-slate-700">
        <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-pulse" />
        <span>{timeStr}</span>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 shadow-inner">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
                {timeStr}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border font-sans bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700">
                <Calendar className="w-3 h-3 text-blue-500" />
                {dayName}, {dateStr}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Thời gian chuẩn hệ thống vận hành lưới điện EVN (GMT+7)
            </p>
          </div>
        </div>

        {showShift && (
          <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 shrink-0 ${shiftColor}`}>
            <Zap className="w-3.5 h-3.5" />
            <span>{shiftName}</span>
          </div>
        )}
      </div>
    );
  }

  // Default 'header' variant: Sleek header bar widget
  return (
    <div 
      className="flex items-center gap-2 px-3 py-1.5 bg-slate-100/90 dark:bg-slate-800/90 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs text-xs transition-all select-none"
      title="Thời gian chuẩn hệ thống vận hành lưới điện EVN (GMT+7)"
    >
      <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-mono font-bold tracking-tight">
        <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        <span className="text-xs sm:text-[13px]">{timeStr}</span>
      </div>

      <div className="h-3.5 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block" />

      <div className="hidden sm:flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium text-[11px]">
        <Calendar className="w-3 h-3 text-slate-400 dark:text-slate-500" />
        <span>{dayName}, {dateStr}</span>
      </div>
    </div>
  );
};
