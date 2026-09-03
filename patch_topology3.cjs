const fs = require('fs');
let code = fs.readFileSync('src/components/topology/TopologyCanvas.tsx', 'utf8');

const anchor = 'const containerRect = containerRef.current?.getBoundingClientRect();';

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

if (!code.includes('mainLoopDevIndex =')) {
  code = code.replace(anchor, mainLoopDevIndexFix + '\n  ' + anchor);
}

const isLoopMainLinkCode = `const isLoopMainLink = Boolean(loop && (
                srcId === String(loop.loop_device_id || '') ||
                tgtId === String(loop.loop_device_id || '') ||
                srcId === 'DEV_LOOP_MAIN' ||
                tgtId === 'DEV_LOOP_MAIN'
              ));`;
code = code.replace(isLoopMainLinkCode, `const isLoopMainLink = Boolean(mainLoopDevIdFromGraph && (srcId === mainLoopDevIdFromGraph || tgtId === mainLoopDevIdFromGraph));`);

const isMainLoopDevCode = `const isMainLoopDev = Boolean(loop && (
                devId === String(loop.loop_device_id || '') ||
                devId === String(loop.loop_device_code || '') ||
                devId === 'DEV_LOOP_MAIN'
              ));`;
code = code.replace(isMainLoopDevCode, `const isMainLoopDev = (index === mainLoopDevIndex);`);

fs.writeFileSync('src/components/topology/TopologyCanvas.tsx', code);
console.log('Patched TopologyCanvas.tsx via exact string match');
