import { substationRepo } from '../repositories/firestore/substationRepository';
import { feederRepo } from '../repositories/firestore/feederRepository';

export function isActiveEntity(entity: any): boolean {
  if (!entity) return false;
  // If entity is considered active if it exists, and not marked as deleted if isDeleted is present.
  if (entity.isDeleted === true) return false;
  return true;
}

export async function resolveDeviceRelations(substationIdentifier: string, feederIdentifier: string) {
    console.log(`[RELATION_VALIDATOR] Resolving: sub=${substationIdentifier}, feeder=${feederIdentifier}`);
    
    // Try lookup by code, then by ID
    let sub = await substationRepo.findByCode(substationIdentifier);
    if (!sub) sub = await substationRepo.getById(substationIdentifier);
    console.log(`[RELATION_VALIDATOR] Found substation: ${sub?.id || 'null'}`);
    
    let feeder = await feederRepo.findByCode(feederIdentifier);
    if (!feeder) feeder = await feederRepo.getById(feederIdentifier);
    console.log(`[RELATION_VALIDATOR] Found feeder: ${feeder?.id || 'null'}`);

    if (!isActiveEntity(sub)) {
        console.error(`[RELATION_VALIDATOR] Invalid substation for sub=${substationIdentifier}`);
        return { valid: false, reason: `INVALID_SUBSTATION_REFERENCE: ${substationIdentifier}` };
    }
    if (!isActiveEntity(feeder)) {
        console.error(`[RELATION_VALIDATOR] Invalid feeder for feeder=${feederIdentifier}`);
        return { valid: false, reason: `INVALID_FEEDER_REFERENCE: ${feederIdentifier}` };
    }
    
    // Check if feeder belongs to substation
    if (String(feeder.substation_id) !== String(sub.id)) {
        console.error(`[RELATION_VALIDATOR] Mismatch: sub=${sub.id}, feeder_sub=${feeder.substation_id}`);
        return { valid: false, reason: 'FEEDER_SUBSTATION_MISMATCH' };
    }

    return {
        substation: sub,
        feeder: feeder,
        substationId: sub.id,
        feederId: feeder.id,
        valid: true
    };
}
