import initSqlJs, { Database, SqlValue } from 'sql.js';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

// Initialize Firebase Admin (Cloud Run automatically picks up credentials)
if (!getApps().length) {
  // Clear dummy environment variables that cause issues
  if (process.env.GOOGLE_CLOUD_PROJECT === '123456') delete process.env.GOOGLE_CLOUD_PROJECT;
  if (process.env.FIREBASE_STORAGE_BUCKET === '123456') delete process.env.FIREBASE_STORAGE_BUCKET;

  const config: any = {
    credential: applicationDefault(),
    projectId: 'gen-lang-client-0467602660',
  };
  if (process.env.FIREBASE_STORAGE_BUCKET && process.env.FIREBASE_STORAGE_BUCKET !== 'MY_STORAGE_BUCKET_NAME') {
    config.storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
  }
  initializeApp(config);
}

function getBucket() {
  try {
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
    if (!bucketName || bucketName === 'MY_STORAGE_BUCKET_NAME' || bucketName === '123456') {
      return null;
    }
    return getStorage().bucket(bucketName);
  } catch (e) {
    console.error('[Database] Error getting Storage bucket:', e);
    return null;
  }
}
const DB_FILENAME = 'grid_management.sqlite';
const DB_PATH = path.resolve(process.cwd(), DB_FILENAME);
const DB_BACKUP_PATH = path.resolve(process.cwd(), 'grid_management.sqlite.bak');
const DB_TEMP_PATH = path.resolve(process.cwd(), 'grid_management.sqlite.tmp');

let dbInstance: Database | null = null;
let saveTimer: NodeJS.Timeout | null = null;
let isBillingAccountDisabled = false;

async function downloadFromStorage() {
  if (isBillingAccountDisabled) return;
  try {
    const bucket = getBucket();
    if (!bucket) {
      console.log(`[Database] Firebase Storage not configured (FIREBASE_STORAGE_BUCKET missing). Skipping download.`);
      return;
    }
    
    const file = bucket.file(DB_FILENAME);
    const [exists] = await file.exists();
    if (exists) {
      console.log(`[Database] Downloading latest database from Storage...`);
      const [buffer] = await file.download();
      fs.writeFileSync(DB_PATH, buffer);
      console.log(`[Database] Downloaded and restored ${DB_FILENAME} (${buffer.length} bytes)`);
    } else {
      console.log(`[Database] No database file found in Storage.`);
    }
  } catch (e: any) {
    const errorMsg = e.response?.data?.error?.message || e.message || e;
    
    if (typeof errorMsg === 'string' && (errorMsg.includes('billing account') || errorMsg.includes('disabled in state absent'))) {
      isBillingAccountDisabled = true;
      console.warn('[Database] Cloud Storage is currently unavailable (Billing required). Data is being saved locally only.');
      return;
    }
    
    console.error('[Database] Error downloading database from Storage:', errorMsg);
  }
}

async function uploadToStorage() {
  if (isBillingAccountDisabled) return;
  try {
    const bucket = getBucket();
    if (!bucket) return; // Skip if no bucket

    const file = bucket.file(DB_FILENAME);
    const buffer = fs.readFileSync(DB_PATH);
    await file.save(buffer, {
      resumable: false,
      contentType: 'application/x-sqlite3'
    });
    console.log(`[Database] Uploaded ${DB_FILENAME} to Storage successfully.`);
  } catch (e: any) {
    const errorMsg = e.response?.data?.error?.message || e.message || e;
    
    if (typeof errorMsg === 'string' && (errorMsg.includes('billing account') || errorMsg.includes('disabled in state absent'))) {
      isBillingAccountDisabled = true;
      console.warn('[Database] Cloud Storage is currently unavailable (Billing required). Data is being saved locally only.');
      return;
    }

    console.error('[Database] Error uploading database to Storage:', errorMsg);
    if (e.response?.data) {
      console.error('[Database] Error details:', JSON.stringify(e.response.data));
    }
  }
}

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  // Sync from Storage first if container is pristine
  if (!fs.existsSync(DB_PATH)) {
    await downloadFromStorage();
  }

  const SQL = await initSqlJs();
  
  let fileBuffer: Buffer | null = null;
  let loaded = false;

  // 1. Try reading primary database file
  if (fs.existsSync(DB_PATH)) {
    try {
      fileBuffer = fs.readFileSync(DB_PATH);
      if (fileBuffer && fileBuffer.length >= 16) {
        const header = fileBuffer.toString('utf8', 0, 15);
        if (header === 'SQLite format 3') {
          dbInstance = new SQL.Database(fileBuffer);
          loaded = true;
          console.log(`[Database] Loaded existing database from ${DB_PATH} (${fileBuffer.length} bytes)`);
        } else {
          throw new Error('Unsupported SQLite header');
        }
      }
    } catch (e) {
      console.error('[Database] Primary database file read/parse error (possibly malformed), quarantining and attempting backup recovery...', e);
      try {
        const corruptPath = `${DB_PATH}.corrupted.${Date.now()}`;
        fs.renameSync(DB_PATH, corruptPath);
      } catch (err) {}
    }
  }

  // 2. If primary failed or not found, try backup file
  if (!loaded && fs.existsSync(DB_BACKUP_PATH)) {
    try {
      const backupBuffer = fs.readFileSync(DB_BACKUP_PATH);
      if (backupBuffer && backupBuffer.length >= 16) {
        const header = backupBuffer.toString('utf8', 0, 15);
        if (header === 'SQLite format 3') {
          dbInstance = new SQL.Database(backupBuffer);
          loaded = true;
          console.log(`[Database] Recovered database from backup ${DB_BACKUP_PATH} (${backupBuffer.length} bytes)`);
          // Restore to primary path
          try {
            fs.copyFileSync(DB_BACKUP_PATH, DB_PATH);
          } catch (err) {}
        } else {
          throw new Error('Unsupported SQLite header in backup');
        }
      }
    } catch (e) {
      console.error('[Database] Backup database file recovery also failed (possibly malformed):', e);
      try {
        const corruptBackupPath = `${DB_BACKUP_PATH}.corrupted.${Date.now()}`;
        fs.renameSync(DB_BACKUP_PATH, corruptBackupPath);
      } catch (err) {}
    }
  }

  if (!loaded || !dbInstance) {
    console.log('[Database] Initializing new pristine in-memory SQLite database instance.');
    dbInstance = new SQL.Database();
  }

  // Enable Foreign Keys
  try {
    dbInstance.run('PRAGMA foreign_keys = ON;');
  } catch (e) {}

  // Initialize Schema safely with full recovery on ANY error
  try {
    await initializeSchema(dbInstance);
    ensureInitialBaselineBackup();
  } catch (e: any) {
    console.error('[Database] Schema initialization warning or corruption detected:', e);
    console.warn('[Database] Quarantining database files and initializing fresh pristine instance...');
    try {
      if (dbInstance) {
        try { dbInstance.close(); } catch (err) {}
        dbInstance = null;
      }
      if (fs.existsSync(DB_PATH)) {
        fs.renameSync(DB_PATH, `${DB_PATH}.malformed.${Date.now()}`);
      }
      if (fs.existsSync(DB_BACKUP_PATH)) {
        fs.renameSync(DB_BACKUP_PATH, `${DB_BACKUP_PATH}.malformed.${Date.now()}`);
      }
    } catch (err) {}

    dbInstance = new SQL.Database();
    try {
      dbInstance.run('PRAGMA foreign_keys = ON;');
      await initializeSchema(dbInstance);
      ensureInitialBaselineBackup();
    } catch (innerErr) {
      console.error('[Database] Failed to initialize fresh database after corruption:', innerErr);
    }
  }

  // Ensure initial state is persisted atomically
  saveDb(true);

  return dbInstance;
}

export function saveDb(forceSync: boolean = false): void {
  if (!dbInstance) return;

  const performAtomicSave = () => {
    if (!dbInstance) return;
    try {
      const data = dbInstance.export();
      const buffer = Buffer.from(data);

      // Write to temp file first (atomic write pattern)
      fs.writeFileSync(DB_TEMP_PATH, buffer);
      fs.renameSync(DB_TEMP_PATH, DB_PATH);

      // Trigger asynchronous upload
      uploadToStorage();

      // Create/update backup copy
      try {
        fs.copyFileSync(DB_PATH, DB_BACKUP_PATH);
      } catch (err) {}
    } catch (e) {
      console.error('[Database] Failed to write database atomically:', e);
      try {
        if (fs.existsSync(DB_TEMP_PATH)) {
          fs.unlinkSync(DB_TEMP_PATH);
        }
      } catch (err) {}
    }
  };

  if (forceSync) {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    performAtomicSave();
    return;
  }

  // Fast debounce (50ms) to batch multiple rapid SQL statements while ensuring immediate persistence
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    performAtomicSave();
  }, 50);
}

export function flushDbSync(): void {
  saveDb(true);
}

// Graceful process exit handlers to never lose unwritten in-memory changes
if (typeof process !== 'undefined') {
  process.on('exit', () => {
    flushDbSync();
  });
  process.on('SIGINT', () => {
    flushDbSync();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    flushDbSync();
    process.exit(0);
  });
  process.on('beforeExit', () => {
    flushDbSync();
  });
}

function migrateMultiPointLoops(db: Database) {
  // 1. Ensure loop_nodes and loop_edges tables exist
  db.run(`
    CREATE TABLE IF NOT EXISTS loop_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loop_id INTEGER NOT NULL,
      reference_id INTEGER NOT NULL,
      reference_type TEXT CHECK(reference_type IN ('SUBSTATION', 'DEVICE')) NOT NULL,
      feeder_id INTEGER,
      role TEXT CHECK(role IN ('SOURCE_A', 'SOURCE_B', 'DEVICE', 'TIE_POINT')) NOT NULL,
      pos_x REAL,
      pos_y REAL,
      FOREIGN KEY (loop_id) REFERENCES loops(id) ON DELETE CASCADE
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_loop_nodes_loop_id ON loop_nodes(loop_id);`);

  db.run(`
    CREATE TABLE IF NOT EXISTS loop_edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loop_id INTEGER NOT NULL,
      source_node_id INTEGER NOT NULL,
      target_node_id INTEGER NOT NULL,
      switch_status TEXT CHECK(switch_status IN ('CLOSED', 'OPEN')) DEFAULT 'CLOSED',
      FOREIGN KEY (loop_id) REFERENCES loops(id) ON DELETE CASCADE,
      FOREIGN KEY (source_node_id) REFERENCES loop_nodes(id) ON DELETE CASCADE,
      FOREIGN KEY (target_node_id) REFERENCES loop_nodes(id) ON DELETE CASCADE
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_loop_edges_loop_id ON loop_edges(loop_id);`);

  // 2. Migrate existing loops table to new schema strictly if needed
  try {
    const loopsInfo = db.exec("PRAGMA table_info(loops)")[0];
    const hasSubstationA = loopsInfo?.values.some(v => v[1] === 'substation_id_a');

    if (hasSubstationA) {
      console.log('[Database] Migrating loops to Multi-Point Loops schema...');
      db.run('PRAGMA foreign_keys = OFF;');
      db.run('BEGIN TRANSACTION;');

      try {
        db.run('ALTER TABLE loops RENAME TO loops_old_multipoint;');
        
        db.run(`
          CREATE TABLE loops (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            loop_code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            status TEXT CHECK(status IN ('OPEN', 'CLOSED', 'INACTIVE', 'ACTIVE')) DEFAULT 'ACTIVE',
            operating_status TEXT DEFAULT 'OPEN',
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT,
            updated_by TEXT,
            deleted_at DATETIME DEFAULT NULL
          );
        `);

        // Use loop_id from old as loop_code in new
        db.run(`
          INSERT INTO loops (id, loop_code, name, status, operating_status, notes, created_at, updated_at, created_by, updated_by, deleted_at)
          SELECT id, loop_id, name, status, operating_status, notes, created_at, updated_at, created_by, updated_by, deleted_at
          FROM loops_old_multipoint;
        `);

        // Migrate source A
        db.run(`
          INSERT INTO loop_nodes (loop_id, reference_id, reference_type, feeder_id, role)
          SELECT id, substation_id_a, 'SUBSTATION', feeder_id_a, 'SOURCE_A'
          FROM loops_old_multipoint WHERE substation_id_a IS NOT NULL;
        `);
        // Migrate source B
        db.run(`
          INSERT INTO loop_nodes (loop_id, reference_id, reference_type, feeder_id, role)
          SELECT id, substation_id_b, 'SUBSTATION', feeder_id_b, 'SOURCE_B'
          FROM loops_old_multipoint WHERE substation_id_b IS NOT NULL;
        `);
        // Migrate Tie Point
        db.run(`
          INSERT INTO loop_nodes (loop_id, reference_id, reference_type, feeder_id, role)
          SELECT id, CAST(loop_device_id AS INTEGER), 'DEVICE', NULL, 'TIE_POINT'
          FROM loops_old_multipoint WHERE loop_device_id IS NOT NULL AND loop_device_id != '';
        `);

        db.run('DROP TABLE loops_old_multipoint;');
        db.run('DROP VIEW IF EXISTS loop_connections;');

        db.run('COMMIT;');
        console.log('[Database] Multi-Point Loops schema migration successful.');
      } catch (e) {
        db.run('ROLLBACK;');
        console.error('[Database] Multi-Point Loops migration failed:', e);
      } finally {
        db.run('PRAGMA foreign_keys = ON;');
      }
    }
  } catch (err) {
    console.error('Error in migrateMultiPointLoops:', err);
  }
}

