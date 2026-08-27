import { Router, Response } from 'express';
import { dbQuery, dbQueryOne, dbRun } from '../db';
import { broadcastRealtimeEvent } from '../events';
import {
  authenticateToken,
  denyGuestMutations,
  requirePermission,
  recordAuditLog,
  AuthenticatedRequest
} from '../middleware';

const router = Router();

function generateRequestCode(): string {
  const year = new Date().getFullYear();
  const countRow = dbQueryOne(`SELECT COUNT(*) as cnt FROM device_proposals`);
  const nextNum = (countRow?.cnt || 0) + 1;
  const numStr = String(nextNum).padStart(4, '0');
  return `PRP-${year}-${numStr}`;
}

function cleanBatteryStatus(val: any, fallback = 'UNCHECKED'): string {
  if (!val || typeof val !== 'string') return fallback;
  const v = val.trim().toUpperCase();
  if (['GOOD', 'TỐT'].includes(v)) return 'GOOD';
  if (['WEAK', 'YẾU'].includes(v)) return 'WEAK';
  if (['BROKEN', 'HỎNG'].includes(v)) return 'BROKEN';
  if (['REPLACING', 'ĐANG THAY'].includes(v)) return 'REPLACING';
  if (['UNCHECKED', 'CHƯA KIỂM TRA'].includes(v)) return 'UNCHECKED';
  if (['GOOD', 'WEAK', 'BROKEN', 'REPLACING', 'UNCHECKED'].includes(v)) return v;
  return fallback;
}

// 1. Check Duplicate Devices & Proposals
router.post('/check-duplicate', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { device_id, name, pole_number, feeder_id, substation_id, latitude, longitude } = req.body;

    const matchedDevices: any[] = [];
    const matchedProposals: any[] = [];

    // Check by device_id (exact match, case-insensitive)
    if (device_id && device_id.trim()) {
      const devMatch = dbQueryOne(
        `SELECT id, device_id, name, pole_number, device_type FROM devices WHERE LOWER(device_id) = LOWER(?) AND deleted_at IS NULL`,
        [device_id.trim()]
      );
      if (devMatch) matchedDevices.push({ ...devMatch, match_type: 'Trùng Mã thiết bị (DEVICE_ID)' });

      const propMatch = dbQueryOne(
        `SELECT id, request_code, target_device_id_str, device_name, type, requester_fullname FROM device_proposals WHERE LOWER(target_device_id_str) = LOWER(?) AND status = 'PENDING_APPROVAL'`,
        [device_id.trim()]
      );
      if (propMatch) matchedProposals.push({ ...propMatch, match_type: 'Trùng Mã thiết bị đang chờ duyệt' });
    }

    // Check by Name or Pole Number in same Feeder/Substation
    if (name && feeder_id) {
      const nameMatch = dbQuery(
        `SELECT id, device_id, name, pole_number, device_type FROM devices WHERE LOWER(name) = LOWER(?) AND feeder_id = ? AND deleted_at IS NULL`,
        [name.trim(), feeder_id]
      );
      nameMatch.forEach(d => matchedDevices.push({ ...d, match_type: 'Trùng tên thiết bị trên cùng phát tuyến' }));
    }

    if (pole_number && pole_number.trim() && feeder_id) {
      const poleMatch = dbQuery(
        `SELECT id, device_id, name, pole_number, device_type FROM devices WHERE LOWER(pole_number) = LOWER(?) AND feeder_id = ? AND deleted_at IS NULL`,
        [pole_number.trim(), feeder_id]
      );
      poleMatch.forEach(d => {
        if (!matchedDevices.some(m => m.id === d.id)) {
          matchedDevices.push({ ...d, match_type: 'Trùng số trụ trên cùng phát tuyến' });
        }
      });
    }

    const isDuplicate = matchedDevices.length > 0 || matchedProposals.length > 0;
    let warningMessage = 'Không phát hiện trùng lặp thiết bị.';
    if (isDuplicate) {
      warningMessage = 'Có thể thiết bị này đã tồn tại trong danh mục chính thức hoặc đang có đề xuất chờ duyệt!';
    }

    return res.json({
      success: true,
      is_duplicate: isDuplicate,
      warning_message: warningMessage,
      matched_devices: matchedDevices,
      matched_proposals: matchedProposals
    });
  } catch (err: any) {
    console.error('Error checking duplicate:', err);
    return res.status(500).json({ success: false, message: 'Lỗi kiểm tra trùng thiết bị' });
  }
});

