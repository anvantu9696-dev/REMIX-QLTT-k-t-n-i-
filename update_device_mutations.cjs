const fs = require('fs');

let apiCode = fs.readFileSync('src/lib/api.ts', 'utf8');

// For createDevice, updateDevice, deleteDevice
// Let's replace the whole methods or inject the cache invalidation inside them.
// Wait, they just return request(...). If we want to add cache invalidation, we need to make them async and await request, then invalidate cache, then return.

const createDeviceRegex = /createDevice:\s*\(data:\s*any,\s*operationId\?:\s*string\)\s*=>\s*request<{ success: boolean; message: string; data: any }>\('\/devices', \{\s*method: 'POST',\s*body: JSON\.stringify\(data\)\s*\}\),/;
const newCreateDevice = `createDevice: async (data: any, operationId?: string) => {
    const res = await request<{ success: boolean; message: string; data: any }>('/devices', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (res.success) invalidateRelatedDeviceCache(data);
    return res;
  },`;
apiCode = apiCode.replace(createDeviceRegex, newCreateDevice);

const updateDeviceRegex = /updateDevice:\s*\(id:\s*number\s*\|\s*string,\s*data:\s*any,\s*operationId\?:\s*string\)\s*=>\s*request<{ success: boolean; message: string; data: any }>\(`\/devices\/\$\{id\}`,\s*\{\s*method: 'PUT',\s*body: JSON\.stringify\(data\)\s*\}\),/;
const newUpdateDevice = `updateDevice: async (id: number | string, data: any, operationId?: string) => {
    const res = await request<{ success: boolean; message: string; data: any }>(\`/devices/\${id}\`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    if (res.success) invalidateRelatedDeviceCache({ id, ...data });
    return res;
  },`;
apiCode = apiCode.replace(updateDeviceRegex, newUpdateDevice);

const deleteDeviceRegex = /deleteDevice:\s*\(id:\s*number\s*\|\s*string\)\s*=>\s*request<{ success: boolean; message: string }>\(`\/devices\/\$\{id\}`,\s*\{\s*method: 'DELETE'\s*\}\),/;
const newDeleteDevice = `deleteDevice: async (id: number | string, deviceData?: any) => {
    const res = await request<{ success: boolean; message: string }>(\`/devices/\${id}\`, {
      method: 'DELETE'
    });
    // In order to properly invalidate paginated lists, we should ideally know the device's substation/feeder, 
    // but at least we can invalidate by ID. The caller can pass deviceData if available.
    if (res.success) invalidateRelatedDeviceCache(deviceData || { id });
    return res;
  },`;
apiCode = apiCode.replace(deleteDeviceRegex, newDeleteDevice);

fs.writeFileSync('src/lib/api.ts', apiCode);
