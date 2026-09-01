import { Device, Substation, Feeder } from '../types';

export const normalizeDeviceRelations = (
  device: Device,
  substations: Substation[],
  feeders: Feeder[]
) => {
  const sub = substations.find(s => String(s.id) === String(device.substation_id));
  const feeder = feeders.find(f => String(f.id) === String(device.feeder_id));
  
  return {
    feederId: device.feeder_id,
    feederCode: feeder ? feeder.feeder_code : device.feeder_code || '',
    feederName: feeder ? feeder.name : device.feeder_name || 'N/A',
    substationId: device.substation_id,
    substationCode: sub ? sub.substation_code : device.substation_code || '',
    substationName: sub ? sub.name : device.substation_name || 'N/A'
  };
};
