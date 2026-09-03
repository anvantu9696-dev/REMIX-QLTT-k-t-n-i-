const fs = require('fs');
let code = fs.readFileSync('src/components/topology/TopologyCanvas.tsx', 'utf8');

const mainLoopDevIndexFix = `
  const mainLoopDevIndex = nodes.findIndex(n => {
    const nId = String(n.device_id || '');
    return Boolean(loop && (
      nId === String(loop.loop_device_id || '') ||
      nId === String(loop.loop_device_code || '') ||
      nId === 'DEV_LOOP_MAIN'
    ));
  });
  const mainLoopDevIdFromGraph = mainLoopDevIndex >= 0 ? String(nodes[mainLoopDevIndex].device_id || '') : null;
`;

const renderStartRegex = /const handleMouseUpCanvas = \(\) => \{\n    if \(isPanning\) \{\n      setIsPanning\(false\);\n    \}\n    if \(draggingNodeId\) \{\n      setDraggingNodeId\(null\);\n    \}\n  \};/m;
code = code.replace(renderStartRegex, `const handleMouseUpCanvas = () => {\n    if (isPanning) {\n      setIsPanning(false);\n    }\n    if (draggingNodeId) {\n      setDraggingNodeId(null);\n    }\n  };\n${mainLoopDevIndexFix}`);

const isLoopMainLinkRegex = /const isLoopMainLink = Boolean\(loop && \(\n                srcId === String\(loop\.loop_device_id \|\| ''\) \|\|\n                tgtId === String\(loop\.loop_device_id \|\| ''\) \|\|\n                srcId === 'DEV_LOOP_MAIN' \|\|\n                tgtId === 'DEV_LOOP_MAIN'\n              \)\);/m;
const newIsLoopMainLink = `const isLoopMainLink = Boolean(mainLoopDevIdFromGraph && (srcId === mainLoopDevIdFromGraph || tgtId === mainLoopDevIdFromGraph));`;
code = code.replace(isLoopMainLinkRegex, newIsLoopMainLink);

const isMainLoopDevRegex = /const isMainLoopDev = Boolean\(loop && \(\n                devId === String\(loop\.loop_device_id \|\| ''\) \|\|\n                devId === String\(loop\.loop_device_code \|\| ''\) \|\|\n                devId === 'DEV_LOOP_MAIN'\n              \)\);/m;
const newIsMainLoopDev = `const isMainLoopDev = (index === mainLoopDevIndex);`;
code = code.replace(isMainLoopDevRegex, newIsMainLoopDev);

fs.writeFileSync('src/components/topology/TopologyCanvas.tsx', code);
console.log('Patched TopologyCanvas.tsx again');
