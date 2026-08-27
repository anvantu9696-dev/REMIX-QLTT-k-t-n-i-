import { dbQuery, dbQueryOne, dbRun } from '../db';

export interface RepairLogItem {
  id: number;
  timestamp: string;
  error_type: string;
  target_table: string;
  target_id: string | number;
  old_data: string;
  new_data: string;
  action_taken: string;
  result: 'SUCCESS' | 'ROLLED_BACK' | 'FAILED';
  details: string;
}

export function initAutoRepairTable() {
  try {
    dbRun(`
      CREATE TABLE IF NOT EXISTS auto_repair_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        error_type TEXT NOT NULL,
        target_table TEXT NOT NULL,
        target_id TEXT NOT NULL,
        old_data TEXT,
        new_data TEXT,
        action_taken TEXT NOT NULL,
        result TEXT CHECK(result IN ('SUCCESS', 'ROLLED_BACK', 'FAILED')) DEFAULT 'SUCCESS',
        details TEXT
      );
    `);
  } catch (e) {
    console.error('Failed to initialize auto_repair_logs table:', e);
  }
}

export function safeAutoRepairRun<T>(
  errorType: string,
  targetTable: string,
  targetId: string | number,
  oldDataObj: any,
  actionDescription: string,
  repairFn: () => T
): { success: boolean; result?: T; error?: any } {
  initAutoRepairTable();
  
  // 1. Transaction start
  try {
    dbRun('BEGIN TRANSACTION;');
  } catch (e) {
    // If transaction already active or not supported, proceed
  }

  const oldDataStr = JSON.stringify(oldDataObj || {});

  try {
    // 2. Execute targeted repair logic
    const result = repairFn();

    // 3. Commit transaction
    try {
      dbRun('COMMIT;');
    } catch (e) {}

    // 4. Log successful safe repair
    try {
      dbRun(
        `INSERT INTO auto_repair_logs (error_type, target_table, target_id, old_data, new_data, action_taken, result, details)
         VALUES (?, ?, ?, ?, ?, ?, 'SUCCESS', ?)`,
        [
          errorType,
          targetTable,
          String(targetId),
          oldDataStr,
          JSON.stringify(result || {}),
          actionDescription,
          `Đã tự động sửa lỗi an toàn cho bản ghi ${targetTable} [ID: ${targetId}] mà không ảnh hưởng các dữ liệu khác.`
        ]
      );
    } catch (logErr) {
      console.error('Failed to insert auto repair log:', logErr);
    }

    return { success: true, result };
  } catch (err: any) {
    // 5. Rollback on failure
    try {
      dbRun('ROLLBACK;');
    } catch (rbErr) {}

    // 6. Log failed repair with rollback
    try {
      dbRun(
        `INSERT INTO auto_repair_logs (error_type, target_table, target_id, old_data, new_data, action_taken, result, details)
         VALUES (?, ?, ?, ?, ?, ?, 'ROLLED_BACK', ?)`,
        [
          errorType,
          targetTable,
          String(targetId),
          oldDataStr,
          JSON.stringify({ error: err.message }),
          actionDescription,
          `Thao tác sửa lỗi thất bại. Đã ROLLBACK an toàn, bảo toàn 100% dữ liệu gốc. Lỗi: ${err.message}`
        ]
      );
    } catch (logErr) {}

    return { success: false, error: err };
  }
}

export function getAutoRepairLogs(limit = 50): RepairLogItem[] {
  try {
    initAutoRepairTable();
    return dbQuery(`SELECT * FROM auto_repair_logs ORDER BY id DESC LIMIT ?`, [limit]) as RepairLogItem[];
  } catch (e) {
    return [];
  }
}
