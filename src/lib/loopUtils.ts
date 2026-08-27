import { Loop } from '../types';

export interface StandardizedLoop extends Loop {
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}

export const normalizeLoop = (rawLoop: any): StandardizedLoop => {
  const createdAt = rawLoop.createdAt || rawLoop.created_at || new Date().toISOString();
  const updatedAt = rawLoop.updatedAt || rawLoop.updated_at || new Date().toISOString();
  
  return {
    ...rawLoop,
    id: Number(rawLoop.id) || 0,
    loop_id: rawLoop.loop_id || 'unknown',
    name: rawLoop.name || 'Unnamed Loop',
    version: typeof rawLoop.version === 'number' ? rawLoop.version : 1,
    schemaVersion: typeof rawLoop.schemaVersion === 'number' ? rawLoop.schemaVersion : 1,
    createdAt,
    updatedAt,
    created_at: createdAt,
    updated_at: updatedAt,
    status: rawLoop.status || 'INACTIVE',
  };
};
