import { Device, Feeder, Substation } from '../types';

export interface DeviceRelationValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  feeder?: Feeder;
  substation?: Substation;
}

export const validateDeviceRelations = (
  device: Device,
  feeders: Feeder[],
  substations: Substation[]
): DeviceRelationValidation => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const feeder = feeders.find(f => f.id === device.feeder_id);
  const substation = substations.find(s => s.id === device.substation_id);

  if (!feeder && device.feeder_id) {
    errors.push('DELETED_FEEDER_REFERENCE');
  }
  
  if (!substation && device.substation_id) {
    errors.push('DELETED_SUBSTATION_REFERENCE');
  }

  if (feeder && substation && feeder.substation_id !== substation.id) {
    errors.push('FEEDER_SUBSTATION_MISMATCH');
  }

  if (!feeder && !device.feeder_id) {
     errors.push('ORPHAN_FEEDER');
  }

  if (!substation && !device.substation_id) {
     errors.push('ORPHAN_SUBSTATION');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    feeder,
    substation
  };
};
