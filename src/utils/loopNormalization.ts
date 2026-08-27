import { Loop } from '../types';

export interface LoopViewModel {
  id: string;
  loop_id: string;
  name: string;
  schemaVersion: number;
  version: number;
  substation_id_a: string;
  feeder_id_a: string;
  device_id_a: string;
  substation_id_b: string;
  feeder_id_b: string;
  device_id_b: string;
  status: 'OPEN' | 'CLOSED' | 'INACTIVE' | 'ACTIVE';
  latitude?: number;
  longitude?: number;
  [key: string]: any;
}

export const normalizeLoop = (raw: any): LoopViewModel => {
  return {
    id: raw.id,
    loop_id: raw.loop_id || 'UNKNOWN',
    name: raw.name || 'Unnamed Loop',
    schemaVersion: Number(raw.schemaVersion) || 1, // Default to 1 for legacy
    version: Number(raw.version) || 1,
    substation_id_a: String(raw.substation_id_a || ''),
    feeder_id_a: String(raw.feeder_id_a || ''),
    device_id_a: String(raw.device_id_a || ''),
    substation_id_b: String(raw.substation_id_b || ''),
    feeder_id_b: String(raw.feeder_id_b || ''),
    device_id_b: String(raw.device_id_b || ''),
    status: raw.status || 'INACTIVE',
    latitude: raw.latitude ? Number(raw.latitude) : undefined,
    longitude: raw.longitude ? Number(raw.longitude) : undefined,
    ...raw
  };
};
