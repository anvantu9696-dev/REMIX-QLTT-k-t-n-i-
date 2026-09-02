const fs = require('fs');

// 1. Cập nhật api.ts
let apiCode = fs.readFileSync('src/lib/api.ts', 'utf8');

// Sửa request function để forceRefresh ghi đè cache bằng setCache
const requestTarget = `  if (shouldCache && !options.forceRefresh) {
    const cachedData = await getCache<T>(cacheKey);
    if (cachedData !== null) {
      return cachedData;
    }
  }`;

const requestNew = `  if (shouldCache && !options.forceRefresh) {
    const cachedData = await getCache<T>(cacheKey);
    if (cachedData !== null) {
      return cachedData;
    }
  }`;

if (apiCode.includes(requestTarget)) {
   const responseHandlingTarget = `    if (response.ok) {
      if (shouldCache) {
        setCache(cacheKey, responseData, options.cacheTtl!).catch(err => console.warn('Cache write failed:', err));
      }
      return responseData;
    }`;
    
    // Nothing actually needs changing in request function, just checking it caches correctly. 
    // forceRefresh skips the getCache, then reaches response.ok and writes new cache using setCache. That's correct.
}

// 2. Sửa DevicesPage.tsx
let devicesCode = fs.readFileSync('src/pages/DevicesPage.tsx', 'utf8');

if (!devicesCode.includes("const handleRefreshData =")) {
    const targetRefreshBtn = `            Thêm mới
          </button>
        )}
      </div>
    </div>`;

    const newRefreshBtn = `            Thêm mới
          </button>
        )}
        <button
          onClick={handleRefreshData}
          disabled={loading}
          className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50 flex items-center space-x-2 shadow-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={\`w-4 h-4 \${loading ? 'animate-spin' : ''}\`} />
          <span className="hidden sm:inline">Làm mới</span>
        </button>
      </div>
    </div>`;
    
    devicesCode = devicesCode.replace(targetRefreshBtn, newRefreshBtn);

    const targetRefreshImport = `import { Zap, Plus, Search, Building2, GitCommitHorizontal, MapPin, Edit2, Trash2, Eye, AlertCircle, X, CheckCircle2, ExternalLink, ShieldAlert, Activity, Layers, Check, AlertTriangle, Radio, Download, Compass, LayoutGrid, List, Upload, Camera, QrCode } from 'lucide-react';`;
    const newRefreshImport = `import { Zap, Plus, Search, Building2, GitCommitHorizontal, MapPin, Edit2, Trash2, Eye, AlertCircle, X, CheckCircle2, ExternalLink, ShieldAlert, Activity, Layers, Check, AlertTriangle, Radio, Download, Compass, LayoutGrid, List, Upload, Camera, QrCode, RefreshCw } from 'lucide-react';`;
    devicesCode = devicesCode.replace(targetRefreshImport, newRefreshImport);

    const handleRefreshDataFunc = `
  const handleRefreshData = async () => {
    setLoading(true);
    await fetchMetadata({ forceRefresh: true });
    await fetchDevices({ limit: 10, forceRefresh: true });
    setLoading(false);
  };
`;

    devicesCode = devicesCode.replace("  const fetchMetadata = async (", "  const fetchMetadata = async (options?: {forceRefresh?: boolean}) => {");
    devicesCode = devicesCode.replace("  const fetchMetadata = async () => {", handleRefreshDataFunc + "\n  const fetchMetadata = async (options?: {forceRefresh?: boolean}) => {");
    
    // Pass options down in fetchMetadata
    devicesCode = devicesCode.replace("api.getSubstations(),", "api.getSubstations(options),");
    devicesCode = devicesCode.replace("api.getFeeders()", "api.getFeeders(options)");
}

fs.writeFileSync('src/pages/DevicesPage.tsx', devicesCode);

// 3. Sửa SubstationsPage.tsx
let substationsCode = fs.readFileSync('src/pages/SubstationsPage.tsx', 'utf8');

