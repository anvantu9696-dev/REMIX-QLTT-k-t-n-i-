import React from 'react';
import { Task } from '../types';
import { X, Printer } from 'lucide-react';
import { formatDate } from '../utils/dateTime';

interface PrintChecklistModalProps {
  task: Task;
  deviceChecklist: any;
  itemResults: Record<string, any>;
  onClose: () => void;
}

export const PrintChecklistModal: React.FC<PrintChecklistModalProps> = ({ task, deviceChecklist, itemResults, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  const isRec = deviceChecklist.checklist_title?.toUpperCase().includes('REC');
  const isLbs = deviceChecklist.checklist_title?.toUpperCase().includes('LBS');
  const items = deviceChecklist.checklist_items || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 print:p-0 print:bg-white print:block">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-xl flex flex-col overflow-hidden print:w-full print:max-w-none print:h-auto print:max-h-none print:rounded-none print:shadow-none print:overflow-visible">
        
        {/* Header - Hidden in Print */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 print:hidden shrink-0">
          <h3 className="text-lg font-bold text-slate-800">Xem trước Biên bản Kiểm tra</h3>
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePrint}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition"
            >
              <Printer className="w-4 h-4" />
              <span>In / Lưu PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Content */}
        <div className="p-8 overflow-y-auto print:p-0 print:overflow-visible">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold uppercase mb-1">
              {isRec ? 'BIÊN BẢN KIỂM TRA MÁY CẮT TỰ ĐÓNG LẠI (RECLOSER)' : isLbs ? 'BIÊN BẢN KIỂM TRA ĐỊNH KỲ DAO CẮT PHỤ TẢI (LBS)' : 'BIÊN BẢN KIỂM TRA'}
            </h2>
            <p className="text-sm font-semibold">Tên thiết bị: {deviceChecklist.device_name || task.device_name} - Mã: {deviceChecklist.device_code || task.device_code}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <p><strong>Ngày kiểm tra:</strong> {formatDate(task.completed_at || task.updated_at || new Date().toISOString())}</p>
              <p><strong>Vị trí/Số trụ:</strong> {deviceChecklist.pole_number || task.pole_number || '...'}</p>
              <p><strong>Đơn vị quản lý:</strong> {deviceChecklist.device_unit || task.device_unit || '...'}</p>
            </div>
            <div>
              <p><strong>Phát tuyến/Tuyến dây:</strong> {deviceChecklist.device_team || task.device_team || task.team || '...'}</p>
              <p><strong>Người thực hiện:</strong> {task.completed_by || task.assigned_to_fullname || '...'}</p>
            </div>
          </div>

          <table className="w-full border-collapse border border-black text-sm mb-6">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black p-2 w-12 text-center">STT</th>
                <th className="border border-black p-2">Nội dung kiểm tra</th>
                <th className="border border-black p-2 w-48 text-center">Tiêu chuẩn</th>
                <th className="border border-black p-2 w-24 text-center">Kết quả</th>
                <th className="border border-black p-2 w-32 text-center">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, index: number) => {
                const resKey = deviceChecklist.device_id ? `${deviceChecklist.device_id}_${item.id}` : `legacy_${item.id}`;
                const resVal = itemResults[resKey] || { result_value: '', is_pass: true, notes: '' };
                return (
                  <tr key={item.id}>
                    <td className="border border-black p-2 text-center">{index + 1}</td>
                    <td className="border border-black p-2">{item.content}</td>
                    <td className="border border-black p-2 text-center">{item.standard_value || '-'}</td>
                    <td className="border border-black p-2 text-center font-bold">
                      {resVal.result_value || (resVal.is_pass ? 'ĐẠT' : 'KHÔNG ĐẠT')}
                    </td>
                    <td className="border border-black p-2">{resVal.notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-8 text-sm mt-8 pb-8">
            <div className="text-center">
              <p className="font-bold mb-16">Nhóm kiểm tra / Đề xuất</p>
              <p>{task.completed_by || task.assigned_to_fullname || '.........................'}</p>
            </div>
            <div className="text-center">
              <p className="font-bold mb-16">Ý kiến lãnh đạo / Kết quả xử lý</p>
              <p>{task.approved_by_fullname || '.........................'}</p>
              <p className="italic text-xs mt-2">{task.approval_notes}</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
