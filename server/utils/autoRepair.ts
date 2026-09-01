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
  // No-op for Firestore
}

export function safeAutoRepairRun<T>(
  errorType: string,
  targetTable: string,
  targetId: string | number,
  oldDataObj: any,
  actionDescription: string,
  repairFn: () => T
): { success: boolean; result?: T; error?: any } {
  try {
    const result = repairFn();
    return { success: true, result };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

export function getAutoRepairLogs(limit = 50): RepairLogItem[] {
  return [];
}