// 2. Submit New Device Proposal
router.post(
  '/',
  authenticateToken,
  denyGuestMutations,
  requirePermission('proposals:create'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        type, // 'CREATE' | 'UPDATE' | 'LOCATION' | 'STATUS' | 'DELETE' | 'IMAGE'
        device_id, // number (id) if updating/deleting existing device
        target_device_id_str,
        device_name,
        proposed_data, // object
        reason
      } = req.body;

      const validTypes = ['CREATE', 'UPDATE', 'LOCATION', 'STATUS', 'DELETE', 'IMAGE'];
      if (!type || !validTypes.includes(type)) {
        return res.status(400).json({ success: false, message: 'Loại đề xuất không hợp lệ' });
      }

      if (!proposed_data || typeof proposed_data !== 'object') {
        return res.status(400).json({ success: false, message: 'Dữ liệu đề xuất không hợp lệ' });
      }

      let currentDataObj: any = null;
      let targetDevStr = target_device_id_str || proposed_data.device_id || proposed_data.device_code || '';
      let targetName = device_name || proposed_data.name || '';

      if (device_id) {
        const existingDevice = dbQueryOne(`SELECT * FROM devices WHERE id = ? AND deleted_at IS NULL`, [device_id]);
        if (existingDevice) {
          currentDataObj = existingDevice;
          if (!targetDevStr) targetDevStr = existingDevice.device_id;
          if (!targetName) targetName = existingDevice.name;
        }
      }

      const requestCode = generateRequestCode();
      const user = req.user!;

      dbRun(
        `INSERT INTO device_proposals (
          request_code, type, device_id, target_device_id_str, device_name,
          proposed_data, current_data, reason, status,
          requester_id, requester_username, requester_fullname, requester_unit, requester_team
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL', ?, ?, ?, ?, ?)`,
        [
          requestCode,
          type,
          device_id || null,
          targetDevStr || 'N/A',
          targetName || 'Thiết bị mới',
          JSON.stringify(proposed_data),
          currentDataObj ? JSON.stringify(currentDataObj) : null,
          reason || '',
          user.id,
          user.username,
          user.full_name,
          user.unit || '',
          user.team || ''
        ]
      );

      const createdProposal = dbQueryOne(
        `SELECT * FROM device_proposals WHERE request_code = ?`,
        [requestCode]
      );

      recordAuditLog({
        user_id: user.id,
        username: user.username,
        user_fullname: user.full_name,
        action: 'CREATE_DEVICE_PROPOSAL',
        module: 'QUAN_LY_THIET_BI',
        target_id: createdProposal?.id,
        details: `Tạo đề xuất [${requestCode}] loại ${type} cho thiết bị "${targetName}" (${targetDevStr})`,
        result: 'SUCCESS',
        ip_address: req.ip
      });

      broadcastRealtimeEvent({
        type: 'PROPOSAL_CREATED',
        entity: 'device_proposals',
        id: createdProposal?.id
      });

      return res.status(201).json({
        success: true,
        message: `Đã gửi đề xuất [${requestCode}] thành công. Đề xuất đang chờ cấp quản lý phê duyệt.`,
        data: {
          ...createdProposal,
          proposed_data: JSON.parse(createdProposal.proposed_data || '{}'),
          current_data: createdProposal.current_data ? JSON.parse(createdProposal.current_data) : null
        }
      });
    } catch (err: any) {
      console.error('Error submitting proposal:', err);
      return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo đề xuất' });
    }
  }
);

