import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, ShieldAlert, Zap, Radio, Battery, Layers, RefreshCw } from 'lucide-react';
import { Device, SwitchStatus, ScadaStatus } from '../../types';
import { api } from '../../lib/api';

interface BulkStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDevices: Device[];
  onSuccess: (message: string) => void;
}

export const BulkStatusModal: React.FC<BulkStatusModalProps> = ({
  isOpen,
  onClose,
  selectedDevices,
  onSuccess
}) => {
  const [enableStatus, setEnableStatus] = useState(false);
  const [statusVal, setStatusVal] = useState('ACTIVE');

  const [enableSwitch, setEnableSwitch] = useState(true);
  const [switchVal, setSwitchVal] = useState<SwitchStatus>('CLOSED');

  const [enableScada, setEnableScada] = useState(false);
  const [scadaVal, setScadaVal] = useState<ScadaStatus>('SIGNAL');

  const [enableRelay79, setEnableRelay79] = useState(false);
  const [relay79Val, setRelay79Val] = useState('ON');

  const [enableBattery, setEnableBattery] = useState(false);
  const [batteryVal, setBatteryVal] = useState('GOOD');

  const [enableNotes, setEnableNotes] = useState(false);
  const [notesVal, setNotesVal] = useState('');

  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enableStatus && !enableSwitch && !enableScada && !enableRelay79 && !enableBattery && !enableNotes) {
      setError('Vui lòng chọn ít nhất một trường thông tin để cập nhật.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const updates: any = {};
      if (enableStatus) updates.status = statusVal;
      if (enableSwitch) updates.switch_status = switchVal;
      if (enableScada) updates.scada_status = scadaVal;
      if (enableRelay79) updates.relay_79 = relay79Val;
      if (enableBattery) updates.battery_status = batteryVal;
      if (enableNotes) updates.notes = notesVal;

      const deviceIds = selectedDevices.map(d => d.id);
      const res = await api.bulkUpdateDevices({
        device_ids: deviceIds,
        updates,
        reason: reason.trim() || 'Cập nhật trạng thái hàng loạt'
      });

      if (res.success) {
        onSuccess(res.message || `Đã cập nhật thành công ${selectedDevices.length} thiết bị.`);
        onClose();
      } else {
        setError(res.message || 'Cập nhật thất bại');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi cập nhật trạng thái hàng loạt.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                Cập nhật Trạng thái Hàng loạt
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-mono font-bold">
                  {selectedDevices.length} thiết bị
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Thiết lập đồng bộ trạng thái vận hành, đóng/cắt, SCADA và lưu nhật ký tự động.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 flex-grow text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Selected Devices Preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">
                Danh sách thiết bị áp dụng ({selectedDevices.length})
              </span>
            </div>
            <div className="max-h-24 overflow-y-auto flex flex-wrap gap-1.5 p-1 bg-white rounded-lg border border-slate-200">
              {selectedDevices.map(d => (
                <span
                  key={d.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-800 rounded text-[11px] font-mono border border-slate-200"
                >
                  <strong className="text-blue-700">{d.device_id}</strong>
                  <span className="text-slate-400">({d.name})</span>
                </span>
              ))}
            </div>
          </div>

          {/* Update Fields Configuration */}
          <div className="space-y-3">
            <label className="block font-bold text-slate-800 text-xs">
              Chọn các trường dữ liệu cần cập nhật:
            </label>

            {/* 1. Trạng thái Đóng / Mở Dao */}
            <div className={`p-3 rounded-xl border transition-colors ${enableSwitch ? 'bg-blue-50/50 border-blue-200' : 'bg-slate-50/50 border-slate-200 opacity-80'}`}>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer select-none font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={enableSwitch}
                    onChange={e => setEnableSwitch(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span>Trạng thái Dao / Máy cắt (Switch Status)</span>
                </label>
                {enableSwitch && <span className="text-[10px] font-bold text-blue-600">ÁP DỤNG</span>}
              </div>
              {enableSwitch && (
                <div className="grid grid-cols-3 gap-2 pl-6 mt-2">
                  <button
                    type="button"
                    onClick={() => setSwitchVal('CLOSED')}
                    className={`py-2 px-3 rounded-lg font-bold border text-center transition-all flex items-center justify-center gap-1.5 ${
                      switchVal === 'CLOSED'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-300" />
                    ĐÓNG (CLOSED)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSwitchVal('OPEN')}
                    className={`py-2 px-3 rounded-lg font-bold border text-center transition-all flex items-center justify-center gap-1.5 ${
                      switchVal === 'OPEN'
                        ? 'bg-red-600 text-white border-red-700 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-red-300" />
                    MỞ (OPEN)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSwitchVal('UNKNOWN')}
                    className={`py-2 px-3 rounded-lg font-bold border text-center transition-all ${
                      switchVal === 'UNKNOWN'
                        ? 'bg-slate-700 text-white border-slate-800 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    KHÔNG XÁC ĐỊNH
                  </button>
                </div>
              )}
            </div>

            {/* 2. Trạng thái Vận hành (ACTIVE / INACTIVE / MAINTENANCE) */}
            <div className={`p-3 rounded-xl border transition-colors ${enableStatus ? 'bg-blue-50/50 border-blue-200' : 'bg-slate-50/50 border-slate-200 opacity-80'}`}>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer select-none font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={enableStatus}
                    onChange={e => setEnableStatus(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span>Trạng thái Vận hành Thiết bị</span>
                </label>
                {enableStatus && <span className="text-[10px] font-bold text-blue-600">ÁP DỤNG</span>}
              </div>
              {enableStatus && (
                <div className="grid grid-cols-3 gap-2 pl-6 mt-2">
                  <button
                    type="button"
                    onClick={() => setStatusVal('ACTIVE')}
                    className={`py-2 px-2 rounded-lg font-bold border text-center transition-all ${
                      statusVal === 'ACTIVE'
                        ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ĐANG VẬN HÀNH
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusVal('MAINTENANCE')}
                    className={`py-2 px-2 rounded-lg font-bold border text-center transition-all ${
                      statusVal === 'MAINTENANCE'
                        ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    BẢO DƯỠNG / SỬA CHỮA
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusVal('INACTIVE')}
                    className={`py-2 px-2 rounded-lg font-bold border text-center transition-all ${
                      statusVal === 'INACTIVE'
                        ? 'bg-slate-700 text-white border-slate-800 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    NGỪNG VẬN HÀNH
                  </button>
                </div>
              )}
            </div>

            {/* 3. SCADA Status */}
            <div className={`p-3 rounded-xl border transition-colors ${enableScada ? 'bg-blue-50/50 border-blue-200' : 'bg-slate-50/50 border-slate-200 opacity-80'}`}>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer select-none font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={enableScada}
                    onChange={e => setEnableScada(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span>Tín hiệu SCADA</span>
                </label>
                {enableScada && <span className="text-[10px] font-bold text-blue-600">ÁP DỤNG</span>}
              </div>
              {enableScada && (
                <div className="grid grid-cols-3 gap-2 pl-6 mt-2">
                  <button
                    type="button"
                    onClick={() => setScadaVal('SIGNAL')}
                    className={`py-2 px-3 rounded-lg font-bold border text-center transition-all flex items-center justify-center gap-1.5 ${
                      scadaVal === 'SIGNAL'
                        ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    CÓ TÍN HIỆU
                  </button>
                  <button
                    type="button"
                    onClick={() => setScadaVal('NO_SIGNAL')}
                    className={`py-2 px-3 rounded-lg font-bold border text-center transition-all flex items-center justify-center gap-1.5 ${
                      scadaVal === 'NO_SIGNAL'
                        ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    MẤT TÍN HIỆU
                  </button>
                  <button
                    type="button"
                    onClick={() => setScadaVal('UNKNOWN')}
                    className={`py-2 px-3 rounded-lg font-bold border text-center transition-all ${
                      scadaVal === 'UNKNOWN'
                        ? 'bg-slate-700 text-white border-slate-800 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    CHƯA RÕ
                  </button>
                </div>
              )}
            </div>

            {/* 4. Relay 79 & Battery */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Relay 79 */}
              <div className={`p-3 rounded-xl border transition-colors ${enableRelay79 ? 'bg-blue-50/50 border-blue-200' : 'bg-slate-50/50 border-slate-200 opacity-80'}`}>
                <label className="flex items-center gap-2 cursor-pointer select-none font-bold text-slate-800 mb-2">
                  <input
                    type="checkbox"
                    checked={enableRelay79}
                    onChange={e => setEnableRelay79(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span>Rơ le 79 (Tự đóng lại)</span>
                </label>
                {enableRelay79 && (
                  <div className="grid grid-cols-3 gap-1.5 pl-6 mt-1">
                    {['ON', 'OFF', 'N_A'].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setRelay79Val(v)}
                        className={`py-1.5 px-2 rounded-lg font-bold border text-center text-xs transition-all ${
                          relay79Val === v
                            ? 'bg-purple-600 text-white border-purple-700 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {v === 'ON' ? 'BẬT (ON)' : v === 'OFF' ? 'TẮT (OFF)' : 'N/A'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Battery Status */}
              <div className={`p-3 rounded-xl border transition-colors ${enableBattery ? 'bg-blue-50/50 border-blue-200' : 'bg-slate-50/50 border-slate-200 opacity-80'}`}>
                <label className="flex items-center gap-2 cursor-pointer select-none font-bold text-slate-800 mb-2">
                  <input
                    type="checkbox"
                    checked={enableBattery}
                    onChange={e => setEnableBattery(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span>Tình trạng Ắc quy (REC/LBS)</span>
                </label>
                {enableBattery && (
                  <select
                    value={batteryVal}
                    onChange={e => setBatteryVal(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-semibold text-slate-800 ml-6 max-w-[calc(100%-1.5rem)]"
                  >
                    <option value="GOOD">TỐT (Đạt chuẩn)</option>
                    <option value="WEAK">YẾU (Cần nạp/theo dõi)</option>
                    <option value="BROKEN">HỎNG (Cần thay thế khẩn)</option>
                    <option value="REPLACING">ĐANG THAY THẾ</option>
                    <option value="UNCHECKED">CHƯA KIỂM TRA</option>
                  </select>
                )}
              </div>
            </div>

            {/* 5. Ghi chú bổ sung */}
            <div className={`p-3 rounded-xl border transition-colors ${enableNotes ? 'bg-blue-50/50 border-blue-200' : 'bg-slate-50/50 border-slate-200 opacity-80'}`}>
              <label className="flex items-center gap-2 cursor-pointer select-none font-bold text-slate-800 mb-2">
                <input
                  type="checkbox"
                  checked={enableNotes}
                  onChange={e => setEnableNotes(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <span>Ghi chú thiết bị (Nối thêm vào ghi chú hiện có)</span>
              </label>
              {enableNotes && (
                <div className="pl-6">
                  <input
                    type="text"
                    placeholder="Nhập ghi chú cập nhật..."
                    value={notesVal}
                    onChange={e => setNotesVal(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>
              )}
            </div>

            {/* Reason / Audit Note */}
            <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1.5">
              <label className="block font-bold text-amber-900 text-xs">
                Lý do cập nhật / Nhật ký công tác (Bắt buộc để lưu vết Audit):
              </label>
              <input
                type="text"
                required
                placeholder="VD: Kiểm tra định kỳ tuyến 471, Cô lập phân đoạn bảo dưỡng LBS, Khắc phục lỗi SCADA..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full p-2.5 bg-white border border-amber-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-amber-600"
              />
            </div>
          </div>

          {/* Safety Notice */}
          <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-[11px]">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Lưu ý an toàn lưới điện:</strong> Thao tác cập nhật trạng thái đóng/cắt và SCADA hàng loạt sẽ được ghi lại trong lịch sử trạng thái thiết bị và nhật ký hệ thống kèm tài khoản thực hiện.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Đang cập nhật...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Xác nhận Cập nhật ({selectedDevices.length} TB)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
