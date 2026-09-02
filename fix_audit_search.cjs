const fs = require('fs');
let code = fs.readFileSync('src/pages/AuditLogsPage.tsx', 'utf8');

const debounceCode = `
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);
`;
if (!code.includes("const debouncedSearch")) {
  code = code.replace(
    "  const [search, setSearch] = useState('');",
    "  const [search, setSearch] = useState('');" + debounceCode
  );
  code = code.replace(
    "  }, [search, moduleFilter, resultFilter]);",
    "  }, [debouncedSearch, moduleFilter, resultFilter]);"
  );
  code = code.replace(
    "        search: search || undefined,",
    "        search: debouncedSearch || undefined,"
  );
  fs.writeFileSync('src/pages/AuditLogsPage.tsx', code);
}
