const fs = require('fs');
let code = fs.readFileSync('src/pages/SchedulesPage.tsx', 'utf8');

code = code.replace(
  /const \[loading, setLoading\] = useState\(true\);/,
  "const [loading, setLoading] = useState(true);\n  const [nextCursor, setNextCursor] = useState<string | null>(null);\n  const [loadingMore, setLoadingMore] = useState(false);"
);

code = code.replace(
  /const loadSchedules = async \(\) => \{[\s\S]*?if \(res\.success\) setSchedules\(res\.data\);\n    \} catch \(err\) \{[\s\S]*?\}\n  \};/,
  `const loadSchedules = async () => {
    setLoading(true);
    try {
      const res = await api.getSchedules({ limit: 50 });
      if (res.success) {
        setSchedules(res.data);
        setNextCursor(res.nextCursor || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };`
);

const loadMoreFn = `
  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await api.getSchedules({ limit: 50, lastDocId: nextCursor });
      if (res.success) {
        setSchedules(prev => [...prev, ...res.data]);
        setNextCursor(res.nextCursor || null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  };
`;
code = code.replace(/const filteredSchedules = /, loadMoreFn + '\n  const filteredSchedules = ');

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
code = code.replace(/(<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">[\s\S]*?<\/div>\s*)}/, `$1\n${loadMoreBtn}\n      }`);
fs.writeFileSync('src/pages/SchedulesPage.tsx', code);
