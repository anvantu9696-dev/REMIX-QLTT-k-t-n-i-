import { dbQuery, dbQueryOne } from '../db';

export function generateNextDeviceCode(deviceType: string, feederId?: number | null, substationId?: number | null): string {
  const upperType = (deviceType || 'LBS').toUpperCase();
  let prefix = `${upperType}-SYS`;

  const scopeFeederId = feederId ? Number(feederId) : null;
  const scopeSubstationId = substationId ? Number(substationId) : null;

  if (scopeFeederId) {
    const feeder = dbQueryOne(`SELECT feeder_code, name FROM feeders WHERE id = ? AND deleted_at IS NULL`, [scopeFeederId]);
    if (feeder) {
      const codeOrName = (feeder.feeder_code || feeder.name || '').trim().toUpperCase();
      const cleanCode = codeOrName.startsWith('F') ? codeOrName : `F${codeOrName}`;
      prefix = `${upperType}-${cleanCode}`;
    }
  } else if (scopeSubstationId) {
    const sub = dbQueryOne(`SELECT substation_code, name FROM substations WHERE id = ? AND deleted_at IS NULL`, [scopeSubstationId]);
    if (sub) {
      const subCode = (sub.substation_code || sub.name || '').replace(/\s+/g, '_').toUpperCase();
      prefix = `${upperType}-TRAM-${subCode}`;
    }
  }

  let query = `SELECT device_id FROM devices WHERE device_type = ? AND deleted_at IS NULL`;
  let params: any[] = [upperType];

  if (scopeFeederId) {
    query += ` AND feeder_id = ?`;
    params.push(scopeFeederId);
  } else if (scopeSubstationId) {
    query += ` AND substation_id = ? AND feeder_id IS NULL`;
    params.push(scopeSubstationId);
  } else {
    query += ` AND feeder_id IS NULL AND substation_id IS NULL`;
  }

  const existingDevices = dbQuery(query, params);
  const usedNumbers = new Set<number>();
  const regex = new RegExp(`^${prefix}-(\\d+)$`, 'i');

  for (const d of existingDevices) {
    if (d.device_id) {
      const match = d.device_id.trim().match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num)) {
          usedNumbers.add(num);
        }
      }
    }
  }

  let nextNum = 1;
  while (usedNumbers.has(nextNum)) {
    nextNum++;
  }

  const paddedNum = nextNum.toString().padStart(3, '0');
  return `${prefix}-${paddedNum}`;
}
