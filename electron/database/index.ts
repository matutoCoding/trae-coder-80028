import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

let db: Database.Database

export function initDatabase() {
  const userData = app.getPath('userData')
  const dbDir = path.join(userData, 'data')
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  const dbPath = path.join(dbDir, 'locker.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  createTables()
  seedInitialData()

  return db
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS couriers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      company TEXT,
      status INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS quota_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      monthly_free_quota INTEGER DEFAULT 50,
      delivery_fee REAL DEFAULT 1.0,
      overdue_fee_per_hour REAL DEFAULT 0.5,
      free_hours INTEGER DEFAULT 24,
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS quota_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courier_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance INTEGER NOT NULL,
      month TEXT NOT NULL,
      remark TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (courier_id) REFERENCES couriers(id)
    );

    CREATE TABLE IF NOT EXISTS monthly_quotas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courier_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      total_quota INTEGER NOT NULL,
      used_quota INTEGER DEFAULT 0,
      remaining_quota INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(courier_id, month),
      FOREIGN KEY (courier_id) REFERENCES couriers(id)
    );

    CREATE TABLE IF NOT EXISTS deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courier_id INTEGER NOT NULL,
      locker_no TEXT NOT NULL,
      pickup_code TEXT NOT NULL UNIQUE,
      recipient_phone TEXT,
      size TEXT DEFAULT 'medium',
      delivery_fee REAL DEFAULT 0,
      overdue_fee REAL DEFAULT 0,
      total_fee REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      final_amount REAL DEFAULT 0,
      use_quota INTEGER DEFAULT 0,
      status TEXT DEFAULT 'stored',
      stored_at TEXT DEFAULT (datetime('now', 'localtime')),
      picked_at TEXT,
      overdue_hours INTEGER DEFAULT 0,
      coupon_id INTEGER,
      promotion_ids TEXT,
      discount_detail TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (courier_id) REFERENCES couriers(id)
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      value REAL NOT NULL,
      min_amount REAL DEFAULT 0,
      valid_days INTEGER DEFAULT 30,
      status INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS courier_coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courier_id INTEGER NOT NULL,
      coupon_id INTEGER NOT NULL,
      code TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'unused',
      valid_from TEXT NOT NULL,
      valid_to TEXT NOT NULL,
      used_at TEXT,
      used_in_delivery INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (courier_id) REFERENCES couriers(id),
      FOREIGN KEY (coupon_id) REFERENCES coupons(id)
    );

    CREATE TABLE IF NOT EXISTS promotions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      min_amount REAL NOT NULL,
      discount_amount REAL NOT NULL,
      start_date TEXT,
      end_date TEXT,
      status INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS discount_rule_order (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      rule_order TEXT DEFAULT '["promotion","coupon","quota"]',
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courier_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      total_deliveries INTEGER DEFAULT 0,
      quota_deliveries INTEGER DEFAULT 0,
      paid_deliveries INTEGER DEFAULT 0,
      delivery_fee REAL DEFAULT 0,
      overdue_fee REAL DEFAULT 0,
      total_fee REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      final_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'unpaid',
      generated_at TEXT DEFAULT (datetime('now', 'localtime')),
      paid_at TEXT,
      UNIQUE(courier_id, month),
      FOREIGN KEY (courier_id) REFERENCES couriers(id)
    );

    CREATE TABLE IF NOT EXISTS bill_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL,
      delivery_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      remark TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (bill_id) REFERENCES bills(id),
      FOREIGN KEY (delivery_id) REFERENCES deliveries(id)
    );

    CREATE INDEX IF NOT EXISTS idx_quota_records_courier ON quota_records(courier_id, month);
    CREATE INDEX IF NOT EXISTS idx_deliveries_courier ON deliveries(courier_id, status);
    CREATE INDEX IF NOT EXISTS idx_deliveries_code ON deliveries(pickup_code);
    CREATE INDEX IF NOT EXISTS idx_bills_courier ON bills(courier_id, month);
  `)
}

function seedInitialData() {
  const configRow = db.prepare('SELECT id FROM quota_config WHERE id = 1').get()
  if (!configRow) {
    db.prepare(`
      INSERT INTO quota_config (id, monthly_free_quota, delivery_fee, overdue_fee_per_hour, free_hours)
      VALUES (1, 50, 1.0, 0.5, 24)
    `).run()
  }

  const ruleRow = db.prepare('SELECT id FROM discount_rule_order WHERE id = 1').get()
  if (!ruleRow) {
    db.prepare(`
      INSERT INTO discount_rule_order (id, rule_order)
      VALUES (1, '["promotion","coupon","quota"]')
    `).run()
  }

  const courierCount = db.prepare('SELECT COUNT(*) as cnt FROM couriers').get() as { cnt: number }
  if (courierCount.cnt === 0) {
    const insertCourier = db.prepare(`
      INSERT INTO couriers (name, phone, company) VALUES (?, ?, ?)
    `)
    insertCourier.run('张三', '13800138001', '顺丰速运')
    insertCourier.run('李四', '13800138002', '圆通速递')
    insertCourier.run('王五', '13800138003', '中通快递')
  }
}

export function getDb() {
  return db
}