if (!substationsCode.includes("const handleRefreshData =")) {
    const targetRefreshBtn = `            Thêm mới
          </button>
        )}
      </div>
    </div>`;

    const newRefreshBtn = `            Thêm mới
          </button>
        )}
        <button
          onClick={handleRefreshData}
          disabled={loading}
          className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50 flex items-center space-x-2 shadow-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={\`w-4 h-4 \${loading ? 'animate-spin' : ''}\`} />
          <span className="hidden sm:inline">Làm mới</span>
        </button>
      </div>
    </div>`;
    
    substationsCode = substationsCode.replace(targetRefreshBtn, newRefreshBtn);

    const handleRefreshDataFunc = `
  const handleRefreshData = async () => {
    setLoading(true);
    try {
      const res = await api.getSubstations({ forceRefresh: true });
      if (res.success) {
        setSubstations(res.data);
      }
    } finally {
      setLoading(false);
    }
  };
`;

    substationsCode = substationsCode.replace("  const fetchSubstations = async () => {", handleRefreshDataFunc + "\n  const fetchSubstations = async () => {");
    
    const targetRefreshImport = `import { Building2, Plus, Search, Edit2, Trash2, MapPin, Zap, AlertTriangle, Phone, Hash } from 'lucide-react';`;
    const newRefreshImport = `import { Building2, Plus, Search, Edit2, Trash2, MapPin, Zap, AlertTriangle, Phone, Hash, RefreshCw } from 'lucide-react';`;
    substationsCode = substationsCode.replace(targetRefreshImport, newRefreshImport);
}
fs.writeFileSync('src/pages/SubstationsPage.tsx', substationsCode);


// 4. Sửa FeedersPage.tsx
let feedersCode = fs.readFileSync('src/pages/FeedersPage.tsx', 'utf8');

if (!feedersCode.includes("const handleRefreshData =")) {
    const targetRefreshBtn = `            Thêm mới
          </button>
        )}
      </div>
    </div>`;

    const newRefreshBtn = `            Thêm mới
          </button>
        )}
        <button
          onClick={handleRefreshData}
          disabled={loading}
          className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50 flex items-center space-x-2 shadow-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={\`w-4 h-4 \${loading ? 'animate-spin' : ''}\`} />
          <span className="hidden sm:inline">Làm mới</span>
        </button>
      </div>
    </div>`;
    
    feedersCode = feedersCode.replace(targetRefreshBtn, newRefreshBtn);

    const handleRefreshDataFunc = `
  const handleRefreshData = async () => {
    setLoading(true);
    try {
      await fetchMetadata({ forceRefresh: true });
      await fetchFeeders({ forceRefresh: true });
    } finally {
      setLoading(false);
    }
  };
`;
    // Thêm forceRefresh prop cho fetchMetadata và fetchFeeders
    feedersCode = feedersCode.replace("  const fetchMetadata = async () => {", handleRefreshDataFunc + "\n  const fetchMetadata = async (options?: {forceRefresh?: boolean}) => {");
    feedersCode = feedersCode.replace("api.getSubstations()", "api.getSubstations(options)");
    
    feedersCode = feedersCode.replace("  const fetchFeeders = async () => {", "  const fetchFeeders = async (options?: {forceRefresh?: boolean}) => {");
    feedersCode = feedersCode.replace("        substation_id: stationFilter || undefined,", "        substation_id: stationFilter || undefined,\n        forceRefresh: options?.forceRefresh");

    const targetRefreshImport = `import { GitCommitHorizontal, Plus, Search, Building2, Edit2, Trash2, Zap, AlertTriangle, MapPin, Users } from 'lucide-react';`;
    const newRefreshImport = `import { GitCommitHorizontal, Plus, Search, Building2, Edit2, Trash2, Zap, AlertTriangle, MapPin, Users, RefreshCw } from 'lucide-react';`;
    feedersCode = feedersCode.replace(targetRefreshImport, newRefreshImport);
}
fs.writeFileSync('src/pages/FeedersPage.tsx', feedersCode);

// 5. App.tsx phím tắt
let appCode = fs.readFileSync('src/App.tsx', 'utf8');
if (!appCode.includes("Ctrl+Shift+R")) {
  const shortcutHook = `
  // Global shortcut to force refresh app (Ctrl+Shift+R)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
        e.preventDefault();
        if (window.confirm('Bạn có muốn xóa toàn bộ bộ nhớ đệm (Cache) và tải lại trang?')) {
          clearAllCache().then(() => {
            window.location.reload();
          });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
`;
  appCode = appCode.replace("  (window as any).clearGridCache = clearAllCache;", "  (window as any).clearGridCache = clearAllCache;\n" + shortcutHook);
}
fs.writeFileSync('src/App.tsx', appCode);

