const fs = require('fs');
let code = fs.readFileSync('src/pages/DevicesPage.tsx', 'utf8');

const oldFetchFeeders = `  const fetchFeedersBySubstation = async (subId: string) => {
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
  };`;

const newFetchFeeders = `  const fetchFeedersBySubstation = async (subId: string) => {
    if (!subId) {
      setFormFeeders([]);
      return;
    }
    if (feedersCache.current[subId]) {
      setFormFeeders(feedersCache.current[subId]);
      return;
    }
    try {
      let allFeeders: Feeder[] = [];
      let lastDocId: string | undefined = undefined;
      while (true) {
        const res = await api.getFeeders({ substation_id: subId, limit: 100, lastDocId });
        if (res.success && res.data.length > 0) {
          allFeeders = [...allFeeders, ...res.data];
          if (res.nextCursor) {
            lastDocId = res.nextCursor;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      feedersCache.current[subId] = allFeeders;
      setFormFeeders(allFeeders);
    } catch (e) {
      console.error('Lỗi tải phát tuyến:', e);
    }
  };`;

code = code.replace(oldFetchFeeders, newFetchFeeders);

// And for the station filter fetch
const oldFilterEffect = `    if (stationFilter) {
      api.getFeeders({ substation_id: stationFilter, limit: 100 }).then(res => {
        if (res.success) setFeeders(res.data);
      });
    } else {
      setFeeders([]);
    }`;

const newFilterEffect = `    if (stationFilter) {
      const fetchAll = async () => {
        let allFeeders: Feeder[] = [];
        let lastDocId: string | undefined = undefined;
        while (true) {
          const res = await api.getFeeders({ substation_id: stationFilter, limit: 100, lastDocId });
          if (res.success && res.data.length > 0) {
            allFeeders = [...allFeeders, ...res.data];
            if (res.nextCursor) {
              lastDocId = res.nextCursor;
            } else {
              break;
            }
          } else {
            break;
          }
        }
        setFeeders(allFeeders);
      };
      fetchAll();
    } else {
      setFeeders([]);
    }`;

code = code.replace(oldFilterEffect, newFilterEffect);

fs.writeFileSync('src/pages/DevicesPage.tsx', code);
console.log('Patched DevicesPage to fetch all feeders pages');
