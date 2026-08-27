import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet, Download, Printer, Filter, Layers, Zap,
  CheckCircle2, Clock, Shield, Search, RefreshCw, Eye, FileText, AlertCircle
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

type ReportType = 'loops' | 'devices' | 'device_status' | 'substations' | 'feeders' | 'tasks' | 'checklists' | 'proposals' | 'issues' | 'audit';

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ReportType>('loops');
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters state
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [team, setTeam] = useState('');
  const [substation, setSubstation] = useState('');
  const [feeder, setFeeder] = useState('');
  const [deviceType, setDeviceType] = useState('');
  const [status, setStatus] = useState('');

  // PDF Modal for Loop Topology
  const [selectedLoopForPdf, setSelectedLoopForPdf] = useState<any | null>(null);
  const [loopTopologyDetail, setLoopTopologyDetail] = useState<any | null>(null);
  const [loadingTopology, setLoadingTopology] = useState(false);

  // Reference lists for filters
  const [substationsList, setSubstationsList] = useState<any[]>([]);
  const [feedersList, setFeedersList] = useState<any[]>([]);

  useEffect(() => {
    // Load lookup data for filters
    api.getSubstations().then(res => { if (res.success) setSubstationsList(res.data); }).catch(() => {});
    api.getFeeders().then(res => { if (res.success) setFeedersList(res.data); }).catch(() => {});
  }, []);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await api.getReportData(activeTab, {
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        team: team || undefined,
        substation: substation || undefined,
        feeder: feeder || undefined,
        device_type: deviceType || undefined,
        status: status || undefined
      });
      if (res.success) {
        setReportData(res.data);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Không thể tải dữ liệu báo cáo (có thể do giới hạn quyền hạn)');
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [activeTab, fromDate, toDate, team, substation, feeder, deviceType, status]);

  const handleExportCsv = (filenamePrefix: string, data: any[]) => {
    if (!data || data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvRows = [];
    csvRows.push(headers.join(','));

    data.forEach(row => {
      const values = headers.map(header => {
        const val = row[header] === null || row[header] === undefined ? '' : row[header];
        const escaped = ('' + val).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    });

    const csvString = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Bao_Cao_${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const loadLoopTopologyDetail = async (loopId: number) => {
    try {
      setLoadingTopology(true);
      const res = await api.getLoopTopologyReport(loopId);
      if (res.success) {
        setLoopTopologyDetail(res.data);
        setSelectedLoopForPdf(res.data.loop);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Lỗi khi tải chi tiết mạch');
    } finally {
      setLoadingTopology(false);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const filteredData = reportData.filter(item => {
    if (!search) return true;
    const str = JSON.stringify(item).toLowerCase();
    return str.includes(search.toLowerCase());
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Printable Area Specific Styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-loop-report, #printable-loop-report * { visibility: visible; }
          #printable-loop-report { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-sky-600 dark:text-sky-400" />
            Trung Tâm Báo Cáo & Thống Kê
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Xuất báo cáo Trạm 110kV, Phát tuyến, Thiết bị, Khép vòng, Công việc, Đề xuất và Định kỳ chuẩn SCADA
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleExportCsv(activeTab, filteredData)}
            disabled={filteredData.length === 0}
            className="no-print inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            [XUẤT EXCEL] ({filteredData.length})
          </button>
          <button
            onClick={handlePrintPdf}
            className="no-print inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow transition-all"
          >
            <Printer className="w-4 h-4" />
            [XUẤT PDF]
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="no-print flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
        {[
          { id: 'loops', label: 'Khép Vòng' },
          { id: 'devices', label: 'Thiết Bị' },
          { id: 'device_status', label: 'Trạng Thái Thiết Bị' },
          { id: 'substations', label: 'Trạm 110kV' },
          { id: 'feeders', label: 'Phát Tuyến' },
          { id: 'tasks', label: 'Công Việc' },
          { id: 'proposals', label: 'Đề Xuất Thiết Bị' },
          { id: 'checklists', label: 'Kiểm Tra Định Kỳ' },
          { id: 'issues', label: 'Bất Thường' },
          { id: 'audit', label: 'Nhật Ký Audit' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ReportType)}
            className={`px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-sky-600 text-white shadow'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Advanced Filters Bar */}
      <div className="no-print bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-sky-600" />
            Bộ lọc báo cáo chuyên sâu
          </span>
          <button
            onClick={() => {
              setFromDate('');
              setToDate('');
              setTeam('');
              setSubstation('');
              setFeeder('');
              setDeviceType('');
              setStatus('');
              setSearch('');
            }}
            className="text-[11px] text-sky-600 hover:underline font-semibold"
          >
            Xóa bộ lọc
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
          {/* From Date */}
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Từ ngày</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Đến ngày</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
            />
          </div>

          {/* Unit / Team */}
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Đơn vị / Đội</label>
            <select
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
            >
              <option value="">Tất cả đơn vị</option>
              <option value="ĐỘI VẬN HÀNH LƯỚI ĐIỆN">Đội Vận Hành Lưới Điện</option>
              <option value="ĐỘI ĐIỀU ĐỘ">Đội Điều Độ</option>
              <option value="ĐỘI THÍ NGHIỆM">Đội Thí Nghiệm</option>
            </select>
          </div>

          {/* Substation */}
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Trạm 110kV</label>
            <select
              value={substation}
              onChange={(e) => setSubstation(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
            >
              <option value="">Tất cả trạm</option>
              {substationsList.map(s => (
                <option key={s.id} value={s.substation_code}>{s.substation_code} - {s.name}</option>
              ))}
            </select>
          </div>

          {/* Feeder */}
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Phát tuyến</label>
            <select
              value={feeder}
              onChange={(e) => setFeeder(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
            >
              <option value="">Tất cả phát tuyến</option>
              {feedersList.map(f => (
                <option key={f.id} value={f.feeder_code}>{f.feeder_code} - {f.name}</option>
              ))}
            </select>
          </div>

          {/* Device Type */}
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Loại thiết bị</label>
            <select
              value={deviceType}
              onChange={(e) => setDeviceType(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
            >
              <option value="">Tất cả loại</option>
              <option value="LBS">LBS (Cầu dao phụ tải)</option>
              <option value="REC">REC (Recloser)</option>
              <option value="DS">DS (Cầu dao cách ly)</option>
              <option value="RMU">RMU</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm kiếm nhanh trong bảng báo cáo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <button
            onClick={fetchReportData}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Lọc & Tải Dữ Liệu
          </button>
        </div>
      </div>

      {/* Error message banner */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Table Content */}
      <div className="no-print bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Đang tổng hợp dữ liệu báo cáo...</div>
        ) : filteredData.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">Không có dữ liệu thỏa điều kiện</div>
        ) : (
          <div className="overflow-x-auto max-h-[550px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold sticky top-0 z-10">
                  {Object.keys(filteredData[0]).map((col) => (
                    <th key={col} className="p-3 uppercase tracking-wider text-[10px]">
                      {col.replace(/_/g, ' ')}
                    </th>
                  ))}
                  {activeTab === 'loops' && <th className="p-3 text-right">Thao Tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    {Object.entries(row).map(([key, val]: [string, any], cIdx) => (
                      <td key={cIdx} className="p-3 font-mono text-slate-700 dark:text-slate-300 max-w-xs truncate">
                        {val === null || val === undefined ? '-' : String(val)}
                      </td>
                    ))}
                    {activeTab === 'loops' && (
                      <td className="p-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => loadLoopTopologyDetail(row.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-300 font-semibold rounded hover:bg-sky-100 transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Xem Báo Cáo PDF
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RING LOOP TOPOLOGY PRINTABLE PDF MODAL */}
      {selectedLoopForPdf && loopTopologyDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-2xl max-w-4xl w-full p-8 shadow-2xl border border-slate-200 relative my-8">
            <div className="no-print flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
              <span className="text-xs font-bold text-sky-700 uppercase tracking-widest">
                XEM TRƯỚC BÁO CÁO MẠCH KHÉP VÒNG TOPOLOGY
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintPdf}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white font-bold rounded-xl text-xs hover:bg-sky-700 shadow"
                >
                  <Printer className="w-4 h-4" />
                  In / Xuất PDF
                </button>
                <button
                  onClick={() => {
                    setSelectedLoopForPdf(null);
                    setLoopTopologyDetail(null);
                  }}
                  className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold hover:bg-slate-100"
                >
                  Đóng
                </button>
              </div>
            </div>

            {/* PRINTABLE AREA */}
            <div id="printable-loop-report" className="space-y-6 text-slate-900">
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                <div>
                  <h4 className="font-bold text-sm text-slate-800">TỔNG CÔNG TY ĐIỆN LỰC MIỀN NAM</h4>
                  <p className="text-xs font-semibold text-slate-600">CÔNG TY ĐIỆN LỰC ĐỒNG NAI</p>
                  <p className="text-[10px] text-slate-500">Phòng Điều Độ - Giám Sát Lưới Điện Khép Vòng</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-slate-900">MÃ SỐ: BC-KV-{loopTopologyDetail.loop.loop_code}</span>
                  <p className="text-[10px] text-slate-500 mt-0.5">Ngày xuất: {new Date().toLocaleDateString('vi-VN')}</p>
                </div>
              </div>

              <div className="text-center py-2">
                <h2 className="text-xl font-black uppercase text-slate-900 tracking-wide">
                  BÁO CÁO PHƯƠNG THỨC KHÉP VÒNG TOPOLOGY
                </h2>
                <p className="text-xs font-bold text-sky-800 mt-1">
                  Mạch Khép Vòng: {loopTopologyDetail.loop.name} ({loopTopologyDetail.loop.loop_code})
                </p>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs font-bold text-center flex items-center justify-center gap-2">
                <Shield className="w-4 h-4 text-amber-600" />
                <span>CHÚ Ý: DỮ LIỆU SCADA TRÊN SƠ ĐỒ CHỈ ĐỂ GIÁM SÁT HIỂN THỊ. KHÔNG CÓ BẤT KỲ CHỨC NĂNG ĐIỀU KHIỂN NÀO.</span>
              </div>

              <div className="p-6 border-2 border-slate-900 rounded-xl bg-slate-50 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 text-center">
                  SƠ ĐỒ CHUYỂN TẢI TOPOLOGY LIÊN KẾT MẠCH
                </h4>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center text-xs">
                  <div className="p-3 bg-white border border-slate-400 rounded-lg shadow-sm flex-1">
                    <span className="text-[10px] font-bold text-slate-400 block">TRẠM BÀN GIAO A</span>
                    <p className="font-bold text-slate-900">{loopTopologyDetail.topologyPipeline.station_a.name}</p>
                    <p className="text-[10px] text-slate-500">{loopTopologyDetail.topologyPipeline.station_a.code}</p>
                  </div>

                  <span className="font-bold text-slate-400 text-sm">➔</span>

                  <div className="p-3 bg-white border border-slate-400 rounded-lg shadow-sm flex-1">
                    <span className="text-[10px] font-bold text-sky-600 block">PHÁT TUYẾN A</span>
                    <p className="font-bold text-slate-900">{loopTopologyDetail.topologyPipeline.feeder_a.code}</p>
                  </div>

                  <span className="font-bold text-slate-400 text-sm">➔</span>

                  <div className="p-4 bg-sky-950 text-white rounded-xl shadow-md border-2 border-sky-400 flex-1">
                    <span className="text-[10px] font-bold text-sky-300 block uppercase">ĐIỂM MẠCH KHÉP VÒNG</span>
                    <p className="font-bold text-sm text-amber-300">{loopTopologyDetail.topologyPipeline.loop_point.loop_code}</p>
                    <div className="mt-2 text-[10px] space-y-0.5 text-slate-200">
                      <p>Trạng thái: <strong className="text-emerald-400">{loopTopologyDetail.topologyPipeline.loop_point.status}</strong></p>
                      <p>SCADA: <strong className="text-sky-300">{loopTopologyDetail.topologyPipeline.loop_point.scada_status}</strong></p>
                      <p>Rơle 79: <strong className="text-amber-400">{loopTopologyDetail.topologyPipeline.loop_point.relay_79}</strong></p>
                    </div>
                  </div>

                  <span className="font-bold text-slate-400 text-sm">➔</span>

                  <div className="p-3 bg-white border border-slate-400 rounded-lg shadow-sm flex-1">
                    <span className="text-[10px] font-bold text-sky-600 block">PHÁT TUYẾN B</span>
                    <p className="font-bold text-slate-900">{loopTopologyDetail.topologyPipeline.feeder_b.code}</p>
                  </div>

                  <span className="font-bold text-slate-400 text-sm">➔</span>

                  <div className="p-3 bg-white border border-slate-400 rounded-lg shadow-sm flex-1">
                    <span className="text-[10px] font-bold text-slate-400 block">TRẠM BÀN GIAO B</span>
                    <p className="font-bold text-slate-900">{loopTopologyDetail.topologyPipeline.station_b.name}</p>
                    <p className="text-[10px] text-slate-500">{loopTopologyDetail.topologyPipeline.station_b.code}</p>
                  </div>
                </div>
              </div>

              <div className="border border-slate-300 rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <tbody>
                    <tr className="border-b border-slate-200 bg-slate-100 font-bold">
                      <td className="p-2.5 w-1/4">Phiên bản Topology:</td>
                      <td className="p-2.5 w-1/4 font-mono">{loopTopologyDetail.loop.version || 'v1.0'}</td>
                      <td className="p-2.5 w-1/4">Trạng thái phê duyệt:</td>
                      <td className="p-2.5 w-1/4 text-emerald-700 font-bold">{loopTopologyDetail.loop.approval_status}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2.5 font-bold">Người phê duyệt:</td>
                      <td className="p-2.5">{loopTopologyDetail.loop.approved_by || 'Kỹ Sư Điều Độ Phương Thức'}</td>
                      <td className="p-2.5 font-bold">Thời gian phê duyệt:</td>
                      <td className="p-2.5">{loopTopologyDetail.loop.approved_at || new Date().toLocaleString('vi-VN')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 text-center text-xs pt-8">
                <div>
                  <p className="font-bold uppercase text-slate-800">CÁN BỘ LẬP BÁO CÁO</p>
                  <p className="text-[10px] text-slate-500 mb-12">(Ký và ghi rõ họ tên)</p>
                  <p className="font-bold text-slate-900">{loopTopologyDetail.meta.exported_by}</p>
                </div>
                <div>
                  <p className="font-bold uppercase text-slate-800">TRƯỞNG PHÒNG ĐIỀU ĐỘ</p>
                  <p className="text-[10px] text-slate-500 mb-12">(Ký duyệt và đóng dấu)</p>
                  <p className="font-bold text-slate-900">KS. Nguyễn Văn An</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
