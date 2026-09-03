const fs = require('fs');
let code = fs.readFileSync('src/pages/FeedersPage.tsx', 'utf8');

const oldFetchSubs = `  const fetchSubstationsList = async (options?: {forceRefresh?: boolean}) => {
    try {
      const res = await api.getSubstations(undefined, options);
      if (res.success) {
        setSubstations(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };`;

const newFetchSubs = `  const fetchSubstationsList = async (options?: {forceRefresh?: boolean}) => {
    try {
      let allSubs: Substation[] = [];
      let lastDocId: string | undefined = undefined;
      while (true) {
        const res = await api.getSubstations({ limit: 100, lastDocId }, options);
        if (res.success && res.data.length > 0) {
          allSubs = [...allSubs, ...res.data];
          if (res.nextCursor) {
            lastDocId = res.nextCursor;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      setSubstations(allSubs);
    } catch (e) {
      console.error(e);
    }
  };`;

code = code.replace(oldFetchSubs, newFetchSubs);

fs.writeFileSync('src/pages/FeedersPage.tsx', code);
console.log('Patched FeedersPage to fetch all substations pages');
