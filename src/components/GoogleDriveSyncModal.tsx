import React, { useState } from 'react';
import { Cloud, Download, Upload, CheckCircle2, AlertCircle, Loader2, FileText, Database } from 'lucide-react';
import { initGoogleDriveAuth, exportToGoogleDrive, listGoogleDriveFiles } from '../lib/googleDrive';

interface GoogleDriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoogleDriveSyncModal: React.FC<GoogleDriveSyncModalProps> = ({ isOpen, onClose }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [files, setFiles] = useState<any[]>([]);

  if (!isOpen) return null;

  const handleConnect = async () => {
    setLoading(true);
    setErrorMsg(null);
    setStatusMessage('Đang kết nối Google Drive...');
    try {
      const token = await initGoogleDriveAuth((tokenVal) => {
        setAccessToken(tokenVal);
      });
      setAccessToken(token as string);
      setStatusMessage('Kết nối Google Drive thành công!');
      loadFiles(token as string);
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể kết nối Google Drive');
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async (token: string) => {
    try {
      const fileList = await listGoogleDriveFiles(token);
      setFiles(fileList);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleExportBackup = async () => {
    if (!accessToken) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      // Fetch system export data
      const res = await fetch('/api/reports/export', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const data = res.ok ? await res.json() : { timestamp: new Date().toISOString(), note: 'Grid management system backup' };

      const fileName = `GridManagement_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      await exportToGoogleDrive(fileName, JSON.stringify(data, null, 2), 'application/json', accessToken);
      setStatusMessage(`Đã sao lưu thành công file ${fileName} lên Google Drive!`);
      loadFiles(accessToken);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi sao lưu dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200">
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/10 rounded-lg">
              <Cloud className="w-6 h-6 text-blue-200" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Google Drive & Cloud Sync</h2>
              <p className="text-xs text-blue-200">Đồng bộ dữ liệu lưới điện và sao lưu tự động lên Google Drive</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/15 text-lg font-bold">×</button>
        </div>

        <div className="p-6 space-y-6">
          {!accessToken ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <Database className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-800">Kết nối tài khoản Google Drive</h3>
                <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
                  Cho phép ứng dụng lưu trữ bản sao lưu dữ liệu, báo cáo vận hành và tài liệu kỹ thuật lên Google Drive của bạn.
                </p>
              </div>
              <button
                onClick={handleConnect}
                disabled={loading}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition flex items-center justify-center space-x-2 mx-auto disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Cloud className="w-5 h-5" />}
                <span>Kết nối Google Drive</span>
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">Đã kết nối Google Drive thành công</p>
                    <p className="text-xs text-emerald-700">Tài khoản Google đã được cấp quyền truy cập an toàn.</p>
                  </div>
                </div>
                <button
                  onClick={handleExportBackup}
                  disabled={loading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-xs transition flex items-center space-x-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span>Sao lưu ngay</span>
                </button>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center justify-between">
                  <span>Tệp tin gần đây trên Google Drive</span>
                  <button onClick={() => loadFiles(accessToken)} className="text-xs text-blue-600 hover:underline">Làm mới</button>
                </h4>
                <div className="bg-slate-50 border border-slate-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-200">
                  {files.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">Chưa có tệp tin nào được đồng bộ.</p>
                  ) : (
                    files.map((file) => (
                      <div key={file.id} className="p-3 flex items-center justify-between hover:bg-slate-100/80 transition">
                        <div className="flex items-center space-x-3 truncate">
                          <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                          <div className="truncate">
                            <p className="text-xs font-medium text-slate-800 truncate">{file.name}</p>
                            <p className="text-[10px] text-slate-500">{new Date(file.modifiedTime).toLocaleString()}</p>
                          </div>
                        </div>
                        <a
                          href={`https://drive.google.com/file/d/${file.id}/view`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium shrink-0 ml-2"
                        >
                          Xem
                        </a>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {statusMessage && !errorMsg && (
            <p className="text-xs text-center text-slate-500">{statusMessage}</p>
          )}
        </div>

        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm font-medium rounded-lg transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
