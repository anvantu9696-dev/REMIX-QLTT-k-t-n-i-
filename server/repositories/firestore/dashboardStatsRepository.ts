import { getTargetFirestore } from '../../firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { getCached, setCached, invalidateNamespace, logFirebaseRead, logFirebaseWrite, logCacheHit, TTL_DASHBOARD_STATS } from '../../utils/firestoreCache';

export interface DashboardStatsData {
  total_equipment: number;
  total_stations_110kv: number;
  total_feeders: number;
  total_ring_loops: number;
  total_tasks: number;
  active_tasks: number;
  pending_approval_tasks: number;
  today_tasks: number;
  overdue_tasks: number;
  completed_today: number;
  upcoming_inspections: number;
  active_issues: number;
  critical_issues: number;
  uninspected_devices: number;
  open_devices: number;
  scada_no_signal: number;
  users_count: number;
  recent_audit_count: number;
  total_devices?: number;
  active_devices?: number;
  maintenance_devices?: number;
  inactive_devices?: number;
}

export const dashboardStatsRepo = {
  /**
   * Retrieves dashboard statistics.
   * Priority:
   * 1. In-Memory Cache (TTL 5 mins) -> 0 Firestore Reads
   * 2. Document `system_stats/dashboard` -> 1 Firestore Read
   * 3. Fallback/Bootstrap -> runs count aggregations once and persists to `system_stats/dashboard`
   */
  async getStats(): Promise<DashboardStatsData> {
    const cached = getCached<DashboardStatsData>('dashboard_stats');
    if (cached) {
      logCacheHit('dashboard_stats');
      return cached;
    }

    const db = getTargetFirestore();
    const docRef = db.collection('system_stats').doc('dashboard');

    try {
      const docSnap = await docRef.get();
      logFirebaseRead('system_stats', 'doc(dashboard)', docSnap.exists ? 1 : 0);

      if (docSnap.exists) {
        const data = docSnap.data() || {};
        const totalDevs = Math.max(0, Number(data.total_devices ?? data.total_equipment ?? 0));
        const activeDevs = Math.max(0, Number(data.active_devices ?? 0));
        const maintDevs = Math.max(0, Number(data.maintenance_devices ?? 0));
        const inactDevs = Math.max(0, Number(data.inactive_devices ?? 0));

        const stats: DashboardStatsData = {
          total_equipment: totalDevs,
          total_stations_110kv: Math.max(0, Number(data.total_substations ?? data.total_stations_110kv ?? 0)),
          total_feeders: Math.max(0, Number(data.total_feeders ?? 0)),
          total_ring_loops: Math.max(0, Number(data.total_ring_loops ?? 0)),
          total_tasks: Math.max(0, Number(data.total_tasks ?? 0)),
          active_tasks: Math.max(0, Number(data.active_tasks ?? 0)),
          pending_approval_tasks: Math.max(0, Number(data.pending_approval_tasks ?? 0)),
          today_tasks: Math.max(0, Number(data.today_tasks ?? 0)),
          overdue_tasks: Math.max(0, Number(data.overdue_tasks ?? 0)),
          completed_today: Math.max(0, Number(data.completed_today ?? 0)),
          upcoming_inspections: Math.max(0, Number(data.upcoming_inspections ?? 0)),
          active_issues: Math.max(0, Number(data.active_issues ?? 0)),
          critical_issues: Math.max(0, Number(data.critical_issues ?? 0)),
          uninspected_devices: Math.max(0, Number(data.uninspected_devices ?? 0)),
          open_devices: Math.max(0, Number(data.open_devices ?? 0)),
          scada_no_signal: Math.max(0, Number(data.scada_no_signal ?? 0)),
          users_count: Math.max(0, Number(data.users_count ?? 0)),
          recent_audit_count: Math.max(0, Number(data.recent_audit_count ?? 0)),
          total_devices: totalDevs,
          active_devices: activeDevs,
          maintenance_devices: maintDevs,
          inactive_devices: inactDevs
        };

        setCached('dashboard_stats', stats, TTL_DASHBOARD_STATS, 'dashboard_stats');
        return stats;
      }
    } catch (err) {
      console.warn('Could not read system_stats/dashboard, bootstrapping...', err);
    }

    // If document is missing or error, bootstrap once
    return this.bootstrapStats();
  },

  /**
   * Runs the count aggregations one-time to calculate accurate baselines
   * and saves the document `system_stats/dashboard`.
   */
  async bootstrapStats(): Promise<DashboardStatsData> {
    const db = getTargetFirestore();

    try {
      const [
        usersSnap,
        stationsSnap,
        feedersSnap,
        devicesSnap,
        activeDevsSnap,
        maintDevsSnap,
        inactDevsSnap,
        openDevsSnap,
        noSignalDevsSnap,
        loopsSnap,
        totalTasksSnap,
        activeTasksSnap,
        pendingTasksSnap,
        auditLogsSnap
      ] = await Promise.all([
        db.collection('users').count().get().catch(() => ({ data: () => ({ count: 0 }) })),
        db.collection('substations').where('isDeleted', '==', false).count().get().catch(() => ({ data: () => ({ count: 0 }) })),
        db.collection('feeders').where('isDeleted', '==', false).count().get().catch(() => ({ data: () => ({ count: 0 }) })),
        db.collection('devices').where('isDeleted', '==', false).count().get().catch(() => ({ data: () => ({ count: 0 }) })),
        db.collection('devices').where('isDeleted', '==', false).where('status', '==', 'ACTIVE').count().get().catch(() => ({ data: () => ({ count: 0 }) })),
        db.collection('devices').where('isDeleted', '==', false).where('status', '==', 'MAINTENANCE').count().get().catch(() => ({ data: () => ({ count: 0 }) })),
        db.collection('devices').where('isDeleted', '==', false).where('status', '==', 'INACTIVE').count().get().catch(() => ({ data: () => ({ count: 0 }) })),
        db.collection('devices').where('isDeleted', '==', false).where('switch_status', '==', 'OPEN').count().get().catch(() => ({ data: () => ({ count: 0 }) })),
        db.collection('devices').where('isDeleted', '==', false).where('scada_status', '==', 'NO_SIGNAL').count().get().catch(() => ({ data: () => ({ count: 0 }) })),
        db.collection('loops').where('isDeleted', '==', false).count().get().catch(() => ({ data: () => ({ count: 0 }) })),
        db.collection('tasks').where('deleted_at', '==', null).count().get().catch(() => ({ data: () => ({ count: 0 }) })),
        db.collection('tasks').where('deleted_at', '==', null).where('status', 'in', ['NEW', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS']).count().get().catch(() => ({ data: () => ({ count: 0 }) })),
        db.collection('tasks').where('deleted_at', '==', null).where('status', '==', 'PENDING_APPROVAL').count().get().catch(() => ({ data: () => ({ count: 0 }) })),
        db.collection('audit_logs').count().get().catch(() => ({ data: () => ({ count: 0 }) }))
      ]);

      logFirebaseRead('dashboard_stats', 'bootstrap_counts', 14);

      const totalDevices = devicesSnap.data().count || 0;
      const totalStations = stationsSnap.data().count || 0;
      const totalFeeders = feedersSnap.data().count || 0;
      const totalLoops = loopsSnap.data().count || 0;
      const activeDevices = activeDevsSnap.data().count || 0;
      const maintDevices = maintDevsSnap.data().count || 0;
      const inactDevices = inactDevsSnap.data().count || 0;
      const openDevices = openDevsSnap.data().count || 0;
      const scadaNoSignal = noSignalDevsSnap.data().count || 0;
      const totalTasks = totalTasksSnap.data().count || 0;
      const activeTasks = activeTasksSnap.data().count || 0;
      const pendingTasks = pendingTasksSnap.data().count || 0;
      const usersCount = usersSnap.data().count || 0;
      const auditCount = auditLogsSnap.data().count || 0;

      const docPayload = {
        total_devices: totalDevices,
        total_substations: totalStations,
        total_feeders: totalFeeders,
        total_ring_loops: totalLoops,
        active_devices: activeDevices,
        maintenance_devices: maintDevices,
        inactive_devices: inactDevices,
        open_devices: openDevices,
        scada_no_signal: scadaNoSignal,
        total_tasks: totalTasks,
        active_tasks: activeTasks,
        pending_approval_tasks: pendingTasks,
        today_tasks: 0,
        overdue_tasks: 0,
        completed_today: 0,
        upcoming_inspections: 0,
        active_issues: 0,
        critical_issues: 0,
        uninspected_devices: 0,
        users_count: usersCount,
        recent_audit_count: auditCount,
        updated_at: FieldValue.serverTimestamp()
      };

      await db.collection('system_stats').doc('dashboard').set(docPayload, { merge: true });
      logFirebaseWrite('system_stats', 'dashboard', 'BOOTSTRAP_SET');

      const stats: DashboardStatsData = {
        total_equipment: totalDevices,
        total_stations_110kv: totalStations,
        total_feeders: totalFeeders,
        total_ring_loops: totalLoops,
        total_tasks: totalTasks,
        active_tasks: activeTasks,
        pending_approval_tasks: pendingTasks,
        today_tasks: 0,
        overdue_tasks: 0,
        completed_today: 0,
        upcoming_inspections: 0,
        active_issues: 0,
        critical_issues: 0,
        uninspected_devices: 0,
        open_devices: openDevices,
        scada_no_signal: scadaNoSignal,
        users_count: usersCount,
        recent_audit_count: auditCount,
        total_devices: totalDevices,
        active_devices: activeDevices,
        maintenance_devices: maintDevices,
        inactive_devices: inactDevices
      };

      invalidateNamespace('dashboard_stats');
      setCached('dashboard_stats', stats, TTL_DASHBOARD_STATS, 'dashboard_stats');
      return stats;
    } catch (err) {
      console.error('Error bootstrapping dashboard stats:', err);
      return {
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
        recent_audit_count: 0,
        total_devices: 0,
        active_devices: 0,
        maintenance_devices: 0,
        inactive_devices: 0
      };
    }
  },

  /**
   * Atomically records a device creation
   */
  async recordDeviceCreated(data: { status?: string; switch_status?: string; scada_status?: string }, transaction?: FirebaseFirestore.Transaction) {
    const db = getTargetFirestore();
    const docRef = db.collection('system_stats').doc('dashboard');

    const updates: Record<string, any> = {
      total_devices: FieldValue.increment(1),
      updated_at: FieldValue.serverTimestamp()
    };

    const status = data.status || 'ACTIVE';
    if (status === 'ACTIVE') updates.active_devices = FieldValue.increment(1);
    else if (status === 'MAINTENANCE') updates.maintenance_devices = FieldValue.increment(1);
    else if (status === 'INACTIVE') updates.inactive_devices = FieldValue.increment(1);

    if (data.switch_status === 'OPEN') updates.open_devices = FieldValue.increment(1);
    if (data.scada_status === 'NO_SIGNAL') updates.scada_no_signal = FieldValue.increment(1);

    if (transaction) {
      transaction.set(docRef, updates, { merge: true });
    } else {
      await docRef.set(updates, { merge: true });
    }
    invalidateNamespace('dashboard_stats');
  },

  /**
   * Atomically records a device deletion
   */
  async recordDeviceDeleted(oldData: { status?: string; switch_status?: string; scada_status?: string }, transaction?: FirebaseFirestore.Transaction) {
    const db = getTargetFirestore();
    const docRef = db.collection('system_stats').doc('dashboard');

    const updates: Record<string, any> = {
      total_devices: FieldValue.increment(-1),
      updated_at: FieldValue.serverTimestamp()
    };

    const status = oldData.status || 'ACTIVE';
    if (status === 'ACTIVE') updates.active_devices = FieldValue.increment(-1);
    else if (status === 'MAINTENANCE') updates.maintenance_devices = FieldValue.increment(-1);
    else if (status === 'INACTIVE') updates.inactive_devices = FieldValue.increment(-1);

    if (oldData.switch_status === 'OPEN') updates.open_devices = FieldValue.increment(-1);
    if (oldData.scada_status === 'NO_SIGNAL') updates.scada_no_signal = FieldValue.increment(-1);

    if (transaction) {
      transaction.set(docRef, updates, { merge: true });
    } else {
      await docRef.set(updates, { merge: true });
    }
    invalidateNamespace('dashboard_stats');
  },

  /**
   * Atomically records device property changes (status, switch_status, scada_status)
   */
  async recordDeviceUpdated(
    oldData: { status?: string; switch_status?: string; scada_status?: string },
    newData: { status?: string; switch_status?: string; scada_status?: string },
    transaction?: FirebaseFirestore.Transaction
  ) {
    const updates: Record<string, any> = {};

    // 1. Status change (ACTIVE <-> MAINTENANCE <-> INACTIVE)
    const oldStatus = oldData.status || 'ACTIVE';
    const newStatus = newData.status !== undefined ? newData.status : oldStatus;

    if (oldStatus !== newStatus) {
      if (oldStatus === 'ACTIVE') updates.active_devices = FieldValue.increment(-1);
      else if (oldStatus === 'MAINTENANCE') updates.maintenance_devices = FieldValue.increment(-1);
      else if (oldStatus === 'INACTIVE') updates.inactive_devices = FieldValue.increment(-1);

      if (newStatus === 'ACTIVE') updates.active_devices = FieldValue.increment(1);
      else if (newStatus === 'MAINTENANCE') updates.maintenance_devices = FieldValue.increment(1);
      else if (newStatus === 'INACTIVE') updates.inactive_devices = FieldValue.increment(1);
    }

    // 2. Switch status change
    const oldSwitch = oldData.switch_status || 'CLOSED';
    const newSwitch = newData.switch_status !== undefined ? newData.switch_status : oldSwitch;
    if (oldSwitch !== newSwitch) {
      if (oldSwitch === 'OPEN' && newSwitch !== 'OPEN') updates.open_devices = FieldValue.increment(-1);
      else if (oldSwitch !== 'OPEN' && newSwitch === 'OPEN') updates.open_devices = FieldValue.increment(1);
    }

    // 3. SCADA status change
    const oldScada = oldData.scada_status || 'SIGNAL';
    const newScada = newData.scada_status !== undefined ? newData.scada_status : oldScada;
    if (oldScada !== newScada) {
      if (oldScada === 'NO_SIGNAL' && newScada !== 'NO_SIGNAL') updates.scada_no_signal = FieldValue.increment(-1);
      else if (oldScada !== 'NO_SIGNAL' && newScada === 'NO_SIGNAL') updates.scada_no_signal = FieldValue.increment(1);
    }

    if (Object.keys(updates).length === 0) return;

    updates.updated_at = FieldValue.serverTimestamp();
    const db = getTargetFirestore();
    const docRef = db.collection('system_stats').doc('dashboard');

    if (transaction) {
      transaction.set(docRef, updates, { merge: true });
    } else {
      await docRef.set(updates, { merge: true });
    }
    invalidateNamespace('dashboard_stats');
  },

  /**
   * Substation delta
   */
  async recordSubstationDelta(delta: number, transaction?: FirebaseFirestore.Transaction) {
    const db = getTargetFirestore();
    const docRef = db.collection('system_stats').doc('dashboard');
    const updates = {
      total_substations: FieldValue.increment(delta),
      updated_at: FieldValue.serverTimestamp()
    };
    if (transaction) {
      transaction.set(docRef, updates, { merge: true });
    } else {
      await docRef.set(updates, { merge: true });
    }
    invalidateNamespace('dashboard_stats');
  },

  /**
   * Feeder delta
   */
  async recordFeederDelta(delta: number, transaction?: FirebaseFirestore.Transaction) {
    const db = getTargetFirestore();
    const docRef = db.collection('system_stats').doc('dashboard');
    const updates = {
      total_feeders: FieldValue.increment(delta),
      updated_at: FieldValue.serverTimestamp()
    };
    if (transaction) {
      transaction.set(docRef, updates, { merge: true });
    } else {
      await docRef.set(updates, { merge: true });
    }
    invalidateNamespace('dashboard_stats');
  },

  /**
   * Loop delta
   */
  async recordLoopDelta(delta: number, transaction?: FirebaseFirestore.Transaction) {
    const db = getTargetFirestore();
    const docRef = db.collection('system_stats').doc('dashboard');
    const updates = {
      total_ring_loops: FieldValue.increment(delta),
      updated_at: FieldValue.serverTimestamp()
    };
    if (transaction) {
      transaction.set(docRef, updates, { merge: true });
    } else {
      await docRef.set(updates, { merge: true });
    }
    invalidateNamespace('dashboard_stats');
  }
};