async function initializeSchema(db: Database) {
  // 1. Roles table
  db.run(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      level INTEGER NOT NULL,
      status TEXT CHECK(status IN ('ACTIVE', 'INACTIVE')) DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Set NHAN_VIEN_VAN_HANH to INACTIVE, others ACTIVE
  db.run(`UPDATE roles SET status = 'INACTIVE' WHERE code = 'NHAN_VIEN_VAN_HANH'`);
  db.run(`UPDATE roles SET status = 'ACTIVE' WHERE code != 'NHAN_VIEN_VAN_HANH' AND status IS NULL`);
  db.run(`UPDATE roles SET name = 'KHÁCH - CHỈ XEM' WHERE code = 'KHACH'`);

  // Migration: Rename team "Đội Quản lý Vận hành 1" to "ĐỘI VẬN HÀNH LƯỚI ĐIỆN"
  try {
    db.run(`UPDATE users SET team = 'ĐỘI VẬN HÀNH LƯỚI ĐIỆN' WHERE team = 'Đội Quản lý Vận hành 1'`);
    db.run(`UPDATE user_scopes SET scope_value = 'ĐỘI VẬN HÀNH LƯỚI ĐIỆN' WHERE scope_value = 'Đội Quản lý Vận hành 1'`);
    db.run(`UPDATE devices SET team = 'ĐỘI VẬN HÀNH LƯỚI ĐIỆN' WHERE team = 'Đội Quản lý Vận hành 1'`);
    db.run(`UPDATE device_proposals SET requester_team = 'ĐỘI VẬN HÀNH LƯỚI ĐIỆN' WHERE requester_team = 'Đội Quản lý Vận hành 1'`);
    db.run(`UPDATE tasks SET team = 'ĐỘI VẬN HÀNH LƯỚI ĐIỆN' WHERE team = 'Đội Quản lý Vận hành 1'`);
    db.run(`UPDATE inspection_schedules SET assigned_team = 'ĐỘI VẬN HÀNH LƯỚI ĐIỆN' WHERE assigned_team = 'Đội Quản lý Vận hành 1'`);
    db.run(`UPDATE issues SET team = 'ĐỘI VẬN HÀNH LƯỚI ĐIỆN' WHERE team = 'Đội Quản lý Vận hành 1'`);
  } catch (e) {
    // ignore
  }

  // Ensure admin user password exists if empty
  try {
    const adminUser = db.exec("SELECT password_hash FROM users WHERE username = 'admin'")[0]?.values?.[0];
    if (adminUser && !adminUser[0]) {
      const adminPassHash = await bcrypt.hash(process.env.ADMIN_DEFAULT_PASSWORD || require('crypto').randomBytes(8).toString('hex'), 10);
      db.run(`UPDATE users SET password_hash = ? WHERE username = 'admin'`, [adminPassHash]);
    }
  } catch (e) {
    // ignore
  }

  // Set default unit 'Điện lực Bình Dương' and team 'ĐỘI QLVH' for existing records
  try {
    db.run(`UPDATE devices SET unit = 'Điện lực Bình Dương' WHERE unit IN ('Công ty Điện lực Hà Nội', 'Công ty Điện lực') OR unit IS NULL OR unit = ''`);
    db.run(`UPDATE devices SET team = 'ĐỘI QLVH' WHERE team IN ('Phòng CNTT & Điều độ', 'ĐỘI ĐIỆN LỰC 1') OR team IS NULL OR team = ''`);
    db.run(`UPDATE users SET unit = 'Điện lực Bình Dương' WHERE unit IN ('Công ty Điện lực Hà Nội', 'Công ty Điện lực') OR unit IS NULL OR unit = ''`);
    db.run(`UPDATE users SET team = 'ĐỘI QLVH' WHERE team IN ('Phòng CNTT & Điều độ', 'ĐỘI ĐIỆN LỰC 1') OR team IS NULL OR team = ''`);
  } catch (e) {
    console.error('Error setting default unit/team:', e);
  }

  // 2. Permissions table
  db.run(`
    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      module TEXT NOT NULL,
      description TEXT NOT NULL,
      action TEXT NOT NULL
    );
  `);

  // 3. Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_code TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      unit TEXT NOT NULL,
      team TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT CHECK(status IN ('ACTIVE', 'LOCKED', 'DISABLED', 'PENDING', 'REJECTED')) DEFAULT 'PENDING',
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      updated_by TEXT,
      deleted_at DATETIME DEFAULT NULL,
      approved_by TEXT,
      approved_at DATETIME,
      rejected_by TEXT,
      rejected_at DATETIME,
      rejection_reason TEXT
    );
  `);

  // Safe migration for existing databases: ensure columns & status CHECK constraint support PENDING & REJECTED
  try {
    const userTableSql = (db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")[0]?.values[0]?.[0] || '') as string;
    if (userTableSql && (!userTableSql.includes('PENDING') || !userTableSql.includes('REJECTED'))) {
      db.run(`PRAGMA foreign_keys = OFF;`);
      db.run(`
        CREATE TABLE IF NOT EXISTS users_migration (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employee_code TEXT UNIQUE NOT NULL,
          full_name TEXT NOT NULL,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          phone TEXT,
          unit TEXT NOT NULL,
          team TEXT NOT NULL,
          title TEXT NOT NULL,
          status TEXT CHECK(status IN ('ACTIVE', 'LOCKED', 'DISABLED', 'PENDING', 'REJECTED')) DEFAULT 'PENDING',
          password_hash TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT,
          updated_by TEXT,
          deleted_at DATETIME DEFAULT NULL,
          approved_by TEXT,
          approved_at DATETIME,
          rejected_by TEXT,
          rejected_at DATETIME,
          rejection_reason TEXT
        );
      `);
      db.run(`
        INSERT INTO users_migration (id, employee_code, full_name, username, email, phone, unit, team, title, status, password_hash, created_at, updated_at, created_by, updated_by, deleted_at)
        SELECT id, employee_code, full_name, username, email, phone, unit, team, title, status, password_hash, created_at, updated_at, created_by, updated_by, deleted_at FROM users;
      `);
      db.run(`DROP TABLE users;`);
      db.run(`ALTER TABLE users_migration RENAME TO users;`);
      db.run(`PRAGMA foreign_keys = ON;`);
      console.log('Successfully upgraded users table schema with PENDING and REJECTED support.');
    } else {
      const cols = db.exec("PRAGMA table_info(users)")[0]?.values?.map(v => v[1]) || [];
      if (!cols.includes('approved_by')) db.run(`ALTER TABLE users ADD COLUMN approved_by TEXT`);
      if (!cols.includes('approved_at')) db.run(`ALTER TABLE users ADD COLUMN approved_at DATETIME`);
      if (!cols.includes('rejected_by')) db.run(`ALTER TABLE users ADD COLUMN rejected_by TEXT`);
      if (!cols.includes('rejected_at')) db.run(`ALTER TABLE users ADD COLUMN rejected_at DATETIME`);
      if (!cols.includes('rejection_reason')) db.run(`ALTER TABLE users ADD COLUMN rejection_reason TEXT`);
    }
  } catch (e) {
    console.error('Error during users table migration:', e);
  }

  // Ensure users:approve permission exists
  try {
    const existPerm = db.exec("SELECT id FROM permissions WHERE code = 'users:approve'");
    if (!existPerm || !existPerm[0]?.values?.length) {
      db.run(`INSERT INTO permissions (code, module, description, action) VALUES ('users:approve', 'QUAN_LY_NGUOI_DUNG', 'Phê duyệt / Từ chối kích hoạt tài khoản đăng ký mới', 'APPROVE')`);
      const approvePermId = (db.exec("SELECT id FROM permissions WHERE code = 'users:approve'")[0].values[0][0]) as number;
      const adminRoleRes = db.exec("SELECT id FROM roles WHERE code = 'ADMIN'");
      if (adminRoleRes && adminRoleRes[0]?.values?.length) {
        const adminRoleId = adminRoleRes[0].values[0][0] as number;
        db.run(`INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, [adminRoleId, approvePermId]);
      }
    }
  } catch (e) {
    // ignore
  }

  // 4. User Roles junction
  db.run(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, role_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    );
  `);

  // 5. Role Permissions junction
  db.run(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL,
      permission_id INTEGER NOT NULL,
      PRIMARY KEY (role_id, permission_id),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    );
  `);

  // 6. User Scopes table
  db.run(`
    CREATE TABLE IF NOT EXISTS user_scopes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      scope_type TEXT CHECK(scope_type IN ('SYSTEM', 'DON_VI', 'DOI', 'TRAM', 'PHAT_TUYEN')) NOT NULL,
      scope_value TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 7. Audit Logs table
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      user_fullname TEXT NOT NULL,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      target_id TEXT,
      details TEXT,
      result TEXT CHECK(result IN ('SUCCESS', 'FAILURE')) NOT NULL,
      ip_address TEXT DEFAULT '127.0.0.1',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 8. Notifications table
  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT CHECK(type IN ('INFO', 'WARNING', 'ALERT')) DEFAULT 'INFO',
      is_read INTEGER DEFAULT 0,
      link TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 9. Documents table
  db.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      document_code TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      file_url TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME DEFAULT NULL
    );
  `);

  // 10. Guides table
  db.run(`
    CREATE TABLE IF NOT EXISTS guides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 11. Substations table (Trạm 110kV)
  db.run(`
    CREATE TABLE IF NOT EXISTS substations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      substation_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      latitude REAL,
      longitude REAL,
      google_maps_url TEXT,
      image_url TEXT,
      notes TEXT,
      status TEXT CHECK(status IN ('ACTIVE', 'INACTIVE', 'MAINTENANCE')) DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      updated_by TEXT,
      deleted_at DATETIME DEFAULT NULL
    );
  `);

  // 12. Feeders table (Phát tuyến)
  db.run(`
    CREATE TABLE IF NOT EXISTS feeders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feeder_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      substation_id INTEGER NOT NULL,
      start_point TEXT,
      end_point TEXT,
      notes TEXT,
      status TEXT CHECK(status IN ('ACTIVE', 'INACTIVE')) DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      updated_by TEXT,
      deleted_at DATETIME DEFAULT NULL,
      FOREIGN KEY (substation_id) REFERENCES substations(id) ON DELETE RESTRICT
    );
  `);

  // 13. Devices table (Thiết bị)
  db.run(`
    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT UNIQUE NOT NULL,
      device_code TEXT,
      name TEXT NOT NULL,
      device_type TEXT CHECK(device_type IN ('LBS', 'DS', 'REC', 'RMU', 'OTHER')) NOT NULL,
      pole_number TEXT,
      feeder_id INTEGER,
      substation_id INTEGER,
      unit TEXT NOT NULL,
      team TEXT NOT NULL,
      status TEXT CHECK(status IN ('ACTIVE', 'INACTIVE', 'MAINTENANCE')) DEFAULT 'ACTIVE',
      switch_status TEXT CHECK(switch_status IN ('CLOSED', 'OPEN', 'UNKNOWN')) DEFAULT 'UNKNOWN',
      scada_status TEXT CHECK(scada_status IN ('SIGNAL', 'NO_SIGNAL', 'UNKNOWN')) DEFAULT 'UNKNOWN',
      relay_79 TEXT CHECK(relay_79 IN ('ON', 'OFF', 'N_A')) DEFAULT 'N_A',
      battery_status TEXT DEFAULT 'UNCHECKED',
      latitude REAL,
      longitude REAL,
      google_maps_url TEXT,
      notes TEXT,
      current_setting TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      updated_by TEXT,
      deleted_at DATETIME DEFAULT NULL,
      FOREIGN KEY (feeder_id) REFERENCES feeders(id) ON DELETE SET NULL,
      FOREIGN KEY (substation_id) REFERENCES substations(id) ON DELETE SET NULL
    );
  `);

  // Ensure battery_status column exists in devices table
  try {
    db.run(`ALTER TABLE devices ADD COLUMN battery_status TEXT DEFAULT 'UNCHECKED'`);
  } catch (e) {
    // Column might already exist
  }

  // Ensure current_setting column exists in devices table
  try {
    db.run(`ALTER TABLE devices ADD COLUMN current_setting TEXT`);
  } catch (e) {
    // Column might already exist
  }

  // 14. Device Images table
  db.run(`
    CREATE TABLE IF NOT EXISTS device_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      is_primary INTEGER DEFAULT 0,
      caption TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );
  `);

  // 15. Device Locations History
  db.run(`
    CREATE TABLE IF NOT EXISTS device_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL,
      latitude REAL,
      longitude REAL,
      google_maps_url TEXT,
      note TEXT,
      updated_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );
  `);

  // 16. Device Status History
  db.run(`
    CREATE TABLE IF NOT EXISTS device_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL,
      old_switch_status TEXT,
      new_switch_status TEXT,
      old_scada_status TEXT,
      new_scada_status TEXT,
      old_relay_79 TEXT,
      new_relay_79 TEXT,
      note TEXT,
      updated_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );
  `);

  // Phase 3: 17. Loops Table (Khép vòng)
  // Ensure the table 'loops' exists with the multi-point structure if it doesn't exist.
  db.run(`
    CREATE TABLE IF NOT EXISTS loops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loop_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      status TEXT CHECK(status IN ('OPEN', 'CLOSED', 'INACTIVE', 'ACTIVE')) DEFAULT 'ACTIVE',
      operating_status TEXT DEFAULT 'OPEN',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      updated_by TEXT,
      deleted_at DATETIME DEFAULT NULL
    );
  `);

  // Ensure loop_endpoints exists (legacy but kept if needed, though loop_nodes replaces it)
  db.run(`
    CREATE TABLE IF NOT EXISTS loop_endpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loop_id INTEGER NOT NULL,
      substation_id INTEGER NOT NULL,
      feeder_id INTEGER NOT NULL,
      device_id TEXT NOT NULL,
      endpoint_role TEXT CHECK(endpoint_role IN ('MAIN_SOURCE', 'BACKUP_SOURCE', 'LOAD_BRANCH')) NOT NULL,
      FOREIGN KEY (loop_id) REFERENCES loops(id) ON DELETE CASCADE
    );
  `);

  try {
    db.run(`ALTER TABLE loops ADD COLUMN loop_device_id TEXT;`);
  } catch (e) {}
  try {
    db.run(`ALTER TABLE loops ADD COLUMN operating_status TEXT DEFAULT 'OPEN';`);
  } catch (e) {}
  try {
    db.run(`ALTER TABLE loops ADD COLUMN config_status TEXT DEFAULT 'ACTIVE';`);
  } catch (e) {}
  try {
    db.run(`ALTER TABLE loops ADD COLUMN operation_status TEXT DEFAULT 'OPEN';`);
  } catch (e) {}
  try {
    db.run(`ALTER TABLE loops ADD COLUMN configuration_status TEXT DEFAULT 'ACTIVE';`);
  } catch (e) {}
  try {
    db.run(`ALTER TABLE loops ADD COLUMN latitude REAL;`);
  } catch (e) {}
  try {
    db.run(`ALTER TABLE loops ADD COLUMN longitude REAL;`);
  } catch (e) {}
  try {
    db.run(`ALTER TABLE loops ADD COLUMN google_maps_url TEXT;`);
  } catch (e) {}
  try {
    db.run(`ALTER TABLE loops ADD COLUMN inspection_cycle TEXT DEFAULT 'MONTHLY';`);
  } catch (e) {}
  try {
    db.run(`ALTER TABLE loops ADD COLUMN last_inspection_date DATETIME;`);
  } catch (e) {}
  try {
    db.run(`ALTER TABLE loops ADD COLUMN next_inspection_date DATETIME;`);
  } catch (e) {}
  try {
    db.run(`ALTER TABLE loops ADD COLUMN assigned_user_id INTEGER;`);
  } catch (e) {}

  // Compatibility View for loop_connections
  try {
    db.run(`DROP VIEW IF EXISTS loop_connections;`);
    db.run(`
      CREATE VIEW loop_connections AS 
      SELECT 
        id,
        loop_id as code,
        loop_id,
        name,
        substation_id_a as station_a_id,
        feeder_id_a as feeder_a_id,
        device_id_a,
        loop_device_id,
        device_id_b,
        feeder_id_b as feeder_b_id,
        substation_id_b as station_b_id,
        latitude,
        longitude,
        google_maps_url,
        COALESCE(configuration_status, config_status, 'ACTIVE') as configuration_status,
        COALESCE(operation_status, operating_status, 'OPEN') as operation_status,
        inspection_cycle,
        last_inspection_date,
        next_inspection_date,
        assigned_user_id,
        notes,
        created_by,
        created_at,
        updated_by,
        updated_at,
        deleted_at
      FROM loops;
    `);
  } catch (e) {}

  // Phase 3: 18. Topology Versions Table
  db.run(`
    CREATE TABLE IF NOT EXISTS topology_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loop_id INTEGER NOT NULL,
      version TEXT NOT NULL,
      status TEXT CHECK(status IN ('DRAFT', 'SUBMITTED', 'REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED')) DEFAULT 'DRAFT',
      change_summary TEXT,
      reason TEXT,
      nodes_json TEXT NOT NULL DEFAULT '[]',
      edges_json TEXT NOT NULL DEFAULT '[]',
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      approved_by TEXT,
      approved_at DATETIME,
      rejected_by TEXT,
      rejected_at DATETIME,
      rejection_reason TEXT,
      FOREIGN KEY (loop_id) REFERENCES loops(id) ON DELETE CASCADE
    );
  `);

  // Phase 3: 19. Topology Nodes Table
  db.run(`
    CREATE TABLE IF NOT EXISTS topology_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loop_id INTEGER NOT NULL,
      version_id INTEGER NOT NULL,
      device_id TEXT NOT NULL,
      pos_x REAL NOT NULL DEFAULT 0,
      pos_y REAL NOT NULL DEFAULT 0,
      node_type TEXT DEFAULT 'SWITCH',
      is_energized INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (loop_id) REFERENCES loops(id) ON DELETE CASCADE,
      FOREIGN KEY (version_id) REFERENCES topology_versions(id) ON DELETE CASCADE
    );
  `);

  // Phase 3: 20. Topology Edges Table
  db.run(`
    CREATE TABLE IF NOT EXISTS topology_edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loop_id INTEGER NOT NULL,
      version_id INTEGER NOT NULL,
      source_device_id TEXT NOT NULL,
      target_device_id TEXT NOT NULL,
      connection_type TEXT DEFAULT 'OVERHEAD',
      status TEXT DEFAULT 'ACTIVE',
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (loop_id) REFERENCES loops(id) ON DELETE CASCADE,
      FOREIGN KEY (version_id) REFERENCES topology_versions(id) ON DELETE CASCADE
    );
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_topo_nodes_loop_ver ON topology_nodes(loop_id, version_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_topo_edges_loop_ver ON topology_edges(loop_id, version_id);`);

  // Phase 3: 21. Topology Change Requests / Approvals Table
  db.run(`
    CREATE TABLE IF NOT EXISTS topology_change_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loop_id INTEGER NOT NULL,
      version_id INTEGER NOT NULL,
      version_str TEXT NOT NULL,
      requester_username TEXT NOT NULL,
      requester_fullname TEXT NOT NULL,
      status TEXT CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'REQUEST_INFO')) DEFAULT 'PENDING',
      reason TEXT NOT NULL,
      change_summary TEXT,
      before_snapshot TEXT,
      after_snapshot TEXT,
      reviewer_username TEXT,
      reviewer_fullname TEXT,
      review_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (loop_id) REFERENCES loops(id) ON DELETE CASCADE,
      FOREIGN KEY (version_id) REFERENCES topology_versions(id) ON DELETE CASCADE
    );
  `);

  // Device Proposals / Change Requests Table
  db.run(`
    CREATE TABLE IF NOT EXISTS device_proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_code TEXT UNIQUE NOT NULL,
      type TEXT CHECK(type IN ('CREATE', 'UPDATE', 'LOCATION', 'STATUS', 'DELETE', 'IMAGE')) NOT NULL,
      device_id INTEGER,
      target_device_id_str TEXT,
      device_name TEXT,
      proposed_data TEXT NOT NULL,
      current_data TEXT,
      reason TEXT,
      status TEXT CHECK(status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED')) DEFAULT 'PENDING_APPROVAL',
      requester_id INTEGER NOT NULL,
      requester_username TEXT NOT NULL,
      requester_fullname TEXT NOT NULL,
      requester_unit TEXT,
      requester_team TEXT,
      reviewer_id INTEGER,
      reviewer_username TEXT,
      reviewer_fullname TEXT,
      review_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL,
      FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_device_proposals_status ON device_proposals(status);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_device_proposals_requester ON device_proposals(requester_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_device_proposals_device ON device_proposals(device_id);`);

  // Phase 4: 22. Checklists Table
  db.run(`
    CREATE TABLE IF NOT EXISTS checklists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checklist_code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      version TEXT DEFAULT '1.0',
      target_device_type TEXT DEFAULT 'ALL',
      is_template INTEGER DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME DEFAULT NULL
    );
  `);

  // Phase 4: 23. Checklist Items Table
  db.run(`
    CREATE TABLE IF NOT EXISTS checklist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checklist_id INTEGER NOT NULL,
      item_order INTEGER DEFAULT 1,
      item_code TEXT,
      content TEXT NOT NULL,
      standard_value TEXT,
      unit TEXT,
      input_type TEXT CHECK(input_type IN ('PASS_FAIL', 'TEXT', 'NUMBER', 'OPTION')) DEFAULT 'PASS_FAIL',
      options_json TEXT,
      is_required INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE
    );
  `);

  // Phase 4: 24. Tasks Table
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      device_id INTEGER,
      assigned_to_user_id INTEGER,
      assigned_to_username TEXT,
      assigned_to_fullname TEXT,
      team TEXT NOT NULL,
      checklist_id INTEGER,
      assigned_date DATETIME NOT NULL,
      due_date DATETIME NOT NULL,
      priority TEXT CHECK(priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')) DEFAULT 'MEDIUM',
      status TEXT CHECK(status IN ('NEW', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'PENDING_APPROVAL', 'COMPLETED', 'PAUSED', 'OVERDUE', 'RETURNED', 'REJECTED', 'CANCELLED')) DEFAULT 'NEW',
      content TEXT NOT NULL,
      notes TEXT,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      completed_by TEXT,
      return_reason TEXT,
      inspection_schedule_id INTEGER,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE SET NULL
    );
  `);

  // Phase 4: 25. Task Checklist Results Table
  db.run(`
    CREATE TABLE IF NOT EXISTS task_checklist_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      checklist_id INTEGER NOT NULL,
      checklist_item_id INTEGER NOT NULL,
      item_content TEXT NOT NULL,
      standard_value TEXT,
      unit TEXT,
      result_value TEXT,
      is_pass INTEGER CHECK(is_pass IN (0, 1) OR is_pass IS NULL),
      notes TEXT,
      image_url TEXT,
      completed_by TEXT NOT NULL,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
  `);

  // Phase 4: 26. Inspection Schedules Table
  db.run(`
    CREATE TABLE IF NOT EXISTS inspection_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      frequency TEXT CHECK(frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY')) NOT NULL,
      device_id INTEGER NOT NULL,
      checklist_id INTEGER NOT NULL,
      assigned_team TEXT NOT NULL,
      assigned_to_user_id INTEGER,
      next_run_date DATETIME NOT NULL,
      last_run_date DATETIME,
      status TEXT CHECK(status IN ('ACTIVE', 'PAUSED', 'DISABLED', 'DELETED')) DEFAULT 'ACTIVE',
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME DEFAULT NULL,
      deleted_by TEXT,
      deleted_reason TEXT,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
      FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE
    );
  `);

  // Migration: Add deleted_at, deleted_by, deleted_reason columns and update check constraint to allow 'DELETED'
  try { db.run(`ALTER TABLE inspection_schedules ADD COLUMN deleted_at DATETIME DEFAULT NULL`); } catch (e) {}
  try { db.run(`ALTER TABLE inspection_schedules ADD COLUMN deleted_by TEXT`); } catch (e) {}
  try { db.run(`ALTER TABLE inspection_schedules ADD COLUMN deleted_reason TEXT`); } catch (e) {}

  // Phase 4: 27. Issues / Anomalies Table
  db.run(`
    CREATE TABLE IF NOT EXISTS issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_code TEXT UNIQUE NOT NULL,
      device_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      severity TEXT CHECK(severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) DEFAULT 'MEDIUM',
      status TEXT CHECK(status IN ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')) DEFAULT 'NEW',
      image_url TEXT,
      reported_by_username TEXT NOT NULL,
      reported_by_fullname TEXT NOT NULL,
      reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      assigned_to_username TEXT,
      assigned_to_fullname TEXT,
      resolved_at DATETIME,
      resolution_notes TEXT,
      closed_at DATETIME,
      closed_by TEXT,
      notes TEXT,
      task_id INTEGER,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );
  `);

  // Phase 4: 28. Task Histories / Logs Table (Lịch sử thao tác phân quyền công việc)
  db.run(`
    CREATE TABLE IF NOT EXISTS task_histories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      user_id INTEGER,
      username TEXT,
      user_fullname TEXT,
      action TEXT NOT NULL,
      action_label TEXT,
      old_status TEXT,
      new_status TEXT,
      progress INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
  `);

  // Migration: Upgrade tasks table with creator, progress, execution timestamps and approval details
  try {
    const taskCols = db.exec("PRAGMA table_info(tasks)")[0]?.values?.map(v => v[1]) || [];
    if (!taskCols.includes('creator_id')) try { db.run(`ALTER TABLE tasks ADD COLUMN creator_id INTEGER`); } catch(e){}
    if (!taskCols.includes('creator_username')) try { db.run(`ALTER TABLE tasks ADD COLUMN creator_username TEXT`); } catch(e){}
    if (!taskCols.includes('creator_fullname')) try { db.run(`ALTER TABLE tasks ADD COLUMN creator_fullname TEXT`); } catch(e){}
    if (!taskCols.includes('progress')) try { db.run(`ALTER TABLE tasks ADD COLUMN progress INTEGER DEFAULT 0`); } catch(e){}
    if (!taskCols.includes('accepted_at')) try { db.run(`ALTER TABLE tasks ADD COLUMN accepted_at DATETIME`); } catch(e){}
    if (!taskCols.includes('started_at')) try { db.run(`ALTER TABLE tasks ADD COLUMN started_at DATETIME`); } catch(e){}
    if (!taskCols.includes('submitted_at')) try { db.run(`ALTER TABLE tasks ADD COLUMN submitted_at DATETIME`); } catch(e){}
    if (!taskCols.includes('approved_by_user_id')) try { db.run(`ALTER TABLE tasks ADD COLUMN approved_by_user_id INTEGER`); } catch(e){}
    if (!taskCols.includes('approved_by_username')) try { db.run(`ALTER TABLE tasks ADD COLUMN approved_by_username TEXT`); } catch(e){}
    if (!taskCols.includes('approved_by_fullname')) try { db.run(`ALTER TABLE tasks ADD COLUMN approved_by_fullname TEXT`); } catch(e){}
    if (!taskCols.includes('approved_at')) try { db.run(`ALTER TABLE tasks ADD COLUMN approved_at DATETIME`); } catch(e){}
    if (!taskCols.includes('approval_notes')) try { db.run(`ALTER TABLE tasks ADD COLUMN approval_notes TEXT`); } catch(e){}
    if (!taskCols.includes('paused_at')) try { db.run(`ALTER TABLE tasks ADD COLUMN paused_at DATETIME`); } catch(e){}
    if (!taskCols.includes('pause_reason')) try { db.run(`ALTER TABLE tasks ADD COLUMN pause_reason TEXT`); } catch(e){}

    // Check if table schema check constraint contains PENDING_APPROVAL
    const tasksTableSql = (db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'")[0]?.values?.[0]?.[0] as string) || '';
    if (tasksTableSql && !tasksTableSql.includes('PENDING_APPROVAL')) {
      console.log('[Migration] Migrating tasks table to support PENDING_APPROVAL and PAUSED statuses...');
      db.run(`PRAGMA foreign_keys = OFF;`);
      db.run(`
        CREATE TABLE tasks_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_code TEXT UNIQUE NOT NULL,
          title TEXT NOT NULL,
          device_id INTEGER,
          assigned_to_user_id INTEGER,
          assigned_to_username TEXT,
          assigned_to_fullname TEXT,
          team TEXT NOT NULL,
          checklist_id INTEGER,
          assigned_date DATETIME NOT NULL,
          due_date DATETIME NOT NULL,
          priority TEXT CHECK(priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')) DEFAULT 'MEDIUM',
          status TEXT CHECK(status IN ('NEW', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'PENDING_APPROVAL', 'COMPLETED', 'PAUSED', 'OVERDUE', 'RETURNED', 'REJECTED', 'CANCELLED')) DEFAULT 'NEW',
          content TEXT NOT NULL,
          notes TEXT,
          created_by TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          completed_by TEXT,
          return_reason TEXT,
          inspection_schedule_id INTEGER,
          creator_id INTEGER,
          creator_username TEXT,
          creator_fullname TEXT,
          progress INTEGER DEFAULT 0,
          accepted_at DATETIME,
          started_at DATETIME,
          submitted_at DATETIME,
          approved_by_user_id INTEGER,
          approved_by_username TEXT,
          approved_by_fullname TEXT,
          approved_at DATETIME,
          approval_notes TEXT,
          paused_at DATETIME,
          pause_reason TEXT,
          FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL,
          FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE SET NULL
        );
      `);

      db.run(`
        INSERT INTO tasks_new (
          id, task_code, title, device_id, assigned_to_user_id, assigned_to_username, assigned_to_fullname,
          team, checklist_id, assigned_date, due_date, priority, status, content, notes, created_by,
          created_at, updated_at, completed_at, completed_by, return_reason, inspection_schedule_id,
          creator_id, creator_username, creator_fullname, progress, accepted_at, started_at, submitted_at,
          approved_by_user_id, approved_by_username, approved_by_fullname, approved_at, approval_notes,
          paused_at, pause_reason
        )
        SELECT 
          id, task_code, title, device_id, assigned_to_user_id, assigned_to_username, assigned_to_fullname,
          team, checklist_id, assigned_date, due_date, priority, status, content, notes, created_by,
          created_at, updated_at, completed_at, completed_by, return_reason, inspection_schedule_id,
          creator_id, creator_username, creator_fullname, progress, accepted_at, started_at, submitted_at,
          approved_by_user_id, approved_by_username, approved_by_fullname, approved_at, approval_notes,
          paused_at, pause_reason
        FROM tasks;
      `);

      db.run(`DROP TABLE tasks;`);
      db.run(`ALTER TABLE tasks_new RENAME TO tasks;`);
      db.run(`PRAGMA foreign_keys = ON;`);
      console.log('[Migration] Tasks table migrated successfully.');
    }
  } catch (e) {
    console.error('Error during tasks table column upgrades/migration:', e);
    try { db.run(`PRAGMA foreign_keys = ON;`); } catch(err){}
  }

  // Create Indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_employee_code ON users(employee_code);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_logs(user_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_scopes_user_id ON user_scopes(user_id);`);

  // Phase 2 Required Indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_devices_feeder_id ON devices(feeder_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_devices_substation_id ON devices(substation_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_devices_pole_number ON devices(pole_number);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_devices_device_type ON devices(device_type);`);

  // Phase 3 Required Indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_loops_loop_code ON loops(loop_code);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_topology_versions_loop ON topology_versions(loop_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_topology_nodes_version ON topology_nodes(version_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_topology_edges_version ON topology_edges(version_id);`);

  // Phase 4 Required Indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to_user_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_status_due ON tasks(status, due_date);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_issues_device_id ON issues(device_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_issues_severity ON issues(severity);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_devices_station_feeder ON devices(substation_id, feeder_id);`);

  // Phase 5: System Backups Table (Sao lưu & Khôi phục điểm ảnh cho Quản trị viên)
  db.run(`
    CREATE TABLE IF NOT EXISTS system_backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      backup_type TEXT CHECK(backup_type IN ('AUTO_BEFORE_RESET', 'AUTO_BEFORE_RESTORE', 'MANUAL', 'SNAPSHOT', 'PERIODIC')) DEFAULT 'MANUAL',
      file_path TEXT,
      counts_summary TEXT NOT NULL,
      data_json TEXT NOT NULL,
      file_size_bytes INTEGER DEFAULT 0,
      created_by INTEGER,
      created_by_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_system_backups_created_at ON system_backups(created_at);`);

  // Ensure system_settings table exists
  db.run(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Check if system has already completed initial bootstrap or has existing operational data
  let isBootstrapped = false;
  try {
    const settingCheck = db.exec("SELECT value FROM system_settings WHERE key = 'initial_bootstrap_completed'");
    if (settingCheck && settingCheck[0]?.values?.length && settingCheck[0].values[0][0] === '1') {
      isBootstrapped = true;
    } else {
      // Check if existing data already present in users, substations, or devices to prevent accidental reseeding
      const userCheck = db.exec("SELECT COUNT(*) as count FROM users");
      const userCount = (userCheck[0]?.values[0]?.[0] as number) || 0;
      const stationCheck = db.exec("SELECT COUNT(*) as count FROM substations");
      const stationCount = (stationCheck[0]?.values[0]?.[0] as number) || 0;
      const deviceCheck = db.exec("SELECT COUNT(*) as count FROM devices");
      const deviceCount = (deviceCheck[0]?.values[0]?.[0] as number) || 0;

      if (userCount > 0 || stationCount > 0 || deviceCount > 0) {
        isBootstrapped = true;
        try {
          db.run(`INSERT OR REPLACE INTO system_settings (key, value) VALUES ('initial_bootstrap_completed', '1')`);
        } catch (e) {}
      }
    }
  } catch (e) {}

  // Check if any roles exist
  const roleCheck = db.exec("SELECT COUNT(*) as count FROM roles");
  const count = (roleCheck[0]?.values[0]?.[0] as number) || 0;

  if (count === 0 && !isBootstrapped) {
    await seedMasterData(db);
  } else {
    // Ensure required permissions, GRID_DATA_IMPORT and PERIODIC_INSPECTION_DELETE permission exist in existing database (safe sync)
    const extraPerms = [
      { code: 'proposals:create', module: 'QUAN_LY_THIET_BI', desc: 'Tạo đề xuất thay đổi/thêm/sửa/xóa thiết bị', action: 'CREATE' },
      { code: 'proposals:read', module: 'QUAN_LY_THIET_BI', desc: 'Xem danh sách đề xuất thay đổi thiết bị', action: 'READ' },
      { code: 'proposals:review', module: 'QUAN_LY_THIET_BI', desc: 'Phê duyệt hoặc từ chối đề xuất thiết bị', action: 'UPDATE' },
      { code: 'GRID_DATA_IMPORT', module: 'QUAN_LY_THIET_BI', desc: 'IMPORT DỮ LIỆU LƯỚI ĐIỆN', action: 'CREATE' },
      { code: 'PERIODIC_INSPECTION_DELETE', module: 'KIEM_TRA_DINH_KY', desc: 'XÓA LỊCH KIỂM TRA ĐỊNH KỲ', action: 'DELETE' },
      { code: 'devices:import', module: 'QUAN_LY_THIET_BI', desc: 'Nhập dữ liệu thiết bị', action: 'CREATE' },
      { code: 'devices:export', module: 'QUAN_LY_THIET_BI', desc: 'Xuất dữ liệu thiết bị', action: 'READ' },
      { code: 'substations:import', module: 'TRAM_110KV', desc: 'Nhập dữ liệu trạm 110kV', action: 'CREATE' },
      { code: 'substations:export', module: 'TRAM_110KV', desc: 'Xuất dữ liệu trạm 110kV', action: 'READ' },
      { code: 'feeders:import', module: 'PHAT_TUYEN', desc: 'Nhập dữ liệu phát tuyến', action: 'CREATE' },
      { code: 'feeders:export', module: 'PHAT_TUYEN', desc: 'Xuất dữ liệu phát tuyến', action: 'READ' },
      { code: 'loops:import', module: 'KHEP_VONG', desc: 'Nhập dữ liệu khép vòng', action: 'CREATE' },
      { code: 'loops:export', module: 'KHEP_VONG', desc: 'Xuất dữ liệu khép vòng', action: 'READ' }
    ];

    for (const p of extraPerms) {
      const exists = dbQueryOne(`SELECT id FROM permissions WHERE code = ?`, [p.code]);
      if (!exists) {
        dbRun(`INSERT INTO permissions (code, module, description, action) VALUES (?, ?, ?, ?)`, [p.code, p.module, p.desc, p.action]);
      }
    }

    // Grant GRID_DATA_IMPORT only to ADMIN role
    const adminRoleRow = dbQueryOne(`SELECT id FROM roles WHERE code = 'ADMIN'`, []);
    const importPermRow = dbQueryOne(`SELECT id FROM permissions WHERE code = 'GRID_DATA_IMPORT'`, []);
    if (adminRoleRow && importPermRow) {
      const adminRpExists = dbQueryOne(`SELECT role_id FROM role_permissions WHERE role_id = ? AND permission_id = ?`, [adminRoleRow.id, importPermRow.id]);
      if (!adminRpExists) {
        dbRun(`INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, [adminRoleRow.id, importPermRow.id]);
      }
    }

    // Ensure FIELD_OPERATOR role exists
    const fieldOpRole = dbQueryOne(`SELECT id FROM roles WHERE code = 'FIELD_OPERATOR'`, []);
    let fieldOpRoleId: number;
    if (!fieldOpRole) {
      dbRun(`INSERT INTO roles (code, name, description, level) VALUES (?, ?, ?, ?)`, ['FIELD_OPERATOR', 'Nhân viên hiện trường', 'Thường xuyên đi hiện trường, thu thập thông tin thực tế, cập nhật vị trí, chụp ảnh và ghi nhận tình trạng.', 8]);
      const newRoleRow = dbQueryOne(`SELECT id FROM roles WHERE code = 'FIELD_OPERATOR'`, []);
      fieldOpRoleId = newRoleRow.id as number;
    } else {
      fieldOpRoleId = fieldOpRole.id as number;
    }

    const fieldOpPerms = [
      'equipment:read', 'tasks:read', 'tasks:create', 'tasks:update', 'documents:read', 'reports:read',
      'DEVICE_VIEW', 'GIS_VIEW', 'LOOP_VIEW', 'FEEDER_VIEW', 'SUBSTATION_VIEW',
      'DEVICE_PROPOSE_CREATE', 'DEVICE_PROPOSE_UPDATE', 'DEVICE_PROPOSE_DELETE',
      'DEVICE_PROPOSE_LOCATION_UPDATE', 'DEVICE_PROPOSE_STATUS_UPDATE',
      'DEVICE_IMAGE_UPLOAD', 'CHANGE_REQUEST_CREATE', 'CHANGE_REQUEST_VIEW',
      'proposals:create', 'proposals:read'
    ];
    for (const pCode of fieldOpPerms) {
      const pRow = dbQueryOne(`SELECT id FROM permissions WHERE code = ?`, [pCode]);
      if (pRow) {
        const rpExists = dbQueryOne(`SELECT role_id FROM role_permissions WHERE role_id = ? AND permission_id = ?`, [fieldOpRoleId, pRow.id]);
        if (!rpExists) {
          dbRun(`INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, [fieldOpRoleId, pRow.id]);
        }
      }
    }
    const rolesToUpdate = ['NHAN_VIEN_VAN_HANH', 'DOI_TRUONG', 'TRUONG_CA', 'PHO_CA', 'CAN_BO_PHUONG_THUC', 'ADMIN'];
    for (const roleCode of rolesToUpdate) {
      const rRow = dbQueryOne(`SELECT id FROM roles WHERE code = ?`, [roleCode]);
      if (rRow) {
        const permsToGrant = roleCode === 'ADMIN' || roleCode === 'CAN_BO_PHUONG_THUC' || roleCode === 'TRUONG_CA' || roleCode === 'PHO_CA'
          ? ['proposals:create', 'proposals:read', 'proposals:review']
          : ['proposals:create', 'proposals:read'];

        for (const pCode of permsToGrant) {
          const pRow = dbQueryOne(`SELECT id FROM permissions WHERE code = ?`, [pCode]);
          if (pRow) {
            const rpExists = dbQueryOne(`SELECT role_id FROM role_permissions WHERE role_id = ? AND permission_id = ?`, [rRow.id, pRow.id]);
            if (!rpExists) {
              dbRun(`INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, [rRow.id, pRow.id]);
            }
          }
        }
      }
    }
  }

  // Only seed sample/mock data on the very first fresh system boot
  if (!isBootstrapped) {
    console.log('[Database] First initialization: Seeding initial base data...');
    const stationCheck = db.exec("SELECT COUNT(*) as count FROM substations");
    const stationCount = (stationCheck[0]?.values[0]?.[0] as number) || 0;
    if (stationCount === 0) {
      await seedPhase2Data(db);
    }

    const loopCheck = db.exec("SELECT COUNT(*) as count FROM loops");
    const loopCount = (loopCheck[0]?.values[0]?.[0] as number) || 0;
    if (loopCount === 0) {
      await seedPhase3Data(db);
      try {
        db.run(`INSERT OR REPLACE INTO system_settings (key, value) VALUES ('phase3_seeded', '1')`);
      } catch (e) {}
    }

    const checklistCheck = db.exec("SELECT COUNT(*) as count FROM checklists");
    const checklistCount = (checklistCheck[0]?.values[0]?.[0] as number) || 0;
    if (checklistCount === 0) {
      await seedPhase4Data(db);
    }

    const proposalCheck = db.exec("SELECT COUNT(*) as count FROM device_proposals");
    const proposalCount = (proposalCheck[0]?.values[0]?.[0] as number) || 0;
    if (proposalCount === 0) {
      await seedDeviceProposals(db);
    }

    // Mark system as permanently bootstrapped so restarting never creates new dummy data
    try {
      db.run(`INSERT OR REPLACE INTO system_settings (key, value) VALUES ('initial_bootstrap_completed', '1')`);
      console.log('[Database] Initial bootstrap marked as COMPLETED.');
    } catch (e) {}
  } else {
    console.log('[Database] System already initialized. Preserving all existing operational data without creating new dummy records.');
  }

  // Multi-point Loops Migration
  migrateMultiPointLoops(db);

  saveDb(true);
}

async function seedMasterData(db: Database) {
  console.log('Seeding master data (Roles, Permissions, Users, Scopes)...');

  // Seed 7 Roles
  const roles = [
    { code: 'ADMIN', name: 'Quản trị hệ thống', desc: 'Toàn quyền quản trị tài khoản, phân quyền, cấu hình và giám sát hệ thống.', level: 1 },
    { code: 'CAN_BO_PHUONG_THUC', name: 'Cán bộ phương thức', desc: 'Quản lý phương thức vận hành, duyệt sơ đồ, chỉ đạo kết lưới.', level: 2 },
    { code: 'TRUONG_CA', name: 'Trưởng ca điều hành', desc: 'Chỉ huy ca vận hành trạm/phát tuyến, phân công việc, duyệt phiếu thao tác.', level: 3 },
    { code: 'PHO_CA', name: 'Phó ca điều hành', desc: 'Hỗ trợ trưởng ca, kiểm tra giám sát thông số thiết bị và nhật ký ca.', level: 4 },
    { code: 'DOI_TRUONG', name: 'Đội trưởng quản lý vận hành', desc: 'Quản lý đội, phân công nhân viên kiểm tra, xử lý sự cố địa bàn.', level: 5 },
    { code: 'NHAN_VIEN_VAN_HANH', name: 'Nhân viên vận hành', desc: 'Thực hiện kiểm tra định kỳ, ghi nhận thông số thiết bị, cập nhật bất thường.', level: 6 },
    { code: 'FIELD_OPERATOR', name: 'Nhân viên hiện trường', desc: 'Thường xuyên đi hiện trường, thu thập thông tin thực tế, cập nhật vị trí, chụp ảnh và ghi nhận tình trạng.', level: 8 },
    { code: 'KHACH', name: 'KHÁCH - CHỈ XEM', desc: 'Quyền chỉ xem (Read-only) các báo cáo, tài liệu và sơ đồ công khai.', level: 7 }
  ];

  for (const r of roles) {
    db.run(
      `INSERT INTO roles (code, name, description, level) VALUES (?, ?, ?, ?)`,
      [r.code, r.name, r.desc, r.level]
    );
  }

  // Seed Permissions
  const permissions = [
    { code: 'users:read', module: 'QUAN_LY_NGUOI_DUNG', desc: 'Xem danh sách & thông tin người dùng', action: 'READ' },
    { code: 'users:create', module: 'QUAN_LY_NGUOI_DUNG', desc: 'Tạo tài khoản người dùng mới', action: 'CREATE' },
    { code: 'users:update', module: 'QUAN_LY_NGUOI_DUNG', desc: 'Cập nhật thông tin người dùng', action: 'UPDATE' },
    { code: 'users:delete', module: 'QUAN_LY_NGUOI_DUNG', desc: 'Xóa (Soft delete) người dùng', action: 'DELETE' },
    { code: 'users:assign_role', module: 'QUAN_LY_NGUOI_DUNG', desc: 'Gán Vai trò và Scope cho người dùng', action: 'ASSIGN' },
    { code: 'users:lock', module: 'QUAN_LY_NGUOI_DUNG', desc: 'Khóa / Mở khóa / Vô hiệu hóa tài khoản', action: 'LOCK' },
    
    { code: 'equipment:read', module: 'QUAN_LY_THIET_BI', desc: 'Xem thông tin danh mục thiết bị lưới điện', action: 'READ' },
    { code: 'equipment:create', module: 'QUAN_LY_THIET_BI', desc: 'Thêm mới thiết bị lưới điện', action: 'CREATE' },
    { code: 'equipment:update', module: 'QUAN_LY_THIET_BI', desc: 'Cập nhật thông số thiết bị', action: 'UPDATE' },
    { code: 'equipment:delete', module: 'QUAN_LY_THIET_BI', desc: 'Xóa thiết bị khỏi hệ thống', action: 'DELETE' },

    // Field Operations Specific Permissions
    { code: 'DEVICE_VIEW', module: 'QUAN_LY_THIET_BI', desc: 'Tra cứu thiết bị', action: 'READ' },
    { code: 'GIS_VIEW', module: 'GIS', desc: 'Xem bản đồ GIS', action: 'READ' },
    { code: 'LOOP_VIEW', module: 'KHEP_VONG', desc: 'Xem sơ đồ khép vòng', action: 'READ' },
    { code: 'FEEDER_VIEW', module: 'PHAT_TUYEN', desc: 'Tra cứu phát tuyến', action: 'READ' },
    { code: 'SUBSTATION_VIEW', module: 'TRAM_110KV', desc: 'Tra cứu trạm 110kV', action: 'READ' },
    { code: 'DEVICE_PROPOSE_CREATE', module: 'DE_XUAT', desc: 'Đề xuất thêm thiết bị mới', action: 'CREATE' },
    { code: 'DEVICE_PROPOSE_UPDATE', module: 'DE_XUAT', desc: 'Đề xuất cập nhật thiết bị', action: 'UPDATE' },
    { code: 'DEVICE_PROPOSE_DELETE', module: 'DE_XUAT', desc: 'Đề xuất xóa thiết bị', action: 'DELETE' },
    { code: 'DEVICE_PROPOSE_LOCATION_UPDATE', module: 'DE_XUAT', desc: 'Đề xuất cập nhật vị trí thiết bị', action: 'UPDATE' },
    { code: 'DEVICE_PROPOSE_STATUS_UPDATE', module: 'DE_XUAT', desc: 'Đề xuất cập nhật trạng thái làm việc', action: 'UPDATE' },
    { code: 'DEVICE_IMAGE_UPLOAD', module: 'HINH_ANH', desc: 'Chụp ảnh và upload hình ảnh hiện trường', action: 'CREATE' },
    { code: 'CHANGE_REQUEST_CREATE', module: 'DE_XUAT', desc: 'Tạo Change Request', action: 'CREATE' },
    { code: 'CHANGE_REQUEST_VIEW', module: 'DE_XUAT', desc: 'Xem đề xuất của tôi', action: 'READ' },

    { code: 'tasks:read', module: 'CONG_VIEC', desc: 'Xem danh sách công việc vận hành', action: 'READ' },
    { code: 'tasks:create', module: 'CONG_VIEC', desc: 'Tạo mới công việc / phiếu giao việc', action: 'CREATE' },
    { code: 'tasks:update', module: 'CONG_VIEC', desc: 'Cập nhật tiến độ / duyệt công việc', action: 'UPDATE' },

    { code: 'audit:read', module: 'AUDIT_LOG', desc: 'Xem nhật ký hệ thống (Audit logs)', action: 'READ' },

    { code: 'documents:read', module: 'TAI_LIEU', desc: 'Xem quy trình, tài liệu kỹ thuật', action: 'READ' },
    { code: 'documents:create', module: 'TAI_LIEU', desc: 'Tải lên tài liệu mới', action: 'CREATE' },

    { code: 'reports:read', module: 'BAO_CAO', desc: 'Xem các báo cáo thống kê', action: 'READ' },
    { code: 'GRID_DATA_IMPORT', module: 'QUAN_LY_THIET_BI', desc: 'IMPORT DỮ LIỆU LƯỚI ĐIỆN', action: 'CREATE' },
    { code: 'devices:import', module: 'QUAN_LY_THIET_BI', desc: 'Nhập dữ liệu thiết bị', action: 'CREATE' },
    { code: 'devices:export', module: 'QUAN_LY_THIET_BI', desc: 'Xuất dữ liệu thiết bị', action: 'READ' },
    { code: 'substations:import', module: 'TRAM_110KV', desc: 'Nhập dữ liệu trạm 110kV', action: 'CREATE' },
    { code: 'substations:export', module: 'TRAM_110KV', desc: 'Xuất dữ liệu trạm 110kV', action: 'READ' },
    { code: 'feeders:import', module: 'PHAT_TUYEN', desc: 'Nhập dữ liệu phát tuyến', action: 'CREATE' },
    { code: 'feeders:export', module: 'PHAT_TUYEN', desc: 'Xuất dữ liệu phát tuyến', action: 'READ' },
    { code: 'loops:import', module: 'KHEP_VONG', desc: 'Nhập dữ liệu khép vòng', action: 'CREATE' },
    { code: 'loops:export', module: 'KHEP_VONG', desc: 'Xuất dữ liệu khép vòng', action: 'READ' }
  ];

  for (const p of permissions) {
    db.run(
      `INSERT INTO permissions (code, module, description, action) VALUES (?, ?, ?, ?)`,
      [p.code, p.module, p.desc, p.action]
    );
  }

  // Get Role IDs & Permission IDs
  const adminRoleId = (db.exec("SELECT id FROM roles WHERE code = 'ADMIN'")[0].values[0][0]) as number;
  const cbptRoleId = (db.exec("SELECT id FROM roles WHERE code = 'CAN_BO_PHUONG_THUC'")[0].values[0][0]) as number;
  const truongCaRoleId = (db.exec("SELECT id FROM roles WHERE code = 'TRUONG_CA'")[0].values[0][0]) as number;
  const phoCaRoleId = (db.exec("SELECT id FROM roles WHERE code = 'PHO_CA'")[0].values[0][0]) as number;
  const doiTruongRoleId = (db.exec("SELECT id FROM roles WHERE code = 'DOI_TRUONG'")[0].values[0][0]) as number;
  const nvVanHanhRoleId = (db.exec("SELECT id FROM roles WHERE code = 'NHAN_VIEN_VAN_HANH'")[0].values[0][0]) as number;
  const fieldOperatorRoleId = (db.exec("SELECT id FROM roles WHERE code = 'FIELD_OPERATOR'")[0].values[0][0]) as number;
  const khachRoleId = (db.exec("SELECT id FROM roles WHERE code = 'KHACH'")[0].values[0][0]) as number;

  const permRows = db.exec("SELECT id, code FROM permissions")[0].values;
  const permMap = new Map<string, number>();
  for (const row of permRows) {
    permMap.set(row[1] as string, row[0] as number);
  }

  // Assign ALL permissions to ADMIN
  for (const permId of permMap.values()) {
    db.run(`INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, [adminRoleId, permId]);
  }

  // Assign permissions to CAN_BO_PHUONG_THUC
  const cbptPerms = ['equipment:read', 'equipment:create', 'equipment:update', 'tasks:read', 'tasks:create', 'tasks:update', 'documents:read', 'documents:create', 'reports:read', 'audit:read', 'DEVICE_VIEW', 'GIS_VIEW', 'LOOP_VIEW', 'FEEDER_VIEW', 'SUBSTATION_VIEW', 'CHANGE_REQUEST_VIEW', 'proposals:read', 'proposals:review'];
  for (const pCode of cbptPerms) {
    if (permMap.has(pCode)) db.run(`INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, [cbptRoleId, permMap.get(pCode)]);
  }

  // Assign permissions to TRUONG_CA & PHO_CA
  const opPerms = ['equipment:read', 'equipment:update', 'tasks:read', 'tasks:create', 'tasks:update', 'documents:read', 'reports:read', 'DEVICE_VIEW', 'GIS_VIEW', 'LOOP_VIEW', 'FEEDER_VIEW', 'SUBSTATION_VIEW', 'CHANGE_REQUEST_VIEW', 'proposals:read', 'proposals:review'];
  for (const pCode of opPerms) {
    if (permMap.has(pCode)) {
      db.run(`INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, [truongCaRoleId, permMap.get(pCode)]);
      db.run(`INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, [phoCaRoleId, permMap.get(pCode)]);
    }
  }

  // Assign permissions to DOI_TRUONG
  const doiTruongPerms = ['equipment:read', 'tasks:read', 'tasks:update', 'documents:read', 'reports:read', 'DEVICE_VIEW', 'GIS_VIEW', 'LOOP_VIEW', 'FEEDER_VIEW', 'SUBSTATION_VIEW', 'CHANGE_REQUEST_VIEW', 'proposals:create', 'proposals:read', 'proposals:review'];
  for (const pCode of doiTruongPerms) {
    if (permMap.has(pCode)) {
      db.run(`INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, [doiTruongRoleId, permMap.get(pCode)]);
    }
  }

  // Assign specific permissions to NHAN_VIEN_VAN_HANH (Field Operations Staff)
  const nvVanHanhPerms = [
    'equipment:read', 'tasks:read', 'tasks:update', 'documents:read', 'reports:read',
    'DEVICE_VIEW', 'GIS_VIEW', 'LOOP_VIEW', 'FEEDER_VIEW', 'SUBSTATION_VIEW',
    'DEVICE_PROPOSE_CREATE', 'DEVICE_PROPOSE_UPDATE', 'DEVICE_PROPOSE_DELETE',
    'DEVICE_PROPOSE_LOCATION_UPDATE', 'DEVICE_PROPOSE_STATUS_UPDATE',
    'DEVICE_IMAGE_UPLOAD', 'CHANGE_REQUEST_CREATE', 'CHANGE_REQUEST_VIEW',
    'proposals:create', 'proposals:read'
  ];
  for (const pCode of nvVanHanhPerms) {
    if (permMap.has(pCode)) {
      db.run(`INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, [nvVanHanhRoleId, permMap.get(pCode)]);
    }
  }

  // Assign specific permissions to FIELD_OPERATOR (Nhân viên hiện trường)
  const fieldOperatorPerms = [
    'equipment:read', 'tasks:read', 'tasks:create', 'tasks:update', 'documents:read', 'reports:read',
    'DEVICE_VIEW', 'GIS_VIEW', 'LOOP_VIEW', 'FEEDER_VIEW', 'SUBSTATION_VIEW',
    'DEVICE_PROPOSE_CREATE', 'DEVICE_PROPOSE_UPDATE', 'DEVICE_PROPOSE_DELETE',
    'DEVICE_PROPOSE_LOCATION_UPDATE', 'DEVICE_PROPOSE_STATUS_UPDATE',
    'DEVICE_IMAGE_UPLOAD', 'CHANGE_REQUEST_CREATE', 'CHANGE_REQUEST_VIEW',
    'proposals:create', 'proposals:read'
  ];
  for (const pCode of fieldOperatorPerms) {
    if (permMap.has(pCode)) {
      db.run(`INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, [fieldOperatorRoleId, permMap.get(pCode)]);
    }
  }

  // Assign READ-ONLY permissions to KHACH
  const khachPerms = ['equipment:read', 'documents:read', 'reports:read', 'tasks:read', 'DEVICE_VIEW', 'GIS_VIEW', 'LOOP_VIEW', 'FEEDER_VIEW', 'SUBSTATION_VIEW'];
  for (const pCode of khachPerms) {
    if (permMap.has(pCode)) {
      db.run(`INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, [khachRoleId, permMap.get(pCode)]);
    }
  }

  // Seed Seed Users (1 user for each role)
  const defaultPassword = await bcrypt.hash(process.env.ADMIN_DEFAULT_PASSWORD || require('crypto').randomBytes(8).toString('hex'), 10);
  const userPassword = await bcrypt.hash(process.env.USER_DEFAULT_PASSWORD || require('crypto').randomBytes(8).toString('hex'), 10);

  const initialUsers = [
    {
      employee_code: 'NV-00001',
      full_name: 'Nguyễn Văn Admin',
      username: 'admin',
      email: 'admin@luoidien.evn.vn',
      phone: '0901234567',
      unit: 'Công ty Điện lực Hà Nội',
      team: 'Phòng CNTT & Điều độ',
      title: 'Quản trị viên Hệ thống',
      status: 'ACTIVE',
      password: defaultPassword,
      roleId: adminRoleId,
      scopeType: 'SYSTEM',
      scopeValue: 'TOAN_HE_THONG'
    },
    {
      employee_code: 'NV-00002',
      full_name: 'Trần Thị Phương Thức',
      username: 'cb_phuongthuc',
      email: 'phuongthuc@luoidien.evn.vn',
      phone: '0902345678',
      unit: 'Công ty Điện lực Hà Nội',
      team: 'Phòng Phương thức Vận hành',
      title: 'Chuyên viên Phương thức',
      status: 'ACTIVE',
      password: userPassword,
      roleId: cbptRoleId,
      scopeType: 'DON_VI',
      scopeValue: 'Công ty Điện lực Hà Nội'
    },
    {
      employee_code: 'NV-00003',
      full_name: 'Lê Văn Trưởng Ca',
      username: 'truongca_a',
      email: 'truongca@luoidien.evn.vn',
      phone: '0903456789',
      unit: 'Công ty Điện lực Hà Nội',
      team: 'Đội Vận hành Lưới điện',
      title: 'Trưởng ca Điều hành',
      status: 'ACTIVE',
      password: userPassword,
      roleId: truongCaRoleId,
      scopeType: 'TRAM',
      scopeValue: 'Trạm 110kV E1.1 Nghĩa Đô'
    },
    {
      employee_code: 'NV-00004',
      full_name: 'Phạm Văn Phó Ca',
      username: 'phoca_a',
      email: 'phoca@luoidien.evn.vn',
      phone: '0904567890',
      unit: 'Công ty Điện lực Hà Nội',
      team: 'Đội Vận hành Lưới điện',
      title: 'Phó ca Điều hành',
      status: 'ACTIVE',
      password: userPassword,
      roleId: phoCaRoleId,
      scopeType: 'TRAM',
      scopeValue: 'Trạm 110kV E1.1 Nghĩa Đô'
    },
    {
      employee_code: 'NV-00005',
      full_name: 'Hoàng Văn Đội Trưởng',
      username: 'doitruong_1',
      email: 'doitruong@luoidien.evn.vn',
      phone: '0905678901',
      unit: 'Công ty Điện lực Hà Nội',
      team: 'ĐỘI VẬN HÀNH LƯỚI ĐIỆN',
      title: 'Đội trưởng QLVH',
      status: 'ACTIVE',
      password: userPassword,
      roleId: doiTruongRoleId,
      scopeType: 'DOI',
      scopeValue: 'ĐỘI VẬN HÀNH LƯỚI ĐIỆN'
    },
    {
      employee_code: 'NV-00006',
      full_name: 'Đỗ Văn Vận Hành',
      username: 'nv_vanhanh',
      email: 'vanhanh@luoidien.evn.vn',
      phone: '0906789012',
      unit: 'Công ty Điện lực Hà Nội',
      team: 'ĐỘI VẬN HÀNH LƯỚI ĐIỆN',
      title: 'Kỹ thuật viên Vận hành',
      status: 'ACTIVE',
      password: userPassword,
      roleId: nvVanHanhRoleId,
      scopeType: 'PHAT_TUYEN',
      scopeValue: 'Phát tuyến 471-E1.1'
    },
    {
      employee_code: 'NV-00007',
      full_name: 'Nguyễn Văn Khách',
      username: 'khach_guest',
      email: 'khach@luoidien.evn.vn',
      phone: '0907890123',
      unit: 'Sở Công Thương',
      team: 'Đoàn Giám sát',
      title: 'Cán bộ Giám sát',
      status: 'ACTIVE',
      password: userPassword,
      roleId: khachRoleId,
      scopeType: 'SYSTEM',
      scopeValue: 'TOAN_HE_THONG'
    },
    {
      employee_code: 'NV-00008',
      full_name: 'Bùi Văn Hiện Trường',
      username: 'nhanvien_hientruong',
      email: 'hientruong@luoidien.evn.vn',
      phone: '0908901234',
      unit: 'Công ty Điện lực Hà Nội',
      team: 'ĐỘI VẬN HÀNH LƯỚI ĐIỆN',
      title: 'Nhân viên Hiện trường',
      status: 'ACTIVE',
      password: userPassword,
      roleId: fieldOperatorRoleId,
      scopeType: 'PHAT_TUYEN',
      scopeValue: 'Phát tuyến 471-E1.1'
    },
    {
      employee_code: 'NV-00009',
      full_name: 'Nhân viên hiện trường Test',
      username: 'field.test',
      email: 'field.test@example.local',
      phone: '0909999888',
      unit: 'Công ty Điện lực Hà Nội',
      team: 'Đội Quản lý Vận hành Test',
      title: 'Nhân viên Hiện trường Test',
      status: 'ACTIVE',
      password: userPassword,
      roleId: fieldOperatorRoleId,
      scopeType: 'PHAT_TUYEN',
      scopeValue: 'Phát tuyến 471-E1.1'
    }
  ];

  for (const u of initialUsers) {
    db.run(
      `INSERT INTO users (employee_code, full_name, username, email, phone, unit, team, title, status, password_hash, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [u.employee_code, u.full_name, u.username, u.email, u.phone, u.unit, u.team, u.title, u.status, u.password, 'SYSTEM']
    );

    const userId = (db.exec("SELECT id FROM users WHERE username = ?", [u.username])[0].values[0][0]) as number;

    // Assign Role
    db.run(`INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`, [userId, u.roleId]);

    // Assign Scope
    db.run(`INSERT INTO user_scopes (user_id, scope_type, scope_value) VALUES (?, ?, ?)`, [userId, u.scopeType, u.scopeValue]);

    // Initial Notification
    db.run(
      `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
      [userId, 'Chào mừng đến với Hệ thống Quản lý Thiết bị Lưới điện', `Tài khoản ${u.full_name} (${u.username}) đã được tạo thành công với vai trò ${u.title}.`, 'INFO']
    );
  }

  // Seed Initial Documents
  const initialDocs = [
    { title: 'Quy trình Vận hành Lưới điện Phân phối 110kV-22kV', code: 'QT-VH-2026-01', cat: 'Quy trình vận hành', url: '/docs/quy-trinh-van-hanh.pdf', creator: 'Nguyễn Văn Admin' },
    { title: 'Tiêu chuẩn Kỹ thuật Máy biến áp Lực 110kV Đông Anh', code: 'TCKT-MBA-110KV', cat: 'Tiêu chuẩn kỹ thuật', url: '/docs/tieu-chuan-mba.pdf', creator: 'Trần Thị Phương Thức' },
    { title: 'Sơ đồ Nguyên lý Kết lưới Phát tuyến 471 & 473 E1.1', code: 'SD-471-473-E1.1', cat: 'Sơ đồ kết lưới', url: '/docs/so-do-phat-tuyen.pdf', creator: 'Lê Văn Trưởng Ca' }
  ];

  for (const doc of initialDocs) {
    db.run(
      `INSERT INTO documents (title, document_code, category, file_url, created_by) VALUES (?, ?, ?, ?, ?)`,
      [doc.title, doc.code, doc.cat, doc.url, doc.creator]
    );
  }

  // Seed Guides
  const initialGuides = [
    {
      title: 'Hướng dẫn sử dụng Phân quyền và Scope trong Hệ thống Giai đoạn 1',
      category: 'Hướng dẫn Quản trị',
      content: 'Hệ thống sử dụng mô hình RBAC kết hợp Scope (Toàn hệ thống, Đơn vị, Đội, Trạm, Phát tuyến). Mỗi người dùng có 1 hoặc nhiều vai trò và phạm vi làm việc tương ứng.'
    },
    {
      title: 'Hướng dẫn đăng ký tài khoản và xử lý Quên mật khẩu',
      category: 'Sử dụng Hệ thống',
      content: 'Người dùng sử dụng Mã nhân viên hoặc Tên đăng nhập để truy cập. Trường hợp quên mật khẩu, bấm nút Quên mật khẩu tại trang Đăng nhập để nhận hướng dẫn reset từ Admin.'
    }
  ];

  for (const g of initialGuides) {
    db.run(
      `INSERT INTO guides (title, category, content) VALUES (?, ?, ?)`,
      [g.title, g.category, g.content]
    );
  }

  // Seed Audit log entry
  db.run(
    `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [1, 'admin', 'Nguyễn Văn Admin', 'SEED_MASTER_DATA', 'HE_THONG', 'INIT', 'Khởi tạo dữ liệu nền tảng Phase 1 thành công', 'SUCCESS']
  );

  console.log('Seeding Phase 1 completed successfully!');
}

async function seedPhase2Data(db: Database) {
  console.log('Seeding Phase 2 data (Substations, Feeders, Devices, Locations, Images)...');

  // 1. Seed Substations
  const substations = [
    {
      code: 'T110-E1.1',
      name: 'Trạm 110kV E1.1 Nghĩa Đô',
      address: 'Số 1 Phố Hoàng Quốc Việt, Cầu Giấy, Hà Nội',
      lat: 21.0458,
      lng: 105.7925,
      maps_url: 'https://maps.google.com/?q=21.0458,105.7925',
      image_url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
      notes: 'Trạm trọng điểm khu lực Cầu Giấy - Tây Hồ. Quy mô 2 máy biến áp 63MVA.',
      status: 'ACTIVE',
      creator: 'SYSTEM'
    },
    {
      code: 'T110-E1.2',
      name: 'Trạm 110kV E1.2 Đông Anh',
      address: 'Thị trấn Đông Anh, Hà Nội',
      lat: 21.1352,
      lng: 105.8480,
      maps_url: 'https://maps.google.com/?q=21.1352,105.8480',
      image_url: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=800&q=80',
      notes: 'Cấp điện KCN Đông Anh. Quy mô 2 MBA 40MVA.',
      status: 'ACTIVE',
      creator: 'SYSTEM'
    },
    {
      code: 'T110-E1.3',
      name: 'Trạm 110kV E1.3 Gia Lâm',
      address: 'Thị trấn Sài Đồng, Gia Lâm, Hà Nội',
      lat: 21.0512,
      lng: 105.8920,
      maps_url: 'https://maps.google.com/?q=21.0512,105.8920',
      image_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
      notes: 'Trạm khu vực đông Hà Nội.',
      status: 'ACTIVE',
      creator: 'SYSTEM'
    }
  ];

  for (const s of substations) {
    db.run(
      `INSERT INTO substations (substation_code, name, address, latitude, longitude, google_maps_url, image_url, notes, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.code, s.name, s.address, s.lat, s.lng, s.maps_url, s.image_url, s.notes, s.status, s.creator]
    );
  }

  const e11Id = (db.exec("SELECT id FROM substations WHERE substation_code = 'T110-E1.1'")[0].values[0][0]) as number;
  const e12Id = (db.exec("SELECT id FROM substations WHERE substation_code = 'T110-E1.2'")[0].values[0][0]) as number;
  const e13Id = (db.exec("SELECT id FROM substations WHERE substation_code = 'T110-E1.3'")[0].values[0][0]) as number;

  // 2. Seed Feeders
  const feeders = [
    { code: 'F471-E1.1', name: 'Phát tuyến 471 E1.1 Nghĩa Đô', station_id: e11Id, start: 'Thanh cái 22kV E1.1', end: 'Dao cách ly 471-7 Hoàng Quốc Việt', status: 'ACTIVE' },
    { code: 'F473-E1.1', name: 'Phát tuyến 473 E1.1 Nghĩa Đô', station_id: e11Id, start: 'Thanh cái 22kV E1.1', end: 'Cầu dao 473-1 Nguyễn Văn Huyên', status: 'ACTIVE' },
    { code: 'F475-E1.1', name: 'Phát tuyến 475 E1.1 Nghĩa Đô', station_id: e11Id, start: 'Thanh cái 22kV E1.1', end: 'Tủ RMU Phạm Văn Đồng', status: 'ACTIVE' },
    { code: 'F471-E1.2', name: 'Phát tuyến 471 E1.2 Đông Anh', station_id: e12Id, start: 'Thanh cái 22kV E1.2', end: 'Trạm biến áp KCN 1', status: 'ACTIVE' },
    { code: 'F473-E1.2', name: 'Phát tuyến 473 E1.2 Đông Anh', station_id: e12Id, start: 'Thanh cái 22kV E1.2', end: 'Dao 473-12 Nguyên Khê', status: 'ACTIVE' },
    { code: 'F471-E1.3', name: 'Phát tuyến 471 E1.3 Gia Lâm', station_id: e13Id, start: 'Thanh cái 22kV E1.3', end: 'Trạm phân phối Sài Đồng', status: 'ACTIVE' }
  ];

  for (const f of feeders) {
    db.run(
      `INSERT INTO feeders (feeder_code, name, substation_id, start_point, end_point, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [f.code, f.name, f.station_id, f.start, f.end, f.status, 'SYSTEM']
    );
  }

  const f471e11Id = (db.exec("SELECT id FROM feeders WHERE feeder_code = 'F471-E1.1'")[0].values[0][0]) as number;
  const f473e11Id = (db.exec("SELECT id FROM feeders WHERE feeder_code = 'F473-E1.1'")[0].values[0][0]) as number;
  const f475e11Id = (db.exec("SELECT id FROM feeders WHERE feeder_code = 'F475-E1.1'")[0].values[0][0]) as number;
  const f471e12Id = (db.exec("SELECT id FROM feeders WHERE feeder_code = 'F471-E1.2'")[0].values[0][0]) as number;
  const f473e12Id = (db.exec("SELECT id FROM feeders WHERE feeder_code = 'F473-E1.2'")[0].values[0][0]) as number;
  const f471e13Id = (db.exec("SELECT id FROM feeders WHERE feeder_code = 'F471-E1.3'")[0].values[0][0]) as number;

  // 3. Seed Devices
  const devices = [
    {
      device_id: 'DEV-LBS-471-01',
      device_code: 'LBS-471/01',
      name: 'Dao cách ly phụ tải LBS 471-01',
      device_type: 'LBS',
      pole_number: 'Cột 12',
      feeder_id: f471e11Id,
      substation_id: e11Id,
      unit: 'Công ty Điện lực Hà Nội',
      team: 'ĐỘI VẬN HÀNH LƯỚI ĐIỆN',
      status: 'ACTIVE',
      switch_status: 'CLOSED',
      scada_status: 'SIGNAL',
      relay_79: 'ON',
      lat: 21.0475,
      lng: 105.7950,
      maps_url: 'https://maps.google.com/?q=21.0475,105.7950',
      notes: 'LBS tích hợp điều khiển xa SCADA qua GPRS. Đã bảo dưỡng T6/2026.'
    },
    {
      device_id: 'DEV-DS-471-15',
      device_code: 'DS-471/15',
      name: 'Dao cách ly phân đoạn DS 471-15',
      device_type: 'DS',
      pole_number: 'Cột 15',
      feeder_id: f471e11Id,
      substation_id: e11Id,
      unit: 'Công ty Điện lực Hà Nội',
      team: 'ĐỘI VẬN HÀNH LƯỚI ĐIỆN',
      status: 'ACTIVE',
      switch_status: 'CLOSED',
      scada_status: 'NO_SIGNAL',
      relay_79: 'N_A',
      lat: 21.0490,
      lng: 105.7980,
      maps_url: 'https://maps.google.com/?q=21.0490,105.7980',
      notes: 'Dao cách ly thao tác tay bằng sào.'
    },
    {
      device_id: 'DEV-RCL-473-08',
      device_code: 'RCL-473/08',
      name: 'Recloser tự động lặp lại RCL 473-08',
      device_type: 'REC',
      pole_number: 'Cột 08',
      feeder_id: f473e11Id,
      substation_id: e11Id,
      unit: 'Công ty Điện lực Hà Nội',
      team: 'ĐỘI VẬN HÀNH LƯỚI ĐIỆN',
      status: 'ACTIVE',
      switch_status: 'OPEN',
      scada_status: 'SIGNAL',
      relay_79: 'ON',
      lat: 21.0420,
      lng: 105.7890,
      maps_url: 'https://maps.google.com/?q=21.0420,105.7890',
      notes: 'Máy cắt Recloser Cooper 22kV. Đang mở cách ly sự cố nhánh 3.'
    },
    {
      device_id: 'DEV-RMU-475-T01',
      device_code: 'RMU-475/T01',
      name: 'Tủ RMU Schneider 24kV RMU-475/T01',
      device_type: 'RMU',
      pole_number: 'Tổ Bốt T01',
      feeder_id: f475e11Id,
      substation_id: e11Id,
      unit: 'Công ty Điện lực Hà Nội',
      team: 'ĐỘI VẬN HÀNH LƯỚI ĐIỆN',
      status: 'ACTIVE',
      switch_status: 'CLOSED',
      scada_status: 'SIGNAL',
      relay_79: 'N_A',
      lat: 21.0435,
      lng: 105.8010,
      maps_url: 'https://maps.google.com/?q=21.0435,105.8010',
      notes: 'Tủ RMU 4 ngăn Schneider FBX.'
    },
    {
      device_id: 'DEV-LBS-471E12-05',
      device_code: 'LBS-471-E1.2/05',
      name: 'LBS Khép vòng LBS-471-E1.2/05',
      device_type: 'LBS',
      pole_number: 'Cột 05',
      feeder_id: f471e12Id,
      substation_id: e12Id,
      unit: 'Công ty Điện lực Hà Nội',
      team: 'Đội Quản lý Vận hành 2',
      status: 'ACTIVE',
      switch_status: 'CLOSED',
      scada_status: 'SIGNAL',
      relay_79: 'OFF',
      lat: 21.1380,
      lng: 105.8510,
      maps_url: 'https://maps.google.com/?q=21.1380,105.8510',
      notes: 'Điểm khép vòng với PT 473-E1.2.'
    },
    {
      device_id: 'DEV-RCL-473E12-12',
      device_code: 'RCL-473-E1.2/12',
      name: 'Recloser RCL-473-E1.2/12',
      device_type: 'REC',
      pole_number: 'Cột 12',
      feeder_id: f473e12Id,
      substation_id: e12Id,
      unit: 'Công ty Điện lực Hà Nội',
      team: 'Đội Quản lý Vận hành 2',
      status: 'MAINTENANCE',
      switch_status: 'OPEN',
      scada_status: 'NO_SIGNAL',
      relay_79: 'OFF',
      lat: 21.1320,
      lng: 105.8450,
      maps_url: 'https://maps.google.com/?q=21.1320,105.8450',
      notes: 'Đang tạm dừng để kiểm tra bảo dưỡng định kỳ.'
    },
    {
      device_id: 'DEV-DS-471E13-02',
      device_code: 'DS-471-E1.3/02',
      name: 'Dao cách ly DS 471-E1.3/02',
      device_type: 'DS',
      pole_number: 'Cột 02',
      feeder_id: f471e13Id,
      substation_id: e13Id,
      unit: 'Công ty Điện lực Hà Nội',
      team: 'Đội Quản lý Vận hành 3',
      status: 'ACTIVE',
      switch_status: 'CLOSED',
      scada_status: 'SIGNAL',
      relay_79: 'N_A',
      lat: 21.0540,
      lng: 105.8950,
      maps_url: 'https://maps.google.com/?q=21.0540,105.8950',
      notes: 'Dao liên lạc đầu tuyến Gia Lâm.'
    },
    {
      device_id: 'DEV-OTH-471-TB01',
      device_code: 'TB01-471',
      name: 'Dàn Tụ bù hạ áp TB01-471',
      device_type: 'OTHER',
      pole_number: 'Cột 22',
      feeder_id: f471e11Id,
      substation_id: e11Id,
      unit: 'Công ty Điện lực Hà Nội',
      team: 'ĐỘI VẬN HÀNH LƯỚI ĐIỆN',
      status: 'ACTIVE',
      switch_status: 'UNKNOWN',
      scada_status: 'UNKNOWN',
      relay_79: 'N_A',
      lat: 21.0460,
      lng: 105.7910,
      maps_url: 'https://maps.google.com/?q=21.0460,105.7910',
      notes: 'Dàn tụ bù bù công suất phản kháng.'
    }
  ];

  for (const d of devices) {
    db.run(
      `INSERT INTO devices (device_id, device_code, name, device_type, pole_number, feeder_id, substation_id, unit, team, status, switch_status, scada_status, relay_79, latitude, longitude, google_maps_url, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.device_id, d.device_code, d.name, d.device_type, d.pole_number, d.feeder_id, d.substation_id, d.unit, d.team, d.status, d.switch_status, d.scada_status, d.relay_79, d.lat, d.lng, d.maps_url, d.notes, 'SYSTEM']
    );

    const devDbId = (db.exec("SELECT id FROM devices WHERE device_id = ?", [d.device_id])[0].values[0][0]) as number;

    // Seed primary image
    db.run(
      `INSERT INTO device_images (device_id, image_url, is_primary, caption, created_by) VALUES (?, ?, 1, ?, 'SYSTEM')`,
      [devDbId, 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80', `Hình ảnh thực tế ${d.name}`]
    );

    // Seed location log
    db.run(
      `INSERT INTO device_locations (device_id, latitude, longitude, google_maps_url, note, updated_by) VALUES (?, ?, ?, ?, 'Khởi tạo tọa độ GPS ban đầu', 'SYSTEM')`,
      [devDbId, d.lat, d.lng, d.maps_url]
    );

    // Seed status history log
    db.run(
      `INSERT INTO device_status_history (device_id, old_switch_status, new_switch_status, old_scada_status, new_scada_status, old_relay_79, new_relay_79, note, updated_by)
       VALUES (?, 'UNKNOWN', ?, 'UNKNOWN', ?, 'N_A', ?, 'Thiết lập trạng thái ban đầu hệ thống', 'SYSTEM')`,
      [devDbId, d.switch_status, d.scada_status, d.relay_79]
    );
  }

  // Audit Log for Phase 2 Seed
  db.run(
    `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [1, 'admin', 'Nguyễn Văn Admin', 'SEED_PHASE_2_DATA', 'QUAN_LY_THIET_BI', 'PHASE_2', 'Khởi tạo dữ liệu Trạm 110kV, Phát tuyến, Thiết bị và Tọa độ GPS thành công', 'SUCCESS']
  );

  console.log('Seeding Phase 2 completed successfully!');
}

async function seedPhase3Data(db: Database) {
  console.log('Seeding Phase 3 data (Loops, Topology Nodes, Edges, Versions & Change Requests)...');

  // Fetch station and feeder IDs
  const e11Row = db.exec("SELECT id FROM substations WHERE substation_code = 'T110-E1.1'")[0]?.values[0];
  const e12Row = db.exec("SELECT id FROM substations WHERE substation_code = 'T110-E1.2'")[0]?.values[0];
  const e11Id = e11Row ? (e11Row[0] as number) : 1;
  const e12Id = e12Row ? (e12Row[0] as number) : 2;

  const f471e11Row = db.exec("SELECT id FROM feeders WHERE feeder_code = 'F471-E1.1'")[0]?.values[0];
  const f473e11Row = db.exec("SELECT id FROM feeders WHERE feeder_code = 'F473-E1.1'")[0]?.values[0];
  const f475e11Row = db.exec("SELECT id FROM feeders WHERE feeder_code = 'F475-E1.1'")[0]?.values[0];
  const f471e12Row = db.exec("SELECT id FROM feeders WHERE feeder_code = 'F471-E1.2'")[0]?.values[0];

  const f471e11Id = f471e11Row ? (f471e11Row[0] as number) : 1;
  const f473e11Id = f473e11Row ? (f473e11Row[0] as number) : 2;
  const f475e11Id = f475e11Row ? (f475e11Row[0] as number) : 3;
  const f471e12Id = f471e12Row ? (f471e12Row[0] as number) : 4;

  // 1. Loop 1: Liên trạm Nghĩa Đô - Đông Anh
  db.run(
    `INSERT INTO loops (loop_id, name, substation_id_a, feeder_id_a, device_id_a, substation_id_b, feeder_id_b, device_id_b, status, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'KV-110-01',
      'Khép vòng 471 E1.1 Nghĩa Đô - 471 E1.2 Đông Anh',
      e11Id, f471e11Id, 'DEV-LBS-471-01',
      e12Id, f471e12Id, 'DEV-LBS-471E12-05',
      'ACTIVE',
      'Mạch khép vòng chính liên trạm giữa 110kV E1.1 Nghĩa Đô và 110kV E1.2 Đông Anh.',
      'SYSTEM'
    ]
  );
  const loop1Id = (db.exec("SELECT id FROM loops WHERE loop_id = 'KV-110-01'")[0].values[0][0]) as number;

  // Version 1.0 APPROVED & PUBLISHED for Loop 1
  const loop1NodesV10 = [
    { device_id: 'DEV-LBS-471-01', pos_x: 100, pos_y: 200 },
    { device_id: 'DEV-DS-471-15', pos_x: 350, pos_y: 200 },
    { device_id: 'DEV-OTH-471-TB01', pos_x: 600, pos_y: 200 },
    { device_id: 'DEV-LBS-471E12-05', pos_x: 850, pos_y: 200 }
  ];
  const loop1EdgesV10 = [
    { source_device_id: 'DEV-LBS-471-01', target_device_id: 'DEV-DS-471-15', connection_type: 'OVERHEAD', status: 'ACTIVE' },
    { source_device_id: 'DEV-DS-471-15', target_device_id: 'DEV-OTH-471-TB01', connection_type: 'OVERHEAD', status: 'ACTIVE' },
    { source_device_id: 'DEV-OTH-471-TB01', target_device_id: 'DEV-LBS-471E12-05', connection_type: 'OVERHEAD', status: 'ACTIVE' }
  ];

  db.run(
    `INSERT INTO topology_versions (loop_id, version, status, change_summary, reason, nodes_json, edges_json, created_by, approved_by, approved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      loop1Id,
      '1.0',
      'PUBLISHED',
      'Khởi tạo sơ đồ topology ban đầu cho Khép vòng KV-110-01',
      'Phê duyệt phương thức vận hành năm 2026',
      JSON.stringify(loop1NodesV10),
      JSON.stringify(loop1EdgesV10),
      'admin',
      'cb_phuongthuc'
    ]
  );
  const v10Id = (db.exec("SELECT id FROM topology_versions WHERE loop_id = ? AND version = '1.0'", [loop1Id])[0].values[0][0]) as number;

  // Save nodes and edges in tables for v1.0
  for (const n of loop1NodesV10) {
    db.run(
      `INSERT INTO topology_nodes (loop_id, version_id, device_id, pos_x, pos_y) VALUES (?, ?, ?, ?, ?)`,
      [loop1Id, v10Id, n.device_id, n.pos_x, n.pos_y]
    );
  }
  for (const e of loop1EdgesV10) {
    db.run(
      `INSERT INTO topology_edges (loop_id, version_id, source_device_id, target_device_id, connection_type, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [loop1Id, v10Id, e.source_device_id, e.target_device_id, e.connection_type, e.status, 'admin']
    );
  }

  // Version 1.1 SUBMITTED for Loop 1 (Pending approval request)
  const loop1NodesV11 = [
    { device_id: 'DEV-LBS-471-01', pos_x: 100, pos_y: 200 },
    { device_id: 'DEV-DS-471-15', pos_x: 350, pos_y: 200 },
    { device_id: 'DEV-RCL-473-08', pos_x: 600, pos_y: 200 }, // Inserted RCL-473-08
    { device_id: 'DEV-OTH-471-TB01', pos_x: 850, pos_y: 200 },
    { device_id: 'DEV-LBS-471E12-05', pos_x: 1100, pos_y: 200 }
  ];
  const loop1EdgesV11 = [
    { source_device_id: 'DEV-LBS-471-01', target_device_id: 'DEV-DS-471-15', connection_type: 'OVERHEAD', status: 'ACTIVE' },
    { source_device_id: 'DEV-DS-471-15', target_device_id: 'DEV-RCL-473-08', connection_type: 'OVERHEAD', status: 'ACTIVE' },
    { source_device_id: 'DEV-RCL-473-08', target_device_id: 'DEV-OTH-471-TB01', connection_type: 'OVERHEAD', status: 'ACTIVE' },
    { source_device_id: 'DEV-OTH-471-TB01', target_device_id: 'DEV-LBS-471E12-05', connection_type: 'OVERHEAD', status: 'ACTIVE' }
  ];

  db.run(
    `INSERT INTO topology_versions (loop_id, version, status, change_summary, reason, nodes_json, edges_json, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      loop1Id,
      '1.1',
      'SUBMITTED',
      'Bổ sung Recloser DEV-RCL-473-08 vào giữa DS-471-15 và Tụ bù TB01',
      'Tăng cường khả năng tự động cô lập sự cố phân đoạn 2',
      JSON.stringify(loop1NodesV11),
      JSON.stringify(loop1EdgesV11),
      'truongca_a'
    ]
  );
  const v11Id = (db.exec("SELECT id FROM topology_versions WHERE loop_id = ? AND version = '1.1'", [loop1Id])[0].values[0][0]) as number;

  for (const n of loop1NodesV11) {
    db.run(
      `INSERT INTO topology_nodes (loop_id, version_id, device_id, pos_x, pos_y) VALUES (?, ?, ?, ?, ?)`,
      [loop1Id, v11Id, n.device_id, n.pos_x, n.pos_y]
    );
  }
  for (const e of loop1EdgesV11) {
    db.run(
      `INSERT INTO topology_edges (loop_id, version_id, source_device_id, target_device_id, connection_type, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [loop1Id, v11Id, e.source_device_id, e.target_device_id, e.connection_type, e.status, 'truongca_a']
    );
  }

  // Create Change Request for Version 1.1
  db.run(
    `INSERT INTO topology_change_requests (loop_id, version_id, version_str, requester_username, requester_fullname, status, reason, change_summary, before_snapshot, after_snapshot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      loop1Id,
      v11Id,
      '1.1',
      'truongca_a',
      'Lê Văn Trưởng Ca',
      'PENDING',
      'Đề xuất bổ sung Recloser tự đóng lại 473-08 vào mạch khép vòng để đáp ứng tiêu chuẩn N-1 của EVN NPC.',
      'Thêm 1 Node (DEV-RCL-473-08), Tách 1 Edge thành 2 Edges mới liên kết qua RCL-473-08.',
      JSON.stringify({ nodes: loop1NodesV10, edges: loop1EdgesV10 }),
      JSON.stringify({ nodes: loop1NodesV11, edges: loop1EdgesV11 })
    ]
  );

  // 2. Loop 2: Nội bộ E1.1 Nghĩa Đô
  db.run(
    `INSERT INTO loops (loop_id, name, substation_id_a, feeder_id_a, device_id_a, substation_id_b, feeder_id_b, device_id_b, status, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'KV-110-02',
      'Khép vòng nội bộ 473 E1.1 - 475 E1.1 Nghĩa Đô',
      e11Id, f473e11Id, 'DEV-RCL-473-08',
      e11Id, f475e11Id, 'DEV-RMU-475-T01',
      'CLOSED',
      'Mạch chuyển tải nội bộ giữa 2 phát tuyến 473 và 475 trạm E1.1 Nghĩa Đô.',
      'SYSTEM'
    ]
  );
  const loop2Id = (db.exec("SELECT id FROM loops WHERE loop_id = 'KV-110-02'")[0].values[0][0]) as number;

  const loop2NodesV10 = [
    { device_id: 'DEV-RCL-473-08', pos_x: 200, pos_y: 220 },
    { device_id: 'DEV-RMU-475-T01', pos_x: 550, pos_y: 220 }
  ];
  const loop2EdgesV10 = [
    { source_device_id: 'DEV-RCL-473-08', target_device_id: 'DEV-RMU-475-T01', connection_type: 'UNDERGROUND', status: 'ACTIVE' }
  ];

  db.run(
    `INSERT INTO topology_versions (loop_id, version, status, change_summary, reason, nodes_json, edges_json, created_by, approved_by, approved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      loop2Id,
      '1.0',
      'PUBLISHED',
      'Khởi tạo topology vòng nội bộ E1.1 Nghĩa Đô',
      'Kết nối ngầm 24kV dự phòng sự cố',
      JSON.stringify(loop2NodesV10),
      JSON.stringify(loop2EdgesV10),
      'admin',
      'admin'
    ]
  );
  const loop2v10Id = (db.exec("SELECT id FROM topology_versions WHERE loop_id = ? AND version = '1.0'", [loop2Id])[0].values[0][0]) as number;

  for (const n of loop2NodesV10) {
    db.run(
      `INSERT INTO topology_nodes (loop_id, version_id, device_id, pos_x, pos_y) VALUES (?, ?, ?, ?, ?)`,
      [loop2Id, loop2v10Id, n.device_id, n.pos_x, n.pos_y]
    );
  }
  for (const e of loop2EdgesV10) {
    db.run(
      `INSERT INTO topology_edges (loop_id, version_id, source_device_id, target_device_id, connection_type, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [loop2Id, loop2v10Id, e.source_device_id, e.target_device_id, e.connection_type, e.status, 'admin']
    );
  }

  // Audit Log for Phase 3 Seed
  db.run(
    `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [1, 'admin', 'Nguyễn Văn Admin', 'SEED_PHASE_3_DATA', 'KHEP_VONG', 'PHASE_3', 'Khởi tạo dữ liệu Quản lý Khép vòng và Topology sơ đồ động thành công', 'SUCCESS']
  );

  console.log('Seeding Phase 3 completed successfully!');
}

async function seedPhase4Data(db: Database) {
  console.log('Seeding Phase 4 data (Checklists, Tasks, Task Results, Inspection Schedules, Issues)...');

  // 1. Seed Checklists & Checklist Items
  db.run(
    `INSERT INTO checklists (checklist_code, title, category, description, version, target_device_type, is_template, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      'CHK-RCL-22KV',
      'Biên bản Kiểm tra Máy cắt Tự đóng lại Trung thế (Recloser)',
      'Kiểm tra định kỳ',
      'Mẫu biên bản kiểm tra kỹ thuật định kỳ máy cắt tự đóng lại Recloser 22kV theo quy định Đội Vận hành Lưới điện - PC Bình Dương / Tổng Công ty Điện lực',
      '2026.1',
      'REC',
      'admin'
    ]
  );
  const chkRclId = (db.exec("SELECT id FROM checklists WHERE checklist_code = 'CHK-RCL-22KV'")[0].values[0][0]) as number;

  const rclItems = [
    { order: 1, code: 'RCL-01', content: 'Tình trạng vận hành Recloser đang ở vị trí: Đóng [ ] Cắt [ ]', std: 'Phù hợp phương thức vận hành lưới điện', unit: '-', type: 'PASS_FAIL' },
    { order: 2, code: 'RCL-02', content: 'Kiểm tra tình trạng cách điện, vỏ Recloser có bụi bẩn, nứt nẻ, sứt mẻ hay không ?', std: 'Sạch sẽ, không nứt nẻ, không sứt mẻ, không bám bụi rò điện', unit: '-', type: 'PASS_FAIL' },
    { order: 3, code: 'RCL-03', content: 'Kiểm tra các điểm đấu nối vào và ra của Recloser xem có bị nóng đỏ, chuyển màu ? (Kết hợp camera đo nhiệt độ)', std: 'Không nóng đỏ, không chuyển màu (Nhiệt độ ≤ 65°C, ΔT ≤ 5°C)', unit: '°C', type: 'PASS_FAIL' },
    { order: 4, code: 'RCL-04', content: 'Kiểm tra tiếp đất có bị tưa, đứt, có bị mất hay không ?', std: 'Tiếp địa nguyên vẹn, bắt chặt bu lông, không tưa đứt', unit: '-', type: 'PASS_FAIL' },
    { order: 5, code: 'RCL-05', content: 'Giá trị điện trở tiếp đất đo được (Rđ)', std: 'Rđ ≤ 10 Ω (Cột đường dây) hoặc ≤ 4 Ω (Trạm)', unit: 'Ω', type: 'NUMBER' },
    { order: 6, code: 'RCL-06', content: 'Kiểm tra cáp đồng và bộ nối cáp đồng', std: 'Cáp đồng không tưa xơ, mối nối siết đúng lực, không oxy hóa', unit: '-', type: 'PASS_FAIL' },
    { order: 7, code: 'RCL-07', content: 'Kiểm tra nguồn pin tủ điều khiển, nguồn accu cung cấp cho relay bảo vệ: Giá trị Acqui 01 & Acqui 02 (Điện áp & Nội trở)', std: 'Acqui 01: U ≥ 12.5V, Rnt ≤ 25mΩ; Acqui 02: U ≥ 12.5V, Rnt ≤ 25mΩ', unit: 'V/mΩ', type: 'TEXT' },
    { order: 8, code: 'RCL-08', content: 'Các hiện tượng bất thường khác (tiếng ồn phóng điện corona, rò khí, chỉ thị áp suất SF6...)', std: 'Bình thường, không có âm thanh lạ hoặc hiện tượng phóng điện', unit: '-', type: 'PASS_FAIL' },
    { order: 9, code: 'RCL-09', content: 'Các thử nghiệm (nếu có): Đăng ký kế hoạch thử nghiệm định kỳ', std: 'Đã thử nghiệm định kỳ hoặc đăng ký kế hoạch kiểm định đúng hạn', unit: '-', type: 'TEXT' },
    { order: 10, code: 'RCL-10', content: 'Các lưu ý khác, đề xuất xử lý hoặc kiến nghị kỹ thuật', std: 'Ghi nhận chi tiết hiện trường và đề xuất xử lý kỹ thuật nếu có', unit: '-', type: 'TEXT' }
  ];

  for (const item of rclItems) {
    db.run(
      `INSERT INTO checklist_items (checklist_id, item_order, item_code, content, standard_value, unit, input_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [chkRclId, item.order, item.code, item.content, item.std, item.unit, item.type]
    );
  }

  db.run(
    `INSERT INTO checklists (checklist_code, title, category, description, version, target_device_type, is_template, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      'CHK-LBS-22KV',
      'Biên bản Kiểm tra Định kỳ Dao cắt phụ tải LBS',
      'Kiểm tra định kỳ',
      'Biên bản kiểm tra kỹ thuật định kỳ dao cắt phụ tải trung thế ngoài trời LBS theo quy chuẩn Đội Vận hành Lưới điện - Cty Điện lực Bình Dương',
      '2026.1',
      'LBS',
      'admin'
    ]
  );
  const chkLbsId = (db.exec("SELECT id FROM checklists WHERE checklist_code = 'CHK-LBS-22KV'")[0].values[0][0]) as number;

  const lbsItems = [
    { order: 1, code: 'LBS-01', content: '1. Tình trạng vận hành đang ở vị trí: Đóng [ ] Cắt [ ]', std: 'Phù hợp phương thức vận hành lưới điện', unit: '-', type: 'PASS_FAIL' },
    { order: 2, code: 'LBS-02', content: '2. Kiểm tra xung quanh vị trí LBS có cây cối, dây leo che phủ hoặc gần chạm hay không ?', std: 'Không có cây cối, dây leo che phủ hoặc gần chạm vi phạm khoảng cách an toàn', unit: '-', type: 'PASS_FAIL' },
    { order: 3, code: 'LBS-03', content: '3. Kiểm tra xung quanh LBS có công trình, nhà ở... xây dựng vi phạm hành lang an toàn hay làm cản trở lối ra vào thao tác không ?', std: 'Đảm bảo khoảng cách HLATLĐ, lối ra vào thao tác thông thoáng', unit: '-', type: 'PASS_FAIL' },
    { order: 4, code: 'LBS-04', content: '4. Kiểm tra các chống sét van (CSV) có bị nám, bị phóng điện hay không ?', std: 'CSV bình thường, không nám đen, không rạn nứt, không vết phóng điện', unit: '-', type: 'PASS_FAIL' },
    { order: 5, code: 'LBS-05', content: '5. Kiểm tra cáp xuất, cò đấu, mối nối xem có bị chuyển màu do quá tải hoặc do tiếp xúc không tốt hay không ?', std: 'Tiếp xúc tốt, không đổi màu do nhiệt (Nhiệt độ mối nối ≤ 65°C)', unit: '°C', type: 'PASS_FAIL' },
    { order: 6, code: 'LBS-06', content: '6. Kiểm tra bao sứ cách điện có nứt nẻ, bể hay phóng điện rò không ?', std: 'Sứ cách điện nguyên vẹn, sạch sẽ, không sứt mẻ rạn nứt', unit: '-', type: 'PASS_FAIL' },
    { order: 7, code: 'LBS-07', content: '7. Kiểm tra kim chỉ áp suất khí (SF6) ở vạch xanh hay vạch đỏ ?', std: 'Kim chỉ áp suất ở vùng Vạch Xanh (Đủ áp suất dập hồ quang tiêu chuẩn)', unit: 'Bar', type: 'PASS_FAIL' },
    { order: 8, code: 'LBS-08', content: '8. Trụ lắp LBS có đảm bảo độ vững chắc không ?', std: 'Trụ thẳng đứng, đà xà chắc chắn, bu lông siết chặt không nghiêng lệch', unit: '-', type: 'PASS_FAIL' },
    { order: 9, code: 'LBS-09', content: '9. Kiểm tra tiếp địa có bị đứt, bị mất cắp không ?', std: 'Dây tiếp địa còn nguyên vẹn, không bị đứt tưa, không mất cắp', unit: '-', type: 'PASS_FAIL' },
    { order: 10, code: 'LBS-10', content: '10. Kiểm tra tiếp địa đấu nối vào vỏ máy đúng kỹ thuật không ?', std: 'Tiếp địa đấu nối vào vỏ máy đúng quy trình kỹ thuật, bắt chặt chắc chắn', unit: '-', type: 'PASS_FAIL' },
    { order: 11, code: 'LBS-11', content: '11. Kiểm tra nguồn pin tủ điều khiển, nguồn accu cung cấp cho relay/RTU (Acqui 01 & 02: U(V), Rnt(mΩ))', std: 'Acqui 01: U ≥ 12.5V, Rnt ≤ 25mΩ; Acqui 02: U ≥ 12.5V, Rnt ≤ 25mΩ', unit: 'V/mΩ', type: 'TEXT' },
    { order: 12, code: 'LBS-12', content: '12. Các hiện tượng bất thường khác & Đề xuất xử lý hoặc kiến nghị', std: 'Ghi nhận chi tiết hiện trường và đề xuất xử lý kỹ thuật nếu có', unit: '-', type: 'TEXT' }
  ];

  for (const item of lbsItems) {
    db.run(
      `INSERT INTO checklist_items (checklist_id, item_order, item_code, content, standard_value, unit, input_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [chkLbsId, item.order, item.code, item.content, item.std, item.unit, item.type]
    );
  }

  // Fetch device IDs
  const devLbs1Row = db.exec("SELECT id FROM devices WHERE device_id = 'DEV-LBS-471-01'")[0]?.values[0];
  const devRcl1Row = db.exec("SELECT id FROM devices WHERE device_id = 'DEV-RCL-473-08'")[0]?.values[0];
  const devRmu1Row = db.exec("SELECT id FROM devices WHERE device_id = 'DEV-RMU-475-T01'")[0]?.values[0];
  const devDs1Row = db.exec("SELECT id FROM devices WHERE device_id = 'DEV-DS-471-15'")[0]?.values[0];

  const devLbs1Id = devLbs1Row ? (devLbs1Row[0] as number) : 1;
  const devRcl1Id = devRcl1Row ? (devRcl1Row[0] as number) : 3;
  const devRmu1Id = devRmu1Row ? (devRmu1Row[0] as number) : 4;
  const devDs1Id = devDs1Row ? (devDs1Row[0] as number) : 2;

  // Fetch user ID for nv_vanhanh
  const nvUserRow = db.exec("SELECT id FROM users WHERE username = 'nv_vanhanh'")[0]?.values[0];
  const nvUserId = nvUserRow ? (nvUserRow[0] as number) : 6;

  // 2. Seed Tasks
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const formatDate = (d: Date) => d.toISOString().split('T')[0] + ' 17:00:00';

  // Task 1: NEW / ASSIGNED task for nv_vanhanh
  db.run(
    `INSERT INTO tasks (task_code, title, device_id, assigned_to_user_id, assigned_to_username, assigned_to_fullname, team, checklist_id, assigned_date, due_date, priority, status, content, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?)`,
    [
      'TASK-2026-001',
      'Kiểm tra kỹ thuật định kỳ LBS-471/01 Cột 12',
      devLbs1Id,
      nvUserId,
      'nv_vanhanh',
      'Đỗ Văn Vận Hành',
      'ĐỘI VẬN HÀNH LƯỚI ĐIỆN',
      chkLbsId,
      formatDate(tomorrow),
      'HIGH',
      'ASSIGNED',
      'Thực hiện kiểm tra ngoại quan, đo nhiệt độ tiếp xúc lèo má dao và ghi nhận điện áp nguồn ắc quy tủ điều khiển.',
      'Chú ý chụp ảnh đồng hồ đo nhiệt độ hồng ngoại.',
      'doitruong_1'
    ]
  );

  // Task 2: IN_PROGRESS task
  db.run(
    `INSERT INTO tasks (task_code, title, device_id, assigned_to_user_id, assigned_to_username, assigned_to_fullname, team, checklist_id, assigned_date, due_date, priority, status, content, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?)`,
    [
      'TASK-2026-002',
      'Đo kiểm thông số Recloser RCL-473-08 Cột 08',
      devRcl1Id,
      nvUserId,
      'nv_vanhanh',
      'Đỗ Văn Vận Hành',
      'ĐỘI VẬN HÀNH LƯỚI ĐIỆN',
      chkRclId,
      formatDate(today),
      'URGENT',
      'IN_PROGRESS',
      'Kiểm tra áp suất khí SF6 và đo dòng điện 3 pha tải thực tế để phục vụ phương thức chuyển tải.',
      'Báo cáo kết quả trực tiếp cho Trưởng ca sau khi đo xong.',
      'truongca_a'
    ]
  );

  // Task 3: COMPLETED task
  db.run(
    `INSERT INTO tasks (task_code, title, device_id, assigned_to_user_id, assigned_to_username, assigned_to_fullname, team, checklist_id, assigned_date, due_date, priority, status, content, notes, created_by, completed_at, completed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
    [
      'TASK-2026-003',
      'Kiểm tra tổng thể Tủ RMU Phạm Văn Đồng T01',
      devRmu1Id,
      nvUserId,
      'nv_vanhanh',
      'Đỗ Văn Vận Hành',
      'ĐỘI VẬN HÀNH LƯỚI ĐIỆN',
      chkLbsId,
      formatDate(yesterday),
      'MEDIUM',
      'COMPLETED',
      'Kiểm tra định kỳ tháng tủ RMU Schneider 24kV.',
      'Tất cả thông số bình thường.',
      'doitruong_1',
      'nv_vanhanh'
    ]
  );
  const task3Id = (db.exec("SELECT id FROM tasks WHERE task_code = 'TASK-2026-003'")[0].values[0][0]) as number;

  // Insert results for Task 3
  db.run(
    `INSERT INTO task_checklist_results (task_id, checklist_id, checklist_item_id, item_content, standard_value, unit, result_value, is_pass, notes, completed_by)
     VALUES (?, ?, 1, 'Kiểm tra ngoại quan vỏ, tiếp địa, sứ cách điện', 'Sạch sẻ, không rạn nứt', '-', 'ĐẠT', 1, 'Tốt, không bụi bẩn', 'nv_vanhanh')`,
    [task3Id, chkLbsId]
  );
  db.run(
    `INSERT INTO task_checklist_results (task_id, checklist_id, checklist_item_id, item_content, standard_value, unit, result_value, is_pass, notes, completed_by)
     VALUES (?, ?, 2, 'Đo nhiệt độ tiếp xúc lèo, má dao', '<= 65°C', '°C', '42.5', 1, 'Nhiệt độ bình thường', 'nv_vanhanh')`,
    [task3Id, chkLbsId]
  );

  // 3. Seed Inspection Schedules
  db.run(
    `INSERT INTO inspection_schedules (schedule_code, title, frequency, device_id, checklist_id, assigned_team, assigned_to_user_id, next_run_date, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
    [
      'SCH-2026-01',
      'Lịch kiểm tra hàng tháng LBS 471-01 Nghĩa Đô',
      'MONTHLY',
      devLbs1Id,
      chkLbsId,
      'ĐỘI VẬN HÀNH LƯỚI ĐIỆN',
      nvUserId,
      formatDate(tomorrow),
      'doitruong_1'
    ]
  );

  db.run(
    `INSERT INTO inspection_schedules (schedule_code, title, frequency, device_id, checklist_id, assigned_team, assigned_to_user_id, next_run_date, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
    [
      'SCH-2026-02',
      'Lịch kiểm tra hàng tuần Recloser 473-08 Nghĩa Đô',
      'WEEKLY',
      devRcl1Id,
      chkRclId,
      'ĐỘI VẬN HÀNH LƯỚI ĐIỆN',
      nvUserId,
      formatDate(today),
      'doitruong_1'
    ]
  );

  // 4. Seed Issues / Anomalies
  db.run(
    `INSERT INTO issues (issue_code, device_id, title, content, severity, status, image_url, reported_by_username, reported_by_fullname, assigned_to_username, assigned_to_fullname, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'ISS-2026-001',
      devDs1Id,
      'Phát nhiệt má dao tiếp xúc DS 471-15 Cột 15',
      'Phát hiện má dao 471-15 pha B có nhiệt độ 82°C qua camera nhiệt hồng ngoại trong ca kiểm tra đêm ngày 12/08/2026.',
      'HIGH',
      'IN_PROGRESS',
      'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
      'nv_vanhanh',
      'Đỗ Văn Vận Hành',
      'doitruong_1',
      'Hoàng Văn Đội Trưởng',
      'Đã đăng ký phương thức tách lèo xiết lại bu lông má dao vào tuần tới.'
    ]
  );

  db.run(
    `INSERT INTO issues (issue_code, device_id, title, content, severity, status, image_url, reported_by_username, reported_by_fullname, assigned_to_username, assigned_to_fullname, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'ISS-2026-002',
      devRcl1Id,
      'Mất tín hiệu truyền thông SCADA Recloser 473-08',
      'Modem GPRS tủ điều khiển Recloser 473-08 bị mất kết nối về Trung tâm Điều độ B01.',
      'CRITICAL',
      'NEW',
      'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=800&q=80',
      'truongca_a',
      'Lê Văn Trưởng Ca',
      'nv_vanhanh',
      'Đỗ Văn Vận Hành',
      'Cần cử nhân viên ra kiểm tra nguồn modem và SIM GPRS.'
    ]
  );

  // Audit Log for Phase 4 Seed
  db.run(
    `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [1, 'admin', 'Nguyễn Văn Admin', 'SEED_PHASE_4_DATA', 'CONG_VIEC', 'PHASE_4', 'Khởi tạo dữ liệu Giao việc, Checklist, Kiểm tra định kỳ & Bất thường thành công', 'SUCCESS']
  );

  console.log('Seeding Phase 4 completed successfully!');
}

async function seedDeviceProposals(db: Database) {
  console.log('Seeding device proposals (Change Requests)...');

  const devLbs1 = db.exec("SELECT id, device_id, name, notes FROM devices WHERE device_id = 'DEV-LBS-471-01'")[0]?.values[0];
  const devDs1 = db.exec("SELECT id, device_id, name, pole_number, latitude, longitude FROM devices WHERE device_id = 'DEV-DS-471-15'")[0]?.values[0];
  const devRcl1 = db.exec("SELECT id, device_id, name, status, relay_79 FROM devices WHERE device_id = 'DEV-RCL-473-08'")[0]?.values[0];
  const devRmu1 = db.exec("SELECT id, device_id, name, battery_status FROM devices WHERE device_id = 'DEV-RMU-475-T01'")[0]?.values[0];

  const devLbs1Id = devLbs1 ? (devLbs1[0] as number) : null;
  const devDs1Id = devDs1 ? (devDs1[0] as number) : null;
  const devRcl1Id = devRcl1 ? (devRcl1[0] as number) : null;
  const devRmu1Id = devRmu1 ? (devRmu1[0] as number) : null;

  // Users
  const nvUserRow = db.exec("SELECT id, username, full_name, unit, team FROM users WHERE username = 'nv_vanhanh'")[0]?.values[0];
  const doitruongRow = db.exec("SELECT id, username, full_name, unit, team FROM users WHERE username = 'doitruong_1'")[0]?.values[0];
  const truongcaRow = db.exec("SELECT id, username, full_name, unit, team FROM users WHERE username = 'truongca_a'")[0]?.values[0];
  const adminRow = db.exec("SELECT id, username, full_name FROM users WHERE username = 'admin'")[0]?.values[0];

  const nvId = nvUserRow ? (nvUserRow[0] as number) : 1;
  const dtId = doitruongRow ? (doitruongRow[0] as number) : 1;
  const tcId = truongcaRow ? (truongcaRow[0] as number) : 1;
  const admId = adminRow ? (adminRow[0] as number) : 1;

  // Proposal 1: UPDATE LBS
  db.run(
    `INSERT INTO device_proposals (
      request_code, type, device_id, target_device_id_str, device_name,
      proposed_data, current_data, reason, status,
      requester_id, requester_username, requester_fullname, requester_unit, requester_team
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL', ?, ?, ?, ?, ?)`,
    [
      'PRP-2026-0001',
      'UPDATE',
      devLbs1Id,
      'DEV-LBS-471-01',
      'Dao cắt tải LBS 471-01 Nghĩa Đô',
      JSON.stringify({ rated_current: '630A', control_voltage: '24V DC', notes: 'Đã bảo dưỡng cơ cấu truyền động và buồng dập hồ quang.' }),
      devLbs1 ? JSON.stringify({ device_id: 'DEV-LBS-471-01', name: 'LBS 471-01 Nghĩa Đô', rated_current: '400A' }) : null,
      'Cập nhật thông số kỹ thuật và dòng điện định mức sau ca đại tu nâng công suất tuyến 471.',
      nvId,
      'nv_vanhanh',
      'Đỗ Văn Vận Hành',
      'Công ty Điện lực Hà Nội',
      'ĐỘI VẬN HÀNH LƯỚI ĐIỆN'
    ]
  );

  // Proposal 2: LOCATION DS
  db.run(
    `INSERT INTO device_proposals (
      request_code, type, device_id, target_device_id_str, device_name,
      proposed_data, current_data, reason, status,
      requester_id, requester_username, requester_fullname, requester_unit, requester_team
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL', ?, ?, ?, ?, ?)`,
    [
      'PRP-2026-0002',
      'LOCATION',
      devDs1Id,
      'DEV-DS-471-15',
      'Dao cách ly DS 471-15',
      JSON.stringify({ latitude: 21.03752, longitude: 105.79541, pole_number: 'Cột 15B (mới)' }),
      devDs1 ? JSON.stringify({ device_id: 'DEV-DS-471-15', pole_number: 'Cột 15', latitude: 21.0368, longitude: 105.7942 }) : null,
      'Cập nhật vị trí tọa độ GPS chính xác sau khi di dời cột 15 theo dự án mở rộng mặt đường Hoàng Quốc Việt.',
      dtId,
      'doitruong_1',
      'Hoàng Văn Đội Trưởng',
      'Công ty Điện lực Hà Nội',
      'ĐỘI VẬN HÀNH LƯỚI ĐIỆN'
    ]
  );

  // Proposal 3: STATUS RCL
  db.run(
    `INSERT INTO device_proposals (
      request_code, type, device_id, target_device_id_str, device_name,
      proposed_data, current_data, reason, status,
      requester_id, requester_username, requester_fullname, requester_unit, requester_team
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL', ?, ?, ?, ?, ?)`,
    [
      'PRP-2026-0003',
      'STATUS',
      devRcl1Id,
      'DEV-RCL-473-08',
      'Máy cắt Recloser 473-08 Nghĩa Đô',
      JSON.stringify({ status: 'TESTING', scada_status: 'SIGNAL', relay_79: 'OFF' }),
      devRcl1 ? JSON.stringify({ device_id: 'DEV-RCL-473-08', status: 'IN_SERVICE', relay_79: 'ON' }) : null,
      'Đề xuất tạm thời chuyển trạng thái sang TESTING để đơn vị thí nghiệm cao thế đo điện trở tiếp xúc và kiểm tra rơ-le 79.',
      tcId,
      'truongca_a',
      'Lê Văn Trưởng Ca',
      'Công ty Điện lực Hà Nội',
      'ĐỘI VẬN HÀNH LƯỚI ĐIỆN'
    ]
  );

  // Proposal 4: CREATE DS mới
  db.run(
    `INSERT INTO device_proposals (
      request_code, type, device_id, target_device_id_str, device_name,
      proposed_data, current_data, reason, status,
      requester_id, requester_username, requester_fullname, requester_unit, requester_team
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL', ?, ?, ?, ?, ?)`,
    [
      'PRP-2026-0004',
      'CREATE',
      null,
      'DEV-DS-471-16',
      'Dao cách ly DS 471-16 Cột 24',
      JSON.stringify({
        device_id: 'DEV-DS-471-16',
        name: 'Dao cách ly DS 471-16',
        device_type: 'DS',
        pole_number: 'Cột 24',
        feeder_id: 1,
        substation_id: 1,
        rated_voltage: '22kV',
        rated_current: '630A',
        status: 'ACTIVE',
        switch_status: 'CLOSED',
        latitude: 21.0381,
        longitude: 105.7962
      }),
      null,
      'Đề xuất thêm mới thiết bị dao cách ly phân đoạn cột 24 lộ 471 E1.1 Nghĩa Đô theo công trình chống quá tải hè 2026.',
      nvId,
      'nv_vanhanh',
      'Đỗ Văn Vận Hành',
      'Công ty Điện lực Hà Nội',
      'ĐỘI VẬN HÀNH LƯỚI ĐIỆN'
    ]
  );

  // Proposal 5: APPROVED
  db.run(
    `INSERT INTO device_proposals (
      request_code, type, device_id, target_device_id_str, device_name,
      proposed_data, current_data, reason, status,
      requester_id, requester_username, requester_fullname, requester_unit, requester_team,
      reviewer_id, reviewer_username, reviewer_fullname, review_notes, reviewed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      'PRP-2026-0005',
      'UPDATE',
      devRmu1Id,
      'DEV-RMU-475-T01',
      'Tủ RMU 475-T01 Nghĩa Đô',
      JSON.stringify({ battery_status: 'GOOD', notes: 'Ắc quy thay mới ngày 10/08/2026' }),
      devRmu1 ? JSON.stringify({ device_id: 'DEV-RMU-475-T01', battery_status: 'WEAK' }) : null,
      'Cập nhật kết quả thay ắc quy tủ RMU ngăn 475 trạm Nghĩa Đô.',
      nvId,
      'nv_vanhanh',
      'Đỗ Văn Vận Hành',
      'Công ty Điện lực Hà Nội',
      'ĐỘI VẬN HÀNH LƯỚI ĐIỆN',
      admId,
      'admin',
      'Nguyễn Văn Admin',
      'Đã xác nhận kết quả đo kiểm định, phê duyệt cập nhật thông số.'
    ]
  );

  console.log('Seeding device proposals completed successfully!');
}

// Utility DB Helpers with parameters mapping
export function dbQuery(sql: string, params: any[] = []) {
  if (!dbInstance) throw new Error('Database not initialized');
  const safeParams = params.map(p => (p === undefined ? null : p));
  const res = dbInstance.exec(sql, safeParams);
  if (!res || res.length === 0) return [];
  
  const columns = res[0].columns;
  const values = res[0].values;
  
  return values.map(row => {
    const obj: Record<string, any> = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
}

export function dbQueryOne(sql: string, params: any[] = []) {
  const rows = dbQuery(sql, params);
  return rows[0] || null;
}

export function dbRun(sql: string, params: any[] = []) {
  if (!dbInstance) throw new Error('Database not initialized');
  const safeParams = params.map(p => (p === undefined ? null : p));
  dbInstance.run(sql, safeParams);
  saveDb();
}

// ----------------------------------------------------
// System Snapshot Backup & Restore Engine for ADMIN
// ----------------------------------------------------

const OPERATIONAL_TABLES = [
  'substations',
  'feeders',
  'devices',
  'device_images',
  'device_locations',
  'device_status_history',
  'device_proposals',
  'loops',
  'topology_versions',
  'topology_nodes',
  'topology_edges',
  'topology_change_requests',
  'checklists',
  'checklist_items',
  'tasks',
  'task_checklist_results',
  'task_histories',
  'inspection_schedules',
  'issues',
  'documents',
  'guides'
];

export function exportGridDataJson(): { data: Record<string, any[]>; counts: Record<string, number> } {
  const data: Record<string, any[]> = {};
  const counts: Record<string, number> = {};

  for (const table of OPERATIONAL_TABLES) {
    try {
      const rows = dbQuery(`SELECT * FROM ${table}`);
      data[table] = rows;
      counts[table] = rows.length;
    } catch (e) {
      data[table] = [];
      counts[table] = 0;
    }
  }

  // Aggregate standard high-level summary counts
  const summaryCounts = {
    devices: counts['devices'] || 0,
    feeders: counts['feeders'] || 0,
    stations: counts['substations'] || 0,
    loops: counts['loops'] || 0,
    work: (counts['tasks'] || 0) + (counts['inspection_schedules'] || 0) + (counts['issues'] || 0),
    tasks: counts['tasks'] || 0,
    checklists: counts['checklists'] || 0,
    schedules: counts['inspection_schedules'] || 0,
    issues: counts['issues'] || 0,
    topology: (counts['topology_nodes'] || 0) + (counts['topology_edges'] || 0),
    links: (counts['device_locations'] || 0) + (counts['device_images'] || 0) + (counts['device_status_history'] || 0) + (counts['device_proposals'] || 0) + (counts['task_checklist_results'] || 0)
  };

  return {
    data,
    counts: summaryCounts
  };
}

export function createSystemBackup(
  name: string,
  backupType: 'AUTO_BEFORE_RESET' | 'AUTO_BEFORE_RESTORE' | 'MANUAL' | 'SNAPSHOT' | 'PERIODIC' = 'MANUAL',
  user?: { id?: number; full_name?: string; username?: string } | null,
  notes?: string
) {
  const { data, counts } = exportGridDataJson();
  const dataJsonStr = JSON.stringify(data);
  const countsSummaryStr = JSON.stringify(counts);
  const sizeBytes = Buffer.byteLength(dataJsonStr, 'utf8');

  // Save to backups directory if possible
  const backupsDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupsDir)) {
    try { fs.mkdirSync(backupsDir, { recursive: true }); } catch (e) {}
  }
  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `snapshot_${backupType.toLowerCase()}_${timestampStr}.json`;
  const filePath = path.join(backupsDir, fileName);
  try {
    fs.writeFileSync(filePath, dataJsonStr);
  } catch (e) {}

  dbRun(
    `INSERT INTO system_backups (name, backup_type, file_path, counts_summary, data_json, file_size_bytes, created_by, created_by_name, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      name,
      backupType,
      fileName,
      countsSummaryStr,
      "",
      sizeBytes,
      user?.id || 1,
      user?.full_name || user?.username || 'Hệ thống Admin',
      notes || null
    ]
  );

  const inserted = dbQueryOne(`SELECT * FROM system_backups ORDER BY id DESC LIMIT 1`);
  return {
    ...inserted,
    counts_summary: counts
  };
}

export function restoreFromBackup(
  backupIdOrLatest: number | string | 'latest',
  user?: { id?: number; full_name?: string; username?: string; roles?: string[] } | null
) {
  let backupRow: any = null;
  if (backupIdOrLatest === 'latest') {
    backupRow = dbQueryOne(`SELECT * FROM system_backups ORDER BY id DESC LIMIT 1`);
  } else {
    backupRow = dbQueryOne(`SELECT * FROM system_backups WHERE id = ?`, [backupIdOrLatest]);
  }

  if (!backupRow) {
    throw new Error('Không tìm thấy bản sao lưu nào để khôi phục.');
  }

  let parsedData: Record<string, any[]> = {};
  try {
    parsedData = JSON.parse(backupRow.data_json);
  } catch (e) {
    throw new Error('Dữ liệu bản sao lưu bị hỏng hoặc không đúng định dạng JSON.');
  }

  // 1. Automatically create safety snapshot of current live state before overwriting
  try {
    createSystemBackup(
      `Tự động sao lưu an toàn trước khi Khôi phục #${backupRow.id}`,
      'AUTO_BEFORE_RESTORE',
      user,
      `Điểm phục hồi tự động an toàn trước khi khôi phục từ bản "${backupRow.name}"`
    );
  } catch (e) {
    console.error('Safety snapshot before restore skipped:', e);
  }

  const beforeCounts = exportGridDataJson().counts;

  try {
    dbRun('BEGIN TRANSACTION');

    // Strict reverse-dependency cleanup of operational tables
    dbRun('DELETE FROM task_checklist_results');
    dbRun('DELETE FROM task_histories');
    dbRun('DELETE FROM issues');
    dbRun('DELETE FROM tasks');
    dbRun('DELETE FROM inspection_schedules');
    dbRun('DELETE FROM checklist_items');
    dbRun('DELETE FROM checklists');

    dbRun('DELETE FROM topology_edges');
    dbRun('DELETE FROM topology_nodes');
    dbRun('DELETE FROM topology_change_requests');
    dbRun('DELETE FROM topology_versions');
    dbRun('DELETE FROM loops');

    dbRun('DELETE FROM device_proposals');
    dbRun('DELETE FROM device_status_history');
    dbRun('DELETE FROM device_locations');
    dbRun('DELETE FROM device_images');

    dbRun('DELETE FROM devices');
    dbRun('DELETE FROM feeders');
    dbRun('DELETE FROM substations');
    dbRun('DELETE FROM documents');
    dbRun('DELETE FROM guides');

    // Restore table records in strict forward dependency order
    for (const table of OPERATIONAL_TABLES) {
      const rows = parsedData[table] || [];
      if (rows.length > 0) {
        for (const row of rows) {
          const keys = Object.keys(row);
          if (keys.length === 0) continue;
          const placeholders = keys.map(() => '?').join(', ');
          const values = keys.map(k => row[k]);
          dbRun(`INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`, values);
        }
      }
    }

    dbRun('COMMIT');

    const afterCounts = exportGridDataJson().counts;

    // Log in audit log
    try {
      dbRun(
        `INSERT INTO audit_logs (user_id, username, user_fullname, action, module, target_id, details, result, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user?.id || 1,
          user?.username || 'admin',
          user?.full_name || 'Quản trị viên',
          'RESTORE_GRID_BACKUP_DATA',
          'SYSTEM',
          String(backupRow.id),
          JSON.stringify({
            backup_id: backupRow.id,
            backup_name: backupRow.name,
            backup_type: backupRow.backup_type,
            backup_created_at: backupRow.created_at,
            devices_restored: afterCounts.devices,
            feeders_restored: afterCounts.feeders,
            substations_restored: afterCounts.stations,
            loops_restored: afterCounts.loops,
            tasks_restored: afterCounts.tasks,
            before_counts: beforeCounts,
            after_counts: afterCounts
          }),
          'SUCCESS',
          '127.0.0.1'
        ]
      );
    } catch (e) {}

    return {
      success: true,
      backup_id: backupRow.id,
      backup_name: backupRow.name,
      backup_created_at: backupRow.created_at,
      counts_before: beforeCounts,
      counts_after: afterCounts,
      message: `Khôi phục dữ liệu thành công từ bản sao lưu "${backupRow.name}"!`
    };
  } catch (err: any) {
    dbRun('ROLLBACK');
    throw new Error(`Lỗi Transaction khi khôi phục dữ liệu: ${err.message}`);
  }
}

// Auto-seed initial pristine baseline backup point on startup if table is empty
export function ensureInitialBaselineBackup() {
  try {
    const check = dbQueryOne(`SELECT COUNT(*) as count FROM system_backups`);
    if (!check || check.count === 0) {
      console.log('[System Backup] Creating initial baseline backup snapshot...');
      createSystemBackup(
        'Bản sao lưu chuẩn cơ sở dữ liệu ban đầu (Baseline Snapshot)',
        'SNAPSHOT',
        { id: 1, full_name: 'Hệ Thống Lưới Điện', username: 'system' },
        'Điểm khôi phục chuẩn mẫu ban đầu có đầy đủ trạm 110kV, phát tuyến, thiết bị và công việc mẫu.'
      );
    }
  } catch (e) {
    console.error('ensureInitialBaselineBackup warning:', e);
  }
}

