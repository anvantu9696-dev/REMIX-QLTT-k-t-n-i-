import React from 'react';
import { Power, Zap, Radio, RefreshCw } from 'lucide-react';

export const GraphLegend = () => (
  <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 text-xs text-slate-600 flex flex-col gap-3">
    <div>
      <h4 className="font-bold text-slate-800 mb-1.5 uppercase text-[11px] tracking-wider">Đối tượng lưới điện</h4>
      <div className="grid grid-cols-1 gap-1.5">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center bg-amber-100 text-amber-600 border border-amber-300">
            <Power size={12} />
          </div>
          <span className="font-medium text-slate-700">Trạm 110kV</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center bg-blue-100 text-blue-600 border border-blue-300">
            <Zap size={12} />
          </div>
          <span className="font-medium text-slate-700">Phát tuyến (Feeder)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center bg-emerald-100 text-emerald-600 border border-emerald-300">
            <Radio size={12} />
          </div>
          <span className="font-medium text-slate-700">Thiết bị phía A / B</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center bg-indigo-100 text-indigo-700 border-2 border-indigo-500 shadow-xs">
            <RefreshCw size={12} className="animate-spin-slow" />
          </div>
          <span className="font-semibold text-indigo-900">Điểm dừng pháp lý</span>
        </div>
      </div>
    </div>

    <div className="border-t border-slate-100 pt-2">
      <h4 className="font-bold text-slate-800 mb-1.5 uppercase text-[11px] tracking-wider">Trạng thái đóng cắt thiết bị</h4>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100"></span>
          <span>Đóng (Closed)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-100"></span>
          <span>Mở (Open)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-400 ring-2 ring-slate-100"></span>
          <span>Không xác định (Unknown)</span>
        </div>
      </div>
    </div>
  </div>
);
