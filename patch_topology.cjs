const fs = require('fs');
let code = fs.readFileSync('src/components/topology/TopologyCanvas.tsx', 'utf8');

// 1. Remove buildStandard7NodeTopology (around line 173 to 384)
const build7NodeRegex = /const buildStandard7NodeTopology = useCallback\(\(currentLoop: Loop\) => \{[\s\S]*?return \{ standardNodes, standardEdges \};\n  \}, \[\]\);/m;
code = code.replace(build7NodeRegex, '');

// 2. Fix the initial useEffect to not call buildStandard7NodeTopology
const initUseEffectRegex = /\/\/ Initial history push or setup standard nodes if empty\n  useEffect\(\(\) => \{[\s\S]*?updateTopologyState\]\);/m;
const newInitUseEffect = `// Initial history push if empty
  useEffect(() => {
    if (history.length === 0 && (nodes.length > 0 || edges.length > 0)) {
      setHistory([{ nodes, edges }]);
      setHistoryIndex(0);
    }
  }, [nodes.length, edges.length, history.length]);`;
code = code.replace(initUseEffectRegex, newInitUseEffect);

// 3. Remove handleApplyStandard7NodeChain (around line 423)
const handleApplyRegex = /\/\/ Action: Apply Strict 7-Node Standard Chain\n  const handleApplyStandard7NodeChain = \(\) => \{[\s\S]*?setZoom\(0\.85\);\n  \};\n/m;
code = code.replace(handleApplyRegex, '');

// 4. Update handleAutoLayout to remove handleApplyStandard7NodeChain call
const autoLayoutRegex = /const handleAutoLayout = \(\) => \{\n    if \(nodes\.length === 0\) return;\n    if \(loop && nodes\.length >= 7\) \{\n      handleApplyStandard7NodeChain\(\);\n      return;\n    \}/m;
const newAutoLayout = `const handleAutoLayout = () => {
    if (nodes.length === 0) return;`;
code = code.replace(autoLayoutRegex, newAutoLayout);

// 5. Remove the "Cấu trúc chuẩn EVN 7 nút khép mạch" visual strip (lines 999-1038)
const visualStripRegex = /\{\/\* 7-NODE CHAIN VISUAL SEQUENCE STRIP \(HIGHLIGHTING ĐIỂM DỪNG PHÁP LÝ\) \*\/\}\n      <div className="bg-slate-900\/90 border-b border-slate-800\/80 px-4 py-2 flex items-center justify-between overflow-x-auto shadow-inner text-xs">[\s\S]*?<\/div>\n      <\/div>/m;
code = code.replace(visualStripRegex, '');

// 6. Remove the button [ ⚡ KHÉP VÒNG CHUẨN 7 NÚT ]
const buttonRegex = /\{\/\* Quick Standard 7-Node Layout Reset \*\/\}\n          \{loop && !readOnly && \(\n            <button\n              onClick=\{handleApplyStandard7NodeChain\}[\s\S]*?\[ ⚡ KHÉP VÒNG CHUẨN 7 NÚT \]\n            <\/button>\n          \)\}/m;
code = code.replace(buttonRegex, '');

// 7. Fix "hiển thị trùng 2 điểm dừng pháp lý"
// Inside the render function where links are evaluated
const mainLoopDevIndexFix = `  const mainLoopDevIndex = nodes.findIndex(n => {
    const nId = String(n.device_id || '');
    return Boolean(loop && (
      nId === String(loop.loop_device_id || '') ||
      nId === String(loop.loop_device_code || '') ||
      nId === 'DEV_LOOP_MAIN'
    ));
  });
  const mainLoopDevIdFromGraph = mainLoopDevIndex >= 0 ? String(nodes[mainLoopDevIndex].device_id || '') : null;`;

// insert mainLoopDevIndexFix right before `const containerRect = containerRef.current?.getBoundingClientRect();` or at the start of rendering
const renderStartRegex = /const handleMouseUpCanvas = \(\) => \{\n    setIsPanning\(false\);\n    setDraggingNodeId\(null\);\n  \};/m;
code = code.replace(renderStartRegex, `const handleMouseUpCanvas = () => {\n    setIsPanning(false);\n    setDraggingNodeId(null);\n  };\n\n${mainLoopDevIndexFix}`);

const isLoopMainLinkRegex = /const isLoopMainLink = Boolean\(loop && \(\n                srcId === String\(loop\.loop_device_id \|\| ''\) \|\|\n                tgtId === String\(loop\.loop_device_id \|\| ''\) \|\|\n                srcId === 'DEV_LOOP_MAIN' \|\|\n                tgtId === 'DEV_LOOP_MAIN'\n              \)\);/m;
const newIsLoopMainLink = `const isLoopMainLink = Boolean(mainLoopDevIdFromGraph && (srcId === mainLoopDevIdFromGraph || tgtId === mainLoopDevIdFromGraph));`;
code = code.replace(isLoopMainLinkRegex, newIsLoopMainLink);

const isMainLoopDevRegex = /const isMainLoopDev = Boolean\(loop && \(\n                devId === String\(loop\.loop_device_id \|\| ''\) \|\|\n                devId === String\(loop\.loop_device_code \|\| ''\) \|\|\n                devId === 'DEV_LOOP_MAIN'\n              \)\);/m;
const newIsMainLoopDev = `const isMainLoopDev = (index === mainLoopDevIndex);`;
code = code.replace(isMainLoopDevRegex, newIsMainLoopDev);

fs.writeFileSync('src/components/topology/TopologyCanvas.tsx', code);
console.log('Patched TopologyCanvas.tsx');
