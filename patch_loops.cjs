const fs = require('fs');

let code = fs.readFileSync('src/pages/LoopDetailPage.tsx', 'utf8');

const oldFetchStr = `  const fetchLoopDetail = async (versionId?: number | string) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.getLoop(id, versionId);
      if (res.success) {
        setLoop(normalizeLoop(res.data.loop));
        setActiveVersion(res.data.active_version);
        setVersions(res.data.versions);
        setNodes(res.data.nodes || []);
        setEdges(res.data.edges || []);
        setPendingRequest(res.data.pending_request || null);
        if (res.data.active_version) {
          setSelectedVersionId(res.data.active_version.id);
        }
        setIsDirty(false);
      } else {
        alert((res as any).message || 'Không tìm thấy mạch Khép vòng');
      }
    } catch (err: any) {
      console.error('Error loading loop detail:', err);
      alert(err.message || 'Không tìm thấy mạch Khép vòng');
    } finally {
      setLoading(false);
    }
  };`;

const newFetchStr = `  const fetchLoopDetail = async (versionId?: number | string) => {
    if (!id) return;
    
    // Auto redirect if id is '0'
    if (id === '0') {
      try {
        const listRes = await api.getLoops({});
        if (listRes.success && listRes.data && listRes.data.length > 0) {
           navigate(\`/loops/\${listRes.data[0].id}\`);
           return;
        }
      } catch (e) {
        console.error('Failed to fetch loops for redirect', e);
      }
    }
    
    setLoading(true);
    try {
      const res = await api.getLoop(id, versionId);
      if (res.success) {
        setLoop(normalizeLoop(res.data.loop));
        setActiveVersion(res.data.active_version);
        setVersions(res.data.versions);
        setNodes(res.data.nodes || []);
        setEdges(res.data.edges || []);
        setPendingRequest(res.data.pending_request || null);
        if (res.data.active_version) {
          setSelectedVersionId(res.data.active_version.id);
        }
        setIsDirty(false);
      } else {
        // Fallback fetch list if not found
        try {
          const listRes = await api.getLoops({});
          if (listRes.success && listRes.data && listRes.data.length > 0) {
             navigate(\`/loops/\${listRes.data[0].id}\`);
             return;
          }
        } catch (e) {}
      }
    } catch (err: any) {
      console.error('Error loading loop detail:', err);
      // Fallback fetch list if not found
      try {
        const listRes = await api.getLoops({});
        if (listRes.success && listRes.data && listRes.data.length > 0) {
           navigate(\`/loops/\${listRes.data[0].id}\`);
           return;
        }
      } catch (e) {}
    } finally {
      setLoading(false);
    }
  };`;

code = code.replace(oldFetchStr, newFetchStr);

const oldLoadingStr = `  if (loading) {
    return <div className="text-center py-20 text-slate-500 text-xs">Đang tải sơ đồ Topology khép vòng...</div>;
  }`;

const newLoadingStr = `  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }`;

code = code.replace(oldLoadingStr, newLoadingStr);

fs.writeFileSync('src/pages/LoopDetailPage.tsx', code);
console.log('Patched LoopDetailPage');
