const fs = require('fs');

let code = fs.readFileSync('src/pages/IssuesPage.tsx', 'utf8');

// 1. Add state
code = code.replace(
  /const \[loading, setLoading\] = useState\(true\);/,
  "const [loading, setLoading] = useState(true);\n  const [nextCursor, setNextCursor] = useState<string | null>(null);\n  const [loadingMore, setLoadingMore] = useState(false);"
);

// 2. Update loadIssues
code = code.replace(
  /const loadIssues = async \(\) => \{[\s\S]*?if \(res\.success\) setIssues\(res\.data\);\n    \} catch \(e\) \{[\s\S]*?\}\n  \};/,
  `const loadIssues = async () => {
    setLoading(true);
    try {
      const res = await api.getIssues({
        search: searchTerm,
        status: statusFilter,
        severity: severityFilter,
        limit: 50
      });
      if (res.success) {
        setIssues(res.data);
        setNextCursor(res.nextCursor || null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };`
);

// 3. Add loadMore function
const loadMoreFn = `
  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await api.getIssues({
        search: searchTerm,
        status: statusFilter,
        severity: severityFilter,
        limit: 50,
        lastDocId: nextCursor
      });
      if (res.success) {
        setIssues(prev => [...prev, ...res.data]);
        setNextCursor(res.nextCursor || null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  };
`;
code = code.replace(/const getSeverityBadge = /, loadMoreFn + '\n  const getSeverityBadge = ');

// 4. Add Load More button
const loadMoreBtn = `
      {nextCursor && (
        <div className="flex justify-center mt-6">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-6 py-2 bg-white border border-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
          >
            {loadingMore ? 'Đang tải thêm...' : 'Tải thêm dữ liệu'}
          </button>
        </div>
      )}
`;
code = code.replace(/(<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 xl:gap-6">[\s\S]*?<\/div>\s*)}/, `$1\n${loadMoreBtn}\n      }`);

fs.writeFileSync('src/pages/IssuesPage.tsx', code);
