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

const returnAnchor = `return (\n    <div className="relative w-full h-[680px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col select-none">`;
code = code.replace(returnAnchor, mainLoopDevIndexFix + '\n  ' + returnAnchor);

fs.writeFileSync('src/components/topology/TopologyCanvas.tsx', code);
console.log('Patched TopologyCanvas.tsx via return anchor successfully');
