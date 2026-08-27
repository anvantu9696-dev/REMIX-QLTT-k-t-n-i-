import { Router } from 'express';
import { dbQueryOne } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware';
import { CORE_DATA_SOURCE } from '../config';
import { getTargetFirestore } from '../firebaseAdmin';

const router = Router();
router.use(authenticateToken);

// GET /api/dashboard/stats
router.get('/stats', async (req: AuthenticatedRequest, res) => {
  if (CORE_DATA_SOURCE === 'firestore') {
    const db = getTargetFirestore();
    const [
      usersSnap,
      stationsSnap,
      feedersSnap,
      devicesSnap,
      loopsSnap,
      tasksSnap
    ] = await Promise.all([
      db.collection('users').get(),
      db.collection('substations').where('isDeleted', '==', false).get(),
      db.collection('feeders').where('isDeleted', '==', false).get(),
      db.collection('devices').where('isDeleted', '==', false).get(),
      db.collection('loops').where('isDeleted', '==', false).get(),
      db.collection('tasks').get()
    ]);

    let active_tasks = 0;
    let pending_approval_tasks = 0;
    let today_tasks = 0;
    let overdue_tasks = 0;
    let completed_today = 0;
    const now = new Date();

    tasksSnap.forEach(doc => {
      const t = doc.data();
      if (!t.isDeleted) {
        if (['NEW', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'].includes(t.status)) active_tasks++;
        if (t.status === 'PENDING_APPROVAL') pending_approval_tasks++;
      }
    });

    const stats = {
      total_equipment: devicesSnap.size,
      total_stations_110kv: stationsSnap.size,
      total_feeders: feedersSnap.size,
      total_ring_loops: loopsSnap.size,
      active_tasks,
      pending_approval_tasks,
      today_tasks,
      overdue_tasks,
      completed_today,
      upcoming_inspections: 0,
      active_issues: 0,
      critical_issues: 0,
      uninspected_devices: 0,
      open_devices: 0,
      scada_no_signal: 0,
      users_count: usersSnap.size,
      recent_audit_count: 0
    };

    return res.json({ success: true, data: stats });
  }

  // Query real counts from DB tables
  const userCountRow = dbQueryOne(`SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL`);
  const stationCountRow = dbQueryOne(`SELECT COUNT(*) as count FROM substations WHERE deleted_at IS NULL`);
  const feederCountRow = dbQueryOne(`SELECT COUNT(*) as count FROM feeders WHERE deleted_at IS NULL`);
  const deviceCountRow = dbQueryOne(`SELECT COUNT(*) as count FROM devices WHERE deleted_at IS NULL`);
  const openDeviceRow = dbQueryOne(`SELECT COUNT(*) as count FROM devices WHERE switch_status = 'OPEN' AND deleted_at IS NULL`);
  const noSignalRow = dbQueryOne(`SELECT COUNT(*) as count FROM devices WHERE scada_status = 'NO_SIGNAL' AND deleted_at IS NULL`);
  const loopCountRow = dbQueryOne(`SELECT COUNT(*) as count FROM loops WHERE deleted_at IS NULL`);
  const auditCountRow = dbQueryOne(`SELECT COUNT(*) as count FROM audit_logs`);

  // Phase 4 Real Queries
  const activeTasksRow = dbQueryOne(`SELECT COUNT(*) as count FROM tasks WHERE status IN ('NEW', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS')`);
  const pendingApprovalTasksRow = dbQueryOne(`SELECT COUNT(*) as count FROM tasks WHERE status = 'PENDING_APPROVAL'`);
  const todayTasksRow = dbQueryOne(`SELECT COUNT(*) as count FROM tasks WHERE DATE(due_date) = DATE('now')`);
  const overdueTasksRow = dbQueryOne(`SELECT COUNT(*) as count FROM tasks WHERE due_date < datetime('now') AND status NOT IN ('COMPLETED', 'CANCELLED')`);
  const completedTodayRow = dbQueryOne(`SELECT COUNT(*) as count FROM tasks WHERE DATE(completed_at) = DATE('now') AND status = 'COMPLETED'`);
  
  const upcomingInspectionsRow = dbQueryOne(`SELECT COUNT(*) as count FROM inspection_schedules WHERE status = 'ACTIVE' AND next_run_date <= datetime('now', '+7 days')`);
  
  const activeIssuesRow = dbQueryOne(`SELECT COUNT(*) as count FROM issues WHERE status != 'CLOSED'`);
  const criticalIssuesRow = dbQueryOne(`SELECT COUNT(*) as count FROM issues WHERE severity IN ('HIGH', 'CRITICAL') AND status != 'CLOSED'`);

  // Uninspected devices: Devices that have no COMPLETED task in last 30 days
  const uninspectedRow = dbQueryOne(`
    SELECT COUNT(*) as count FROM devices d
    WHERE d.deleted_at IS NULL
      AND d.id NOT IN (
        SELECT DISTINCT device_id FROM tasks
        WHERE status = 'COMPLETED' AND completed_at >= datetime('now', '-30 days') AND device_id IS NOT NULL
      )
  `);

  const stats = {
    total_equipment: deviceCountRow ? (deviceCountRow.count as number) : 0,
    total_stations_110kv: stationCountRow ? (stationCountRow.count as number) : 0,
    total_feeders: feederCountRow ? (feederCountRow.count as number) : 0,
    total_ring_loops: loopCountRow ? (loopCountRow.count as number) : 0,
    active_tasks: activeTasksRow ? (activeTasksRow.count as number) : 0,
    pending_approval_tasks: pendingApprovalTasksRow ? (pendingApprovalTasksRow.count as number) : 0,
    today_tasks: todayTasksRow ? (todayTasksRow.count as number) : 0,
    overdue_tasks: overdueTasksRow ? (overdueTasksRow.count as number) : 0,
    completed_today: completedTodayRow ? (completedTodayRow.count as number) : 0,
    upcoming_inspections: upcomingInspectionsRow ? (upcomingInspectionsRow.count as number) : 0,
    active_issues: activeIssuesRow ? (activeIssuesRow.count as number) : 0,
    critical_issues: criticalIssuesRow ? (criticalIssuesRow.count as number) : 0,
    uninspected_devices: uninspectedRow ? (uninspectedRow.count as number) : 0,
    open_devices: openDeviceRow ? (openDeviceRow.count as number) : 0,
    scada_no_signal: noSignalRow ? (noSignalRow.count as number) : 0,
    users_count: userCountRow ? (userCountRow.count as number) : 0,
    recent_audit_count: auditCountRow ? (auditCountRow.count as number) : 0
  };

  return res.json({
    success: true,
    data: stats
  });
});

export default router;
