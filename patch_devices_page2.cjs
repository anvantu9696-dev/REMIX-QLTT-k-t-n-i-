const fs = require('fs');
let code = fs.readFileSync('src/pages/DevicesPage.tsx', 'utf8');

// 1. imports
code = code.replace(
  "import React, { useState, useEffect, useCallback } from 'react';",
  "import React, { useState, useEffect, useCallback, useRef } from 'react';"
);

// 2. add refs and formFeeders
code = code.replace(
  "  const [loadingMore, setLoadingMore] = useState(false);",
  "  const [loadingMore, setLoadingMore] = useState(false);\n  const feedersCache = useRef<Record<string, Feeder[]>>({});\n  const [formFeeders, setFormFeeders] = useState<Feeder[]>([]);"
);

// 3. fetchFeedersBySubstation
const fetchFeedersFunc = `
  const fetchFeedersBySubstation = async (subId: string) => {
    if (!subId) {
      setFormFeeders([]);
      return;
    }
    if (feedersCache.current[subId]) {
      setFormFeeders(feedersCache.current[subId]);
      return;
    }
    try {
      const res = await api.getFeeders({ substation_id: subId, limit: 100 });
      if (res.success) {
        feedersCache.current[subId] = res.data;
        setFormFeeders(res.data);
      }
    } catch (e) {
      console.error('Lỗi tải phát tuyến:', e);
    }
  };
`;
code = code.replace(
  "  const fetchMetadata = async",
  fetchFeedersFunc + "\n  const fetchMetadata = async"
);

// 4. Remove getFeeders from fetchMetadata
code = code.replace(
  "        api.getFeeders(undefined, options)",
  "        // api.getFeeders removed"
);
code = code.replace(
  "      if (fdRes.success) setFeeders(fdRes.data);",
  "      // setFeeders removed"
);

// 5. Filter logic: fetch feeders for stationFilter
const filterEffect = `
  useEffect(() => {
    if (stationFilter) {
      api.getFeeders({ substation_id: stationFilter, limit: 100 }).then(res => {
        if (res.success) setFeeders(res.data);
      });
    } else {
      setFeeders([]);
    }
  }, [stationFilter]);
`;
code = code.replace(
  "  useEffect(() => {\n    fetchDevices({ limit: 10 });",
  filterEffect + "\n  useEffect(() => {\n    fetchDevices({ limit: 10 });"
);

// 6. HandleEdit:
// Replace handleEdit
code = code.replace(
  "  const handleEdit = (device: Device) => {",
  `  const handleEdit = async (device: Device) => {
    if (device.substation_id) {
      await fetchFeedersBySubstation(String(device.substation_id));
    } else {
      setFormFeeders([]);
    }
`
);

// 7. select station inside form
// We need to carefully replace just the single select inside the device form!
// The device form is rendered inside the isFormOpen modal.
/*
                  <label className="block font-bold text-slate-700 mb-1">Trạm 110kV</label>
                  <select
                    value={formData.substation_id}
                    onChange={e => {
                      const newSubId = e.target.value;
                      setFormData(prev => ({ 
                        ...prev, 
                        substation_id: newSubId, 
                        feeder_id: '' 
                      }));
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                  >
*/
const formSelectStr = `                  <label className="block font-bold text-slate-700 mb-1">Trạm 110kV</label>
                  <select
                    value={formData.substation_id}
                    onChange={e => {
                      const newSubId = e.target.value;
                      setFormData(prev => ({ 
                        ...prev, 
                        substation_id: newSubId, 
                        feeder_id: '' 
                      }));
                    }}`;
const replaceFormSelectStr = `                  <label className="block font-bold text-slate-700 mb-1">Trạm 110kV</label>
                  <select
                    value={formData.substation_id || ''}
                    onChange={async (e) => {
                      const newSubId = e.target.value;
                      const oldSubId = formData.substation_id;
                      if (String(newSubId) !== String(oldSubId)) {
                        setFormData(prev => ({ 
                          ...prev, 
                          substation_id: newSubId, 
                          feeder_id: '' 
                        }));
                        await fetchFeedersBySubstation(newSubId);
                      }
                    }}`;
code = code.replace(formSelectStr, replaceFormSelectStr);

// 8. formFeeders declaration removal
code = code.replace(
  /  \/\/ Filtered Feeders according to selected station in form\n  const formFeeders = formData\.substation_id\n    \? feeders\.filter\(f => String\(f\.substation_id\) === String\(formData\.substation_id\)\)\n    : feeders;/g,
  ""
);

fs.writeFileSync('src/pages/DevicesPage.tsx', code);
console.log('Patched DevicesPage.tsx properly');
