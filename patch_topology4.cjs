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

// Insert it right before the main return (
const returnAnchor = 'return (\n    <div className="flex flex-col h-full bg-slate-950">';
if (code.includes(returnAnchor)) {
  code = code.replace(returnAnchor, mainLoopDevIndexFix + '\n  ' + returnAnchor);
} else {
  console.log('Return anchor not found!');
}

fs.writeFileSync('src/components/topology/TopologyCanvas.tsx', code);
console.log('Patched TopologyCanvas.tsx via return anchor');
