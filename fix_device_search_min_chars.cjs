const fs = require('fs');
let code = fs.readFileSync('src/pages/DevicesPage.tsx', 'utf8');

const debounceCode = `
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    // Only search if keyword is >= 2 chars, or empty (cleared)
    if (search.length === 1) return;
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);
`;

code = code.replace(
  /const \[debouncedSearch, setDebouncedSearch\] = useState\(''\);\s*useEffect\(\(\) => \{\s*const timer = setTimeout\(\(\) => setDebouncedSearch\(search\), 400\);\s*return \(\) => clearTimeout\(timer\);\s*\}, \[search\]\);/,
  debounceCode.trim()
);

fs.writeFileSync('src/pages/DevicesPage.tsx', code);
