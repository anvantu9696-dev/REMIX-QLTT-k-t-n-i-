import fs from 'fs';

let content = fs.readFileSync('src/pages/DevicesPage.tsx', 'utf8');

// 1. Add sort states after batteryFilter
content = content.replace(
  /const \[batteryFilter, setBatteryFilter\] = useState\(''\);/,
  `const [batteryFilter, setBatteryFilter] = useState('');\n  const [sortBy, setSortBy] = useState<string>('device_id');\n  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');`
);

// 2. Add sortedDevices memo right after fetchDevices or before selection handlers
const sortedDevicesMemo = `
  const sortedDevices = React.useMemo(() => {
    return [...devices].sort((a, b) => {
      let valA = '';
      let valB = '';
      if (sortBy === 'device_id') {
        valA = a.device_id || '';
        valB = b.device_id || '';
      } else if (sortBy === 'name') {
        valA = a.name || '';
        valB = b.name || '';
      } else if (sortBy === 'device_type') {
        valA = a.device_type || '';
        valB = b.device_type || '';
      } else if (sortBy === 'switch_status') {
        valA = a.switch_status || '';
        valB = b.switch_status || '';
      } else if (sortBy === 'scada_status') {
        valA = a.scada_status || '';
        valB = b.scada_status || '';
      } else if (sortBy === 'battery_status') {
        valA = a.battery_status || '';
        valB = b.battery_status || '';
      } else {
        valA = String(a.id || '');
        valB = String(b.id || '');
      }

      const cmp = valA.localeCompare(valB, 'vi', { numeric: true, sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [devices, sortBy, sortOrder]);

  const handleSortField = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };
`;

content = content.replace(
  /\/\/ Bulk Selection Handlers/,
  sortedDevicesMemo + '\n  // Bulk Selection Handlers'
);

// 3. Replace devices with sortedDevices in selection & rendering
content = content.replace(
  /const isAllSelected = devices\.length > 0 && devices\.every\(d => selectedIds\.includes\(d\.id\)\);/,
  `const isAllSelected = sortedDevices.length > 0 && sortedDevices.every(d => selectedIds.includes(d.id));`
);

content = content.replace(
  /const isIndeterminate = devices\.some\(d => selectedIds\.includes\(d\.id\)\) && !isAllSelected;/,
  `const isIndeterminate = sortedDevices.some(d => selectedIds.includes(d.id)) && !isAllSelected;`
);

content = content.replace(
  /setSelectedIds\(devices\.map\(d => d\.id\)\);/g,
  `setSelectedIds(sortedDevices.map(d => d.id));`
);

content = content.replace(
  /totalFilteredCount=\{devices\.length\}/g,
  `totalFilteredCount={sortedDevices.length}`
);

content = content.replace(
  /Hiển thị \{devices\.length\} \/ \{totalDevicesCount \|\| devices\.length\} thiết bị/,
  `Hiển thị {sortedDevices.length} / {totalDevicesCount || devices.length} thiết bị`
);

content = content.replace(
  /loading \? \([\s\S]*?\) : devices\.length === 0 \?/,
  (match) => match.replace('devices.length', 'sortedDevices.length')
);

// Replace devices.map in table view
content = content.replace(
  /\{devices\.map\(device => \{/,
  `{sortedDevices.map(device => {`
);

// Replace devices.map in card view
content = content.replace(
  /\{devices\.map\(device => \(/,
  `{sortedDevices.map(device => (`
);

// 4. Add Sort Toolbar right below the filter toolbar
const sortToolbar = `
      {/* Sort & Quick Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 rounded-xl border border-slate-200 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Sắp xếp theo:</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="device_id">Mã thiết bị (DEVICE_ID)</option>
            <option value="name">Tên thiết bị</option>
            <option value="device_type">Loại thiết bị</option>
            <option value="switch_status">Trạng thái Đóng/Cắt</option>
            <option value="scada_status">Tín hiệu SCADA</option>
            <option value="battery_status">Tình trạng ắc quy</option>
          </select>
          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg font-bold text-slate-700 transition-colors flex items-center gap-1"
            title="Đổi chiều sắp xếp"
          >
            {sortOrder === 'asc' ? 'Tăng dần (A-Z) ▲' : 'Giảm dần (Z-A) ▼'}
          </button>
        </div>
        <div className="text-slate-500 font-medium">
          Đang hiển thị <span className="font-bold text-slate-800">{sortedDevices.length}</span> kết quả đã lọc
        </div>
      </div>
`;

content = content.replace(
  /\{\/\* Bulk Actions Toolbar \*\/\}/,
  sortToolbar + '\n      {/* Bulk Actions Toolbar */}'
);

fs.writeFileSync('src/pages/DevicesPage.tsx', content);
console.log('Updated DevicesPage.tsx successfully');
