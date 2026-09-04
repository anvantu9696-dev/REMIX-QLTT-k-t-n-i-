import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware';
import { dashboardStatsRepo } from '../repositories/firestore/dashboardStatsRepository';

const router = Router();
router.use(authenticateToken);

// GET /api/dashboard/stats
router.get('/stats', async (req: AuthenticatedRequest, res) => {
  try {
    const stats = await dashboardStatsRepo.getStats();
    return res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error('Error fetching dashboard aggregation stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy số liệu thống kê Dashboard',
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
        recent_audit_count: 0,
        total_devices: 0,
        active_devices: 0,
        maintenance_devices: 0,
        inactive_devices: 0
      }
    });
  }
});

// POST /api/dashboard/recalculate (for ADMIN manual refresh)
router.post('/recalculate', async (req: AuthenticatedRequest, res) => {
  try {
    const stats = await dashboardStatsRepo.bootstrapStats();
    return res.json({ success: true, message: 'Đã tính toán và đồng bộ lại toàn bộ số liệu thống kê', data: stats });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
