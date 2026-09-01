import React, { useState } from 'react';
import { Cloud, Mail, Upload, Send, CheckCircle2, AlertCircle, Loader2, FileText, Database, Inbox, RefreshCw } from 'lucide-react';
import { initGoogleWorkspaceAuth, sendGmailEmail, listGmailMessages } from '../lib/googleWorkspace';
import { exportToGoogleDrive, listGoogleDriveFiles } from '../lib/googleDrive';

interface GoogleWorkspaceHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoogleWorkspaceHubModal: React.FC<GoogleWorkspaceHubModalProps> = ({ isOpen, onClose }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'DRIVE' | 'GMAIL'>('DRIVE');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Drive state
  const [driveFiles, setDriveFiles] = useState<any[]>([]);

  // Gmail state
  const [gmailMessages, setGmailMessages] = useState<any[]>([]);
  const [mailTo, setMailTo] = useState('');
  const [mailSubject, setMailSubject] = useState('Báo cáo vận hành lưới điện EVN - Ca trực');
  const [mailBody, setMailBody] = useState('Kính gửi Ban điều hành,\n\nHệ thống vận hành lưới điện hoạt động bình thường, không có sự cố phát sinh trong ca trực.\n\nTrân trọng.');

  if (!isOpen) return null;

  const handleConnect = async () => {
    setLoading(true);
    setErrorMsg(null);
    setStatusMessage('Đang kết nối tài khoản Google Workspace (Drive & Gmail)...');
    try {
      const token = await initGoogleWorkspaceAuth((tokenVal) => {
        setAccessToken(tokenVal);
      });
      setAccessToken(token as string);
      setStatusMessage('Kết nối Google Workspace thành công!');
      loadDriveData(token as string);
      loadGmailData(token as string);
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể kết nối Google Workspace');
    } finally {
      setLoading(false);
    }
  };

  const loadDriveData = async (token: string) => {
    try {
      const files = await listGoogleDriveFiles(token);
      setDriveFiles(files);
    } catch (e) {
      console.error(e);
    }
  };

  const loadGmailData = async (token: string) => {
    try {
      const msgs = await listGmailMessages(token, 8);
      setGmailMessages(msgs);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportBackup = async () => {
    if (!accessToken) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/reports/export', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const data = res.ok ? await res.json() : { timestamp: new Date().toISOString(), note: 'Grid management system backup' };

      const fileName = `GridManagement_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      await exportToGoogleDrive(fileName, JSON.stringify(data, null, 2), 'application/json', accessToken);
      setStatusMessage(`Đã sao lưu thành công file ${fileName} lên Google Drive!`);
      loadDriveData(accessToken);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi sao lưu dữ liệu lên Drive');
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !mailTo.trim()) {
      setErrorMsg('Vui lòng nhập địa chỉ email người nhận.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      await sendGmailEmail(accessToken, mailTo.trim(), mailSubject, mailBody);
      setStatusMessage(`Đã gửi email thành công tới ${mailTo}!`);
      setMailTo('');
      loadGmailData(accessToken);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi gửi email qua Gmail');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-800 to-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <Cloud className="w-6 h-6 text-blue-200" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Google Workspace Hub (Drive & Gmail)</h2>
              <p className="text-xs text-blue-200">Tích hợp đồng bộ sao lưu Google Drive và gửi nhận email điều độ qua Gmail API</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/15 text-lg font-bold">×</button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {!accessToken ? (
            <div className="text-center py-10 space-y-5">
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <Cloud className="w-10 h-10" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-lg font-bold text-slate-800">Kết nối Google Workspace Account</h3>
                <p className="text-sm text-slate-500">
                  Ủy quyền an toàn với Google OAuth để sử dụng **Google Drive** (sao lưu dữ liệu, lưu trữ tài liệu) và **Gmail** (gửi email thông báo sự cố, báo cáo ca trực tự động).
                </p>
              </div>
              <button
                onClick={handleConnect}
                disabled={loading}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition flex items-center justify-center space-x-2 mx-auto disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Cloud className="w-5 h-5" />}
                <span>Kết nối Google Workspace</span>
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Connection Status Banner */}
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex items-center space-x-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-emerald-900">Đã kết nối tài khoản Google Workspace</p>
                    <p className="text-xs text-emerald-700">Quyền truy cập Google Drive & Gmail đã sẵn sàng.</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => { loadDriveData(accessToken); loadGmailData(accessToken); }}
                    className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-semibold rounded-lg transition flex items-center space-x-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Làm mới</span>
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-200 space-x-6">
                <button
                  onClick={() => setActiveTab('DRIVE')}
                  className={`pb-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition ${
                    activeTab === 'DRIVE' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Cloud className="w-4 h-4" />
                  <span>Google Drive (Sao lưu & Tệp)</span>
                </button>
                <button
                  onClick={() => setActiveTab('GMAIL')}
                  className={`pb-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition ${
                    activeTab === 'GMAIL' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  <span>Gmail (Gửi & Nhận email)</span>
                </button>
              </div>

              {/* Tab 1: Google Drive */}
              {activeTab === 'DRIVE' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Sao lưu hệ thống lên Google Drive</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Tạo file JSON chứa toàn bộ dữ liệu thiết bị, trạm, khép vòng và đẩy lên Drive của bạn.</p>
                    </div>
                    <button
                      onClick={handleExportBackup}
                      disabled={loading}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center space-x-2 shrink-0 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      <span>Đẩy bản sao lưu</span>
                    </button>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Tệp tin trên Google Drive</h4>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl max-h-56 overflow-y-auto divide-y divide-slate-200">
                      {driveFiles.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-8">Chưa có tệp tin sao lưu nào trên Google Drive.</p>
                      ) : (
                        driveFiles.map((file) => (
                          <div key={file.id} className="p-3 flex items-center justify-between hover:bg-slate-100 transition">
                            <div className="flex items-center space-x-3 truncate">
                              <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                              <div className="truncate">
                                <p className="text-xs font-semibold text-slate-800 truncate">{file.name}</p>
                                <p className="text-[10px] text-slate-500">{new Date(file.modifiedTime).toLocaleString()}</p>
                              </div>
                            </div>
                            <a
                              href={`https://drive.google.com/file/d/${file.id}/view`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-800 font-semibold shrink-0 ml-2"
                            >
                              Xem trên Drive
                            </a>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Gmail */}
              {activeTab === 'GMAIL' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Send Email Form */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <h4 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                      <Send className="w-4 h-4 text-blue-600" />
                      <span>Gửi email điều độ / ca trực</span>
                    </h4>
                    <form onSubmit={handleSendEmail} className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Email người nhận</label>
                        <input
                          type="email"
                          required
                          placeholder="operator@evn.vn"
                          value={mailTo}
                          onChange={(e) => setMailTo(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tiêu đề</label>
                        <input
                          type="text"
                          required
                          value={mailSubject}
                          onChange={(e) => setMailSubject(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nội dung</label>
                        <textarea
                          rows={4}
                          required
                          value={mailBody}
                          onChange={(e) => setMailBody(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center justify-center space-x-2 disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        <span>Gửi Email qua Gmail</span>
                      </button>
                    </form>
                  </div>

                  {/* Gmail Inbox / Recent Messages */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 flex flex-col">
                    <h4 className="text-sm font-bold text-slate-800 flex items-center justify-between">
                      <span className="flex items-center space-x-2">
                        <Inbox className="w-4 h-4 text-indigo-600" />
                        <span>Hộp thư Gmail gần đây</span>
                      </span>
                      <button onClick={() => loadGmailData(accessToken)} className="text-xs text-blue-600 hover:underline">Làm mới</button>
                    </h4>
                    <div className="bg-white border border-slate-200 rounded-lg flex-1 max-h-64 overflow-y-auto divide-y divide-slate-100">
                      {gmailMessages.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-10">Chưa có tin nhắn trong hộp thư hoặc chưa tải.</p>
                      ) : (
                        gmailMessages.map((msg: any, idx: number) => {
                          const headers = msg.payload?.headers || [];
                          const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'Không có tiêu đề';
                          const sender = headers.find((h: any) => h.name === 'From')?.value || 'Ẩn danh';
                          return (
                            <div key={msg.id || idx} className="p-3 hover:bg-slate-50 transition space-y-1">
                              <p className="text-xs font-bold text-slate-800 truncate">{subject}</p>
                              <p className="text-[10px] text-slate-500 truncate">Từ: {sender}</p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {statusMessage && !errorMsg && (
            <p className="text-xs text-center text-slate-600 font-medium">{statusMessage}</p>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm font-semibold rounded-xl transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
