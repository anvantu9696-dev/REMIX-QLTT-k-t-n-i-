const fs = require('fs');
let code = fs.readFileSync('src/pages/DevicesPage.tsx', 'utf8');

// 1. Add feedersCache ref to component
code = code.replace(
  "  const [loadingMore, setLoadingMore] = useState(false);",
  "  const [loadingMore, setLoadingMore] = useState(false);\n  const feedersCache = React.useRef<Record<string, Feeder[]>>({});\n  const [formFeeders, setFormFeeders] = useState<Feeder[]>([]);"
);

// We need to import React if it's not imported properly or use useRef from React
if (!code.includes('useRef')) {
  code = code.replace(
    "import React, { useState, useEffect, useCallback, useMemo } from 'react';",
    "import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';"
  );
  code = code.replace("feedersCache = React.useRef", "feedersCache = useRef");
}

// 2. Remove getFeeders(undefined) from fetchMetadata
code = code.replace(
  "        api.getFeeders(undefined, options)",
  "        // api.getFeeders(undefined, options) - REMOVED"
);
code = code.replace(
  "      if (fdRes.success) setFeeders(fdRes.data);",
  "      // if (fdRes.success) setFeeders(fdRes.data); - REMOVED"
);

// 3. Create fetchFeedersBySubstation function
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

// 4. Update the handleEdit to load feeders and KEEP the feeder_id
// Look for handleEdit
/*
  const handleEdit = (device: Device) => {
    setFormData({
      id: device.id,
      ...
*/
const handleEditReplacement = `  const handleEdit = async (device: Device) => {
    if (device.substation_id) {
      await fetchFeedersBySubstation(String(device.substation_id));
    } else {
      setFormFeeders([]);
    }
    setFormData({
`;
code = code.replace("  const handleEdit = (device: Device) => {", handleEditReplacement);
// Add async if needed: actually handleEdit is probably called by onClick so async is fine.

// 5. When substation_id changes in the form, clear feeder_id ONLY IF it's a real change, and fetch new feeders
// In DevicesPage.tsx:
/*
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
*/
const selectStationReplacement = `                  <select
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
code = code.replace(
  /<select[\s\S]*?value=\{formData\.substation_id\}[\s\S]*?onChange=\{e => \{[\s\S]*?const newSubId = e\.target\.value;[\s\S]*?setFormData\(prev => \(\{[\s\S]*?\.\.\.prev,[\s\S]*?substation_id: newSubId,[\s\S]*?feeder_id: ''[\s\S]*?\}\)\);[\s\S]*?\}\}/,
  selectStationReplacement
);

// 6. Fix formFeeders mapping (we already created formFeeders state, so remove the old derived formFeeders)
// Old: const formFeeders = formData.substation_id ? feeders.filter(...) : feeders;
code = code.replace(
  /  \/\/ Filtered Feeders according to selected station in form\n  const formFeeders = formData\.substation_id\n    \? feeders\.filter\(f => String\(f\.substation_id\) === String\(formData\.substation_id\)\)\n    : feeders;/g,
  ""
);

// 7. Fix stationFilter / feederFilter logic.
// We also need to fetch feeders when stationFilter changes!
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
// Insert before useEffect for fetchDevices
code = code.replace(
  "  useEffect(() => {\n    fetchDevices({ limit: 10 });",
  filterEffect + "\n  useEffect(() => {\n    fetchDevices({ limit: 10 });"
);

fs.writeFileSync('src/pages/DevicesPage.tsx', code);
console.log('Patched DevicesPage.tsx');
