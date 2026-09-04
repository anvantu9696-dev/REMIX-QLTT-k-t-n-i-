const fs = require('fs');

let code = `import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware';
import { getTargetFirestore } from '../firebaseAdmin';
import { getCached, setCached, logFirebaseRead, logCacheHit } from '../utils/firestoreCache';

const router = Router();
router.use(authenticateToken);

// GET /api/dashboard/stats
router.get('/stats', async (req: AuthenticatedRequest, res) => {
    const cachedStats = getCached<any>('dashboard_stats');
    if (cachedStats) {
      logCacheHit('dashboard_stats');
      return res.json({ success: true, data: cachedStats });
    }

    const db = getTargetFirestore();
    try {
      const [
        usersSnap,
        stationsSnap,
        feedersSnap,
        devicesSnap,
        loopsSnap,
        totalTasksSnap,
        activeTasksSnap,
        pendingApprovalTasksSnap,
        openDevicesSnap,
        noSignalDevicesSnap,
        auditLogsSnap
      ] = await Promise.all([
        db.collection('users').count().get(),
        db.collection('substations').where('isDeleted', '==', false).count().get(),
        db.collection('feeders').where('isDeleted', '==', false).count().get(),
        db.collection('devices').where('isDeleted', '==', false).count().get(),
        db.collection('loops').where('isDeleted', '==', false).count().get(),
        db.collection('tasks').where('isDeleted', '==', false).count().get(),
        db.collection('tasks').where('isDeleted', '==', false).where('status', 'in', ['NEW', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS']).count().get().catch(() => ({ data: () => ({ count: 0 }) })),
        db.collection('tasks').where('isDeleted', '==', false).where('status', '==', 'PENDING_APPROVAL').count().get().catch(() => ({ data: () => ({ count: 0 }) })),
        db.collection('devices').where('isDeleted', '==', false).where('switch_status', '==', 'OPEN').count().get().catch(() => ({ data: () => ({ count: 0 }) })),
        db.collection('devices').where('isDeleted', '==', false).where('scada_status', '==', 'NO_SIGNAL').count().get().catch(() => ({ data: () => ({ count: 0 }) })),
        db.collection('audit_logs').count().get()
      ]);

      logFirebaseRead('dashboard', 'count_aggregations', 11);

      const stats = {
        total_equipment: devicesSnap.data().count,
        total_stations_110kv: stationsSnap.data().count,
        total_feeders: feedersSnap.data().count,
        total_ring_loops: loopsSnap.data().count,
        total_tasks: totalTasksSnap.data().count,
        active_tasks: activeTasksSnap.data().count,
        pending_approval_tasks: pendingApprovalTasksSnap.data().count,
        today_tasks: 0,
        overdue_tasks: 0,
        completed_today: 0,
        upcoming_inspections: 0,
        active_issues: 0,
        critical_issues: 0,
        uninspected_devices: 0,
        open_devices: openDevicesSnap.data().count,
        scada_no_signal: noSignalDevicesSnap.data().count,
        users_count: usersSnap.data().count,
        recent_audit_count: auditLogsSnap.data().count
      };

      // Cache for 30s
      setCached('dashboard_stats', stats, 30000);
      return res.json({ success: true, data: stats });
    } catch (error) {
      console.error('Error fetching dashboard aggregation stats:', error);
      // Fallback
      return res.json({
        success: true,
        data: {
          total_equipment: 0,
          total_stations_110kv: 0,
          total_feeders: 0,
          total_ring_loops: 0,
          total_tasks: 0,
          active_tasks: 0,
          pending_approval_tasks: 0,
          today_tasks: 0,
          overdue_tasks: 0,
          completed_today: 0,
          upcoming_inspections: 0,
          active_issues: 0,
          critical_issues: 0,
          uninspected_devices: 0,
          open_devices: 0,
          scada_no_signal: 0,
          users_count: 0,
          recent_audit_count: 0
        }
      });
    }
});

export default router;
`;

fs.writeFileSync('server/routes/dashboard.ts', code);
