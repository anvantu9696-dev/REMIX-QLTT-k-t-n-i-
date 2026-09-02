const fs = require('fs');

let apiCode = fs.readFileSync('src/lib/api.ts', 'utf8');

const targetBlock = `  bulkUpdateDevices: (data: { device_ids: (number | string)[]; updates: any; reason?: string }) =>
    request<{ success: boolean; message: string; updated_count: number }>('/devices/bulk-update', {
      method: 'POST',
      body: JSON.stringify(data)
    }),`;

const newBlock = `  bulkUpdateDevices: async (data: { device_ids: (number | string)[]; updates: any; reason?: string }) => {
    const res = await request<{ success: boolean; message: string; updated_count: number }>('/devices/bulk-update', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    // For bulk updates, we might need to invalidate all devices to be safe,
    // or at least invalidate by specific substation/feeder if known.
    // Let's invalidate the whole /devices? cache and stats.
    if (res.success) {
      invalidateCacheByPrefix('/devices?');
      invalidateCacheByPrefix('/dashboard/stats');
    }
    return res;
  },`;

apiCode = apiCode.replace(targetBlock, newBlock);
fs.writeFileSync('src/lib/api.ts', apiCode);
