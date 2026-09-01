import React, { useState, useEffect } from 'react';
import { FileText, Plus, Search, Download, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { DocumentItem } from '../types';
import { formatDate } from '../utils/dateTime';

export const DocumentsPage: React.FC = () => {
  const { hasRole, isGuest } = useAuth();
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('Quy trình vận hành');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchDocs();
  }, []);

  const fetchDocs = async () => {
    try {
      const res = await api.getDocuments();
      if (res.success) {
        setDocs(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.createDocument({
        title,
        document_code: code,
        category,
        file_url: '/docs/sample.pdf'
      });
      setTitle('');
      setCode('');
      setAddModalOpen(false);
      fetchDocs();
    } catch (err: any) {
      alert(err.message || 'Thêm tài liệu thất bại');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredDocs = docs.filter(
    (d) =>
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.document_code.toLowerCase().includes(search.toLowerCase()) ||
      d.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            Tài liệu & Quy trình Kỹ thuật Vận hành
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Tra cứu quy trình vận hành lưới điện 110kV-22kV, tiêu chuẩn kỹ thuật thiết bị và sơ đồ kết lưới.
          </p>
        </div>

        {(hasRole('ADMIN') || hasRole('MANAGER')) && !isGuest() && (
          <button
            onClick={() => setAddModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md flex items-center space-x-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Tài liệu Mới</span>
          </button>
        )}
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative w-full max-w-md text-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tài liệu theo Mã, Tiêu đề hoặc Danh mục..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-900 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
        {loading ? (
          <p className="col-span-full p-8 text-center text-slate-500">Đang tải danh mục tài liệu...</p>
        ) : filteredDocs.length === 0 ? (
          <p className="col-span-full p-8 text-center text-slate-500">Không tìm thấy tài liệu phù hợp</p>
        ) : (
          filteredDocs.map((doc) => (
            <div key={doc.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded text-[10px] border border-blue-100">
                    {doc.category}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{doc.document_code}</span>
                </div>
                <h3 className="font-bold text-slate-900 text-sm leading-snug">{doc.title}</h3>
                <p className="text-[11px] text-slate-400 mt-2">Đăng bởi: {doc.created_by}</p>
              </div>

              <div className="pt-3 border-t flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-mono">
                  {formatDate(doc.created_at)}
                </span>
                <a
                  href={doc.file_url}
                  onClick={(e) => {
                    e.preventDefault();
                    alert(`Đang tải tập tin văn bản: ${doc.title} (${doc.document_code})`);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải về PDF</span>
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      {addModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">Thêm Tài liệu / Quy trình Mới</h3>
              <button onClick={() => setAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDoc} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Mã Văn bản *</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="QT-2026-02"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tên / Tiêu đề Văn bản *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Quy trình Kiểm tra Trạm biến áp 110kV"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Danh mục *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                >
                  <option value="Quy trình vận hành">Quy trình vận hành</option>
                  <option value="Tiêu chuẩn kỹ thuật">Tiêu chuẩn kỹ thuật</option>
                  <option value="Sơ đồ kết lưới">Sơ đồ kết lưới</option>
                  <option value="An toàn điện">An toàn điện</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
                >
                  {actionLoading ? 'Đang lưu...' : 'Tải lên Tài liệu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
