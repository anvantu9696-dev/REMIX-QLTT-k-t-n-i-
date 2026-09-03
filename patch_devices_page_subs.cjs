const fs = require('fs');
let code = fs.readFileSync('src/pages/DevicesPage.tsx', 'utf8');

const oldFetchMetadata = `  const fetchMetadata = async () => {
    try {
      const [stRes, allDevRes] = await Promise.all([
        api.getSubstations(),
        // api.getFeeders() removed
        api.getDevices({ limit: 10 })
      ]);
      if (stRes.success) setSubstations(stRes.data);
      // setFeeders removed
      if (allDevRes.success) setTotalDevicesCount(allDevRes.data.length);
    } catch (e) {
      console.error(e);
    }
  };`;

const newFetchMetadata = `  const fetchMetadata = async () => {
    try {
      let allSubs: Substation[] = [];
      let lastDocId: string | undefined = undefined;
      while (true) {
        const stRes = await api.getSubstations({ limit: 100, lastDocId });
        if (stRes.success && stRes.data.length > 0) {
          allSubs = [...allSubs, ...stRes.data];
          if (stRes.nextCursor) {
            lastDocId = stRes.nextCursor;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      setSubstations(allSubs);

      const allDevRes = await api.getDevices({ limit: 10 });
      if (allDevRes.success) setTotalDevicesCount(allDevRes.data.length);
    } catch (e) {
      console.error(e);
    }
  };`;

code = code.replace(oldFetchMetadata, newFetchMetadata);

fs.writeFileSync('src/pages/DevicesPage.tsx', code);
console.log('Patched DevicesPage to fetch all substations pages');
