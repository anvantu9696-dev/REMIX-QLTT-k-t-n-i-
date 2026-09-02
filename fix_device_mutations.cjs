const fs = require('fs');

let apiCode = fs.readFileSync('src/lib/api.ts', 'utf8');

const targetBlock = `  createDevice: (data: any, operationId?: string) =>
    request<{ success: boolean; message: string; data: any }>('/devices', {
      method: 'POST',
      body: JSON.stringify({ ...data, operationId: operationId || crypto.randomUUID() })
    }),

  updateDevice: (id: number | string, data: any, operationId?: string, expectedVersion?: number) =>
    request<{ success: boolean; message: string; data: any }>(\`/devices/\${id}\`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, operationId: operationId || crypto.randomUUID(), expectedVersion })
    }),

  deleteDevice: (id: number | string, operationId?: string) =>
    request<{ success: boolean; message: string }>(\`/devices/\${id}\`, {
      method: 'DELETE',
      body: JSON.stringify({ operationId: operationId || crypto.randomUUID() })
    }),`;

const newBlock = `  createDevice: async (data: any, operationId?: string) => {
    const res = await request<{ success: boolean; message: string; data: any }>('/devices', {
      method: 'POST',
      body: JSON.stringify({ ...data, operationId: operationId || crypto.randomUUID() })
    });
    if (res.success) invalidateRelatedDeviceCache(data);
    return res;
  },

  updateDevice: async (id: number | string, data: any, operationId?: string, expectedVersion?: number) => {
    const res = await request<{ success: boolean; message: string; data: any }>(\`/devices/\${id}\`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, operationId: operationId || crypto.randomUUID(), expectedVersion })
    });
    if (res.success) invalidateRelatedDeviceCache({ id, ...data });
    return res;
  },

  deleteDevice: async (id: number | string, operationId?: string, deviceData?: any) => {
    const res = await request<{ success: boolean; message: string }>(\`/devices/\${id}\`, {
      method: 'DELETE',
      body: JSON.stringify({ operationId: operationId || crypto.randomUUID() })
    });
    if (res.success) invalidateRelatedDeviceCache(deviceData || { id });
    return res;
  },`;

apiCode = apiCode.replace(targetBlock, newBlock);
fs.writeFileSync('src/lib/api.ts', apiCode);
