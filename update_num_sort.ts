import fs from 'fs';

let content = fs.readFileSync('src/pages/DevicesPage.tsx', 'utf8');

// Update sorting logic to support numeric/value sorting if numeric values exist (like pole_number, voltage, or custom numeric fields)
const updatedSortingMemo = `
  const sortedDevices = React.useMemo(() => {
    return [...devices].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';
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
      } else if (sortBy === 'pole_number') {
        valA = a.pole_number || '';
        valB = b.pole_number || '';
      } else {
        valA = String(a.id || '');
        valB = String(b.id || '');
      }

      // Check if both values are purely numeric or can be parsed as numbers
      const numA = parseFloat(valA);
      const numB = parseFloat(valB);
      if (!isNaN(numA) && !isNaN(numB) && String(valA).trim() !== '' && String(valB).trim() !== '') {
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      }

      const cmp = String(valA).localeCompare(String(valB), 'vi', { numeric: true, sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [devices, sortBy, sortOrder]);
`;

// Replace old sortedDevices memo
const startIdx = content.indexOf('const sortedDevices = React.useMemo(() => {');
const endIdx = content.indexOf('}, [devices, sortBy, sortOrder]);');

if (startIdx !== -1 && endIdx !== -1) {
  content = content.substring(0, startIdx) + updatedSortingMemo + content.substring(endIdx + 33);
}

// Update select options to include pole_number (Vị trí trụ / Số thứ tự)
content = content.replace(
  /<option value="battery_status">Tình trạng ắc quy<\/option>/,
  `<option value="battery_status">Tình trạng ắc quy</option>\n            <option value="pole_number">Số trụ / Giá trị số (Numerical)</option>`
);

fs.writeFileSync('src/pages/DevicesPage.tsx', content);
console.log('Updated numeric sort successfully');
