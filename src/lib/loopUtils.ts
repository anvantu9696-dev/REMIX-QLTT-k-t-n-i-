import { Loop } from '../types';

export interface StandardizedLoop extends Loop {
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  status: 'OPEN' | 'CLOSED' | 'INACTIVE' | 'ACTIVE';
}

export const normalizeLoop = (rawLoop: any): StandardizedLoop => {
  const createdAt = rawLoop.createdAt || rawLoop.created_at || new Date().toISOString();
  const updatedAt = rawLoop.updatedAt || rawLoop.updated_at || new Date().toISOString();
  
  return {
    ...rawLoop,
    id: Number(rawLoop.id) || 0,
    loop_id: rawLoop.loop_id || rawLoop.id || 'unknown',
    name: rawLoop.name || rawLoop.loop_name || 'Khép vòng chưa đặt tên',
    version: Number(rawLoop.version) > 0 ? Number(rawLoop.version) : 1,
    schemaVersion: Number(rawLoop.schemaVersion) || Number(rawLoop.schema_version) || 1,
    createdAt,
    updatedAt,
    created_at: createdAt,
    updated_at: updatedAt,
    status: rawLoop.status || 'INACTIVE',
  };
};
