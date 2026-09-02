const fs = require('fs');

let code = fs.readFileSync('src/pages/DevicesPage.tsx', 'utf8');

// 1. Add useDebounce hook if not present (or we can just implement it directly)
if (!code.includes("const debouncedSearch")) {
  const debounceCode = `
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);
`;
  code = code.replace(
    "  const [search, setSearch] = useState('');",
    "  const [search, setSearch] = useState('');" + debounceCode
  );
}

// 2. Change the dependency array
code = code.replace(
  "  }, [search, stationFilter, feederFilter, typeFilter, switchFilter, scadaFilter, batteryFilter]);",
  "  }, [debouncedSearch, stationFilter, feederFilter, typeFilter, switchFilter, scadaFilter, batteryFilter]);"
);

// 3. Update fetchDevices params
code = code.replace(
  "      if (search) params.search = search;",
  "      if (debouncedSearch) params.search = debouncedSearch;"
);
code = code.replace(
  "      if (search) params.search = search;",
  "      if (debouncedSearch) params.search = debouncedSearch;"
);

// 4. Remove duplicate fetch in fetchMetadata
const metaBlock = `      const [stRes, fdRes, allDevRes] = await Promise.all([
        api.getSubstations(),
        api.getFeeders(),
        api.getDevices({ limit: 10 })
      ]);
      if (stRes.success) setSubstations(stRes.data);
      if (fdRes.success) setFeeders(fdRes.data);
      if (allDevRes.success) setTotalDevicesCount(allDevRes.data.length);`;

const newMetaBlock = `      const [stRes, fdRes] = await Promise.all([
        api.getSubstations(),
        api.getFeeders()
      ]);
      if (stRes.success) setSubstations(stRes.data);
      if (fdRes.success) setFeeders(fdRes.data);`;

code = code.replace(metaBlock, newMetaBlock);

// 5. Remove fetchDevices({ limit: 10 }) from initial mount since the filter effect handles it
code = code.replace(
  "      await fetchDevices({ limit: 10 });\n    };\n    init();",
  "    };\n    init();"
);

fs.writeFileSync('src/pages/DevicesPage.tsx', code);
