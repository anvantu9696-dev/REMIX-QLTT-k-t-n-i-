import React, { useEffect } from 'react';
import { toast, Toaster } from 'sonner';
import { useRealtimeSync, RealtimeEvent } from '../hooks/useRealtimeSync';
import { Bell, Activity, CheckCircle, AlertTriangle, Trash2, Info } from 'lucide-react';

export function RealtimeNotifier() {
  const handleEvent = (event: RealtimeEvent) => {
    const { type, entity, action, data } = event;
    
    let icon = <Info className="w-4 h-4 text-blue-500" />;
    let message = '';
    let description = '';

    switch (entity) {
      case 'DEVICE':
        icon = action === 'DELETE' ? <Trash2 className="w-4 h-4 text-red-500" /> : <Activity className="w-4 h-4 text-emerald-500" />;
        message = `${action === 'CREATE' ? 'Thiết bị mới' : action === 'UPDATE' ? 'Cập nhật thiết bị' : 'Đã xóa thiết bị'}`;
        description = data?.name || 'Thông tin thiết bị đã thay đổi';
        break;
      case 'TASK':
        icon = <CheckCircle className="w-4 h-4 text-blue-500" />;
        message = `Công việc: ${action === 'CREATE' ? 'Đã giao' : 'Đã cập nhật'}`;
        description = data?.title || 'Thông tin công việc thay đổi';
        break;
      case 'ISSUE':
        icon = <AlertTriangle className="w-4 h-4 text-amber-500" />;
        message = `Sự cố: ${action === 'CREATE' ? 'Báo cáo mới' : 'Cập nhật'}`;
        description = data?.title || 'Tình trạng sự cố thay đổi';
        break;
      default:
        message = 'Cập nhật hệ thống';
        description = 'Dữ liệu đã được đồng bộ hóa';
    }

    toast(message, {
      description,
      icon,
      duration: 5000,
      position: 'top-right',
    });
  };

  useRealtimeSync(handleEvent);

  return <Toaster position="top-right" richColors closeButton />;
}