// 3. Get List of Proposals
router.get('/', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, type, search } = req.query;

    let sql = `SELECT * FROM device_proposals WHERE 1=1`;
    const params: any[] = [];

    // Filter by Scope if user is non-admin and restricted
    const isAdminOrReviewer = req.user?.roles.some(r =>
      ['ADMIN', 'CAN_BO_PHUONG_THUC', 'TRUONG_CA', 'PHO_CA', 'DOI_TRUONG'].includes(r)
    );
    const isGlobalScope = req.user?.scopes?.some(s =>
      s.scope_type === 'SYSTEM' || s.scope_value === 'TOAN_HE_THONG' || s.scope_value === 'ALL'
    );

    if (req.user && !isAdminOrReviewer && !isGlobalScope) {
      console.log('[DEBUG] Applying scope filter for user:', req.user.username, req.user.scopes);
      const scope = req.user.scopes[0];
      if (scope && scope.scope_type === 'DON_VI' && scope.scope_value && scope.scope_value !== 'TOAN_HE_THONG') {
        sql += ` AND (requester_unit = ? OR requester_unit LIKE ? OR requester_unit IS NULL OR requester_unit = '')`;
        params.push(scope.scope_value, `%${scope.scope_value}%`);
      } else if (scope && scope.scope_type === 'DOI' && scope.scope_value && scope.scope_value !== 'TOAN_HE_THONG') {
        sql += ` AND (requester_team = ? OR requester_team LIKE ? OR requester_team IS NULL OR requester_team = '')`;
        params.push(scope.scope_value, `%${scope.scope_value}%`);
      }
    }

    console.log('[DEBUG] SQL:', sql, 'PARAMS:', params);

    if (status && status !== 'ALL') {
      if (status === 'PENDING_APPROVAL' || status === 'PENDING') {
        sql += ` AND (status = 'PENDING_APPROVAL' OR status = 'PENDING')`;
      } else {
        sql += ` AND status = ?`;
        params.push(status);
      }
    }

    if (type && type !== 'ALL') {
      sql += ` AND type = ?`;
      params.push(type);
    }

    if (search) {
      sql += ` AND (request_code LIKE ? OR device_name LIKE ? OR target_device_id_str LIKE ? OR requester_fullname LIKE ? OR reason LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }

    sql += ` ORDER BY id DESC`;

    const rows = dbQuery(sql, params);
    const parsed = rows.map(r => ({
      ...r,
      proposed_data: r.proposed_data ? JSON.parse(r.proposed_data) : {},
      current_data: r.current_data ? JSON.parse(r.current_data) : null
    }));

    return res.json({ success: true, data: parsed });
  } catch (err: any) {
    console.error('Error fetching proposals:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách đề xuất' });
  }
});

// 4. Get My Proposals (Operator Proposals)
router.get('/my-proposals', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { status, type, search } = req.query;

    let sql = `SELECT * FROM device_proposals WHERE requester_id = ?`;
    const params: any[] = [userId];

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    if (type) {
      sql += ` AND type = ?`;
      params.push(type);
    }

    if (search) {
      sql += ` AND (request_code LIKE ? OR device_name LIKE ? OR target_device_id_str LIKE ? OR reason LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY id DESC`;

    const rows = dbQuery(sql, params);
    const parsed = rows.map(r => ({
      ...r,
      proposed_data: r.proposed_data ? JSON.parse(r.proposed_data) : {},
      current_data: r.current_data ? JSON.parse(r.current_data) : null
    }));

    return res.json({ success: true, data: parsed });
  } catch (err: any) {
    console.error('Error fetching my proposals:', err);
    return res.status(500).json({ success: false, message: 'Lỗi lấy danh sách đề xuất của tôi' });
  }
});

// 5. Get Single Proposal Details
router.get('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const proposal = dbQueryOne(`SELECT * FROM device_proposals WHERE id = ?`, [id]);

    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin đề xuất' });
    }

    return res.json({
      success: true,
      data: {
        ...proposal,
        proposed_data: proposal.proposed_data ? JSON.parse(proposal.proposed_data) : {},
        current_data: proposal.current_data ? JSON.parse(proposal.current_data) : null
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Lỗi xem chi tiết đề xuất' });
  }
});

// 6. Review Proposal (Approve / Reject)
router.post(
  '/:id/review',
  authenticateToken,
  denyGuestMutations,
  requirePermission('proposals:review'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { action, review_notes } = req.body; // 'APPROVED' | 'REJECTED'

      if (!['APPROVED', 'REJECTED'].includes(action)) {
        return res.status(400).json({ success: false, message: 'Hành động phê duyệt không hợp lệ (APPROVED/REJECTED)' });
      }

      const proposal = dbQueryOne(`SELECT * FROM device_proposals WHERE id = ?`, [id]);
      if (!proposal) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy đề xuất cần duyệt' });
      }

      if (proposal.status !== 'PENDING_APPROVAL') {
        return res.status(400).json({
          success: false,
          message: `Đề xuất này đã ở trạng thái ${proposal.status}, không thể xử lý lại!`
        });
      }

      const reviewer = req.user!;
      const proposedObj = JSON.parse(proposal.proposed_data || '{}');

      try {
        dbRun('BEGIN TRANSACTION;');

        if (action === 'APPROVED') {
          // Execute changes on official database according to proposal type
          if (proposal.type === 'CREATE') {
            // Check unique device_id first
            const devIdStr = (proposedObj.device_id || proposedObj.device_code || '').trim();
            const existingDev = dbQueryOne(
              `SELECT id FROM devices WHERE LOWER(device_id) = LOWER(?) AND deleted_at IS NULL`,
              [devIdStr]
            );

            if (existingDev) {
              dbRun('ROLLBACK;');
              return res.status(400).json({
                success: false,
                message: `Mã thiết bị "${devIdStr}" đã tồn tại trên hệ thống chính thức! Không thể phê duyệt thêm mới.`
              });
            }

            const rawType = (proposedObj.device_type || 'LBS').toUpperCase();
            const validDeviceType = ['LBS', 'DS', 'RCL', 'REC', 'RMU', 'OTHER'].includes(rawType)
              ? (rawType === 'REC' ? 'RCL' : rawType)
              : 'LBS';

            const rawStatus = (proposedObj.status || 'ACTIVE').toUpperCase();
            const validStatus = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'].includes(rawStatus)
              ? rawStatus
              : 'ACTIVE';

            const rawSwitch = (proposedObj.switch_status || 'UNKNOWN').toUpperCase();
            const validSwitch = ['CLOSED', 'OPEN', 'UNKNOWN'].includes(rawSwitch)
              ? rawSwitch
              : (rawSwitch.includes('ĐÓNG') || rawSwitch.includes('VẬN HÀNH') || rawSwitch.includes('ON') ? 'CLOSED' : 'UNKNOWN');

            const rawScada = (proposedObj.scada_status || 'UNKNOWN').toUpperCase();
            const validScada = ['SIGNAL', 'NO_SIGNAL', 'UNKNOWN'].includes(rawScada)
              ? rawScada
              : (rawScada.includes('CÓ') ? 'SIGNAL' : 'UNKNOWN');

            const rawRelay = (proposedObj.relay_79 || 'N_A').toUpperCase();
            const validRelay = ['ON', 'OFF', 'N_A'].includes(rawRelay) ? rawRelay : 'N_A';

            const feederIdNum = Number(proposedObj.feeder_id);
            const substationIdNum = Number(proposedObj.substation_id);
            const validFeederId = !isNaN(feederIdNum) && feederIdNum > 0 ? feederIdNum : null;
            const validSubstationId = !isNaN(substationIdNum) && substationIdNum > 0 ? substationIdNum : null;

            dbRun(
              `INSERT INTO devices (
                device_id, device_code, name, device_type, pole_number, feeder_id, substation_id,
                unit, team, status, switch_status, scada_status, relay_79, battery_status,
                latitude, longitude, google_maps_url, notes, created_by
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                devIdStr,
                proposedObj.device_code || devIdStr,
                proposedObj.name,
                validDeviceType,
                proposedObj.pole_number || '',
                validFeederId,
                validSubstationId,
                proposedObj.unit || proposal.requester_unit || 'Công ty Điện lực Bình Dương',
                proposedObj.team || proposal.requester_team || 'ĐỘI VẬN HÀNH LƯỚI ĐIỆN',
                validStatus,
                validSwitch,
                validScada,
                validRelay,
                cleanBatteryStatus(proposedObj.battery_status, 'UNCHECKED'),
                proposedObj.latitude ? parseFloat(proposedObj.latitude) : null,
                proposedObj.longitude ? parseFloat(proposedObj.longitude) : null,
                proposedObj.google_maps_url || '',
                proposedObj.notes || 'Tạo từ Đề xuất ' + proposal.request_code,
                proposal.requester_username
              ]
            );

            const newDev = dbQueryOne(`SELECT id FROM devices WHERE device_id = ?`, [devIdStr]);
            if (newDev) {
              if (proposedObj.image_url) {
                dbRun(
                  `INSERT INTO device_images (device_id, image_url, is_primary, caption, created_by) VALUES (?, ?, 1, 'Hình ảnh hiện trường từ đề xuất', ?)`,
                  [newDev.id, proposedObj.image_url, proposal.requester_username]
                );
              }
              dbRun(
                `INSERT INTO device_locations (device_id, latitude, longitude, google_maps_url, note, updated_by) VALUES (?, ?, ?, ?, 'Tọa độ GPS phê duyệt từ đề xuất', ?)`,
                [
                  newDev.id,
                  proposedObj.latitude ? parseFloat(proposedObj.latitude) : null,
                  proposedObj.longitude ? parseFloat(proposedObj.longitude) : null,
                  proposedObj.google_maps_url || '',
                  reviewer.username
                ]
              );
            }
          } else if (proposal.type === 'UPDATE' && proposal.device_id) {
            dbRun(
              `UPDATE devices SET
                name = COALESCE(?, name),
                device_type = COALESCE(?, device_type),
                pole_number = COALESCE(?, pole_number),
                feeder_id = COALESCE(?, feeder_id),
                substation_id = COALESCE(?, substation_id),
                unit = COALESCE(?, unit),
                team = COALESCE(?, team),
                notes = COALESCE(?, notes),
                updated_at = CURRENT_TIMESTAMP,
                updated_by = ?
               WHERE id = ?`,
              [
                proposedObj.name,
                proposedObj.device_type,
                proposedObj.pole_number,
                proposedObj.feeder_id,
                proposedObj.substation_id,
                proposedObj.unit,
                proposedObj.team,
                proposedObj.notes,
                reviewer.username,
                proposal.device_id
              ]
            );
          } else if (proposal.type === 'LOCATION' && proposal.device_id) {
            dbRun(
              `UPDATE devices SET
                latitude = ?,
                longitude = ?,
                google_maps_url = ?,
                updated_at = CURRENT_TIMESTAMP,
                updated_by = ?
               WHERE id = ?`,
              [
                proposedObj.latitude ? parseFloat(proposedObj.latitude) : null,
                proposedObj.longitude ? parseFloat(proposedObj.longitude) : null,
                proposedObj.google_maps_url || '',
                reviewer.username,
                proposal.device_id
              ]
            );

            dbRun(
              `INSERT INTO device_locations (device_id, latitude, longitude, google_maps_url, note, updated_by)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                proposal.device_id,
                proposedObj.latitude ? parseFloat(proposedObj.latitude) : null,
                proposedObj.longitude ? parseFloat(proposedObj.longitude) : null,
                proposedObj.google_maps_url || '',
                proposedObj.notes || `Cập nhật tọa độ từ đề xuất ${proposal.request_code}`,
                reviewer.username
              ]
            );

            if (proposedObj.image_url) {
              dbRun(
                `INSERT INTO device_images (device_id, image_url, is_primary, caption, created_by) VALUES (?, ?, 0, 'Hình ảnh minh họa vị trí từ đề xuất', ?)`,
                [proposal.device_id, proposedObj.image_url, proposal.requester_username]
              );
            }
          } else if (proposal.type === 'STATUS' && proposal.device_id) {
            const devBefore = dbQueryOne(`SELECT * FROM devices WHERE id = ?`, [proposal.device_id]);
            const oldSwitch = devBefore?.switch_status || 'UNKNOWN';
            const oldScada = devBefore?.scada_status || 'UNKNOWN';
            const oldRelay = devBefore?.relay_79 || 'N_A';

            const newSwitch = proposedObj.switch_status || oldSwitch;
            const newScada = proposedObj.scada_status || oldScada;
            const newRelay = proposedObj.relay_79 || oldRelay;
            const newDevStatus = proposedObj.status || devBefore?.status || 'ACTIVE';

            dbRun(
              `UPDATE devices SET
                switch_status = ?,
                scada_status = ?,
                relay_79 = ?,
                status = ?,
                updated_at = CURRENT_TIMESTAMP,
                updated_by = ?
               WHERE id = ?`,
              [newSwitch, newScada, newRelay, newDevStatus, reviewer.username, proposal.device_id]
            );

            dbRun(
              `INSERT INTO device_status_history (device_id, old_switch_status, new_switch_status, old_scada_status, new_scada_status, old_relay_79, new_relay_79, note, updated_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                proposal.device_id,
                oldSwitch,
                newSwitch,
                oldScada,
                newScada,
                oldRelay,
                newRelay,
                proposedObj.notes || `Cập nhật trạng thái từ đề xuất ${proposal.request_code}`,
                reviewer.username
              ]
            );

            if (proposedObj.image_url) {
              dbRun(
                `INSERT INTO device_images (device_id, image_url, is_primary, caption, created_by) VALUES (?, ?, 0, 'Ảnh hiện trường thay đổi trạng thái', ?)`,
                [proposal.device_id, proposedObj.image_url, proposal.requester_username]
              );
            }
          } else if (proposal.type === 'DELETE' && proposal.device_id) {
            dbRun(
              `UPDATE devices SET deleted_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?`,
              [reviewer.username, proposal.device_id]
            );
          } else if (proposal.type === 'IMAGE' && proposal.device_id) {
            if (proposedObj.image_url) {
              dbRun(
                `INSERT INTO device_images (device_id, image_url, is_primary, caption, created_by) VALUES (?, ?, ?, ?, ?)`,
                [
                  proposal.device_id,
                  proposedObj.image_url,
                  proposedObj.is_primary ? 1 : 0,
                  proposedObj.caption || 'Hình ảnh tải lên từ hiện trường',
                  proposal.requester_username
                ]
              );
            }
          }
        }

        // Update proposal status
        dbRun(
          `UPDATE device_proposals SET
            status = ?,
            reviewer_id = ?,
            reviewer_username = ?,
            reviewer_fullname = ?,
            review_notes = ?,
            updated_at = CURRENT_TIMESTAMP,
            reviewed_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [action, reviewer.id, reviewer.username, reviewer.full_name, review_notes || '', id]
        );

        dbRun('COMMIT;');
      } catch (txnErr) {
        dbRun('ROLLBACK;');
        throw txnErr;
      }

      // Send Notification to Requester
      const notifTitle = action === 'APPROVED' ? 'Đề xuất đã được PHÊ DUYỆT' : 'Đề xuất bị TỪ CHỐI';
      const notifMsg = action === 'APPROVED'
        ? `Đề xuất mã [${proposal.request_code}] cho thiết bị "${proposal.device_name}" đã được ${reviewer.full_name} phê duyệt và cập nhật vào hệ thống chính thức.`
        : `Đề xuất mã [${proposal.request_code}] cho thiết bị "${proposal.device_name}" bị từ chối. Lý do: ${review_notes || 'Không có ghi chú'}`;

      dbRun(
        `INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?)`,
        [
          proposal.requester_id,
          notifTitle,
          notifMsg,
          action === 'APPROVED' ? 'INFO' : 'ALERT',
          '/my-proposals'
        ]
      );

      recordAuditLog({
        user_id: reviewer.id,
        username: reviewer.username,
        user_fullname: reviewer.full_name,
        action: action === 'APPROVED' ? 'APPROVE_DEVICE_PROPOSAL' : 'REJECT_DEVICE_PROPOSAL',
        module: 'QUAN_LY_THIET_BI',
        target_id: id,
        details: `Phê duyệt đề xuất [${proposal.request_code}] (${action}): ${review_notes || 'Không ghi chú'}`,
        result: 'SUCCESS',
        ip_address: req.ip
      });

      broadcastRealtimeEvent({
        type: 'PROPOSAL_REVIEWED',
        entity: 'device_proposals',
        id: Number(id)
      });

      return res.json({
        success: true,
        message: action === 'APPROVED' ? 'Đã phê duyệt đề xuất và cập nhật dữ liệu chính thức.' : 'Đã từ chối đề xuất.',
        data: dbQueryOne(`SELECT * FROM device_proposals WHERE id = ?`, [id])
      });
    } catch (err: any) {
      console.error('Error reviewing proposal:', err);
      return res.status(400).json({ success: false, message: `Lỗi phê duyệt: ${err.message || 'Lỗi hệ thống cơ sở dữ liệu'}` });
    }
  }
);

export default router;
