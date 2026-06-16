import { getDb } from '../database'
import dayjs from 'dayjs'

export function getQuotaConfig() {
  const db = getDb()
  return db.prepare('SELECT * FROM quota_config WHERE id = 1').get()
}

export function updateQuotaConfig(data: any) {
  const db = getDb()
  const result = db.prepare(`
    UPDATE quota_config
    SET monthly_free_quota = ?, delivery_fee = ?, overdue_fee_per_hour = ?, free_hours = ?, updated_at = datetime('now', 'localtime')
    WHERE id = 1
  `).run(data.monthly_free_quota, data.delivery_fee, data.overdue_fee_per_hour, data.free_hours)
  return result.changes > 0
}

export function getCurrentMonthQuota(courierId: number) {
  const db = getDb()
  const month = dayjs().format('YYYY-MM')
  let quota = db.prepare('SELECT * FROM monthly_quotas WHERE courier_id = ? AND month = ?').get(courierId, month)

  if (!quota) {
    quota = initializeMonthlyQuota(courierId, month)
  }
  return quota
}

export function initializeMonthlyQuota(courierId: number, month: string) {
  const db = getDb()
  const config = getQuotaConfig() as any
  const result = db.prepare(`
    INSERT INTO monthly_quotas (courier_id, month, total_quota, remaining_quota)
    VALUES (?, ?, ?, ?)
  `).run(courierId, month, config.monthly_free_quota, config.monthly_free_quota)

  db.prepare(`
    INSERT INTO quota_records (courier_id, type, amount, balance, month, remark)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(courierId, 'grant', config.monthly_free_quota, config.monthly_free_quota, month, `${month}月度免费额度发放`)

  return db.prepare('SELECT * FROM monthly_quotas WHERE id = ?').get(result.lastInsertRowid)
}

export function listQuotaHistory(courierId: number) {
  const db = getDb()
  return db.prepare(`
    SELECT qr.*, c.name as courier_name
    FROM quota_records qr
    LEFT JOIN couriers c ON qr.courier_id = c.id
    WHERE qr.courier_id = ?
    ORDER BY qr.created_at DESC
    LIMIT 100
  `).all(courierId)
}

export function grantQuota(data: any) {
  const db = getDb()
  const { courier_id, amount, remark } = data
  const month = dayjs().format('YYYY-MM')

  const tx = db.transaction(() => {
    let quota = db.prepare('SELECT * FROM monthly_quotas WHERE courier_id = ? AND month = ?').get(courier_id, month) as any
    if (!quota) {
      quota = initializeMonthlyQuota(courier_id, month)
    }

    const newTotal = (quota.total_quota as number) + amount
    const newRemaining = (quota.remaining_quota as number) + amount

    db.prepare(`
      UPDATE monthly_quotas
      SET total_quota = ?, remaining_quota = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(newTotal, newRemaining, quota.id)

    db.prepare(`
      INSERT INTO quota_records (courier_id, type, amount, balance, month, remark)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(courier_id, 'manual_grant', amount, newRemaining, month, remark || '手动发放额度')

    return { success: true, remaining_quota: newRemaining }
  })

  return tx()
}

export function consumeQuota(courierId: number, amount: number = 1) {
  const db = getDb()
  const month = dayjs().format('YYYY-MM')

  let quota = db.prepare('SELECT * FROM monthly_quotas WHERE courier_id = ? AND month = ?').get(courierId, month) as any
  if (!quota) {
    quota = initializeMonthlyQuota(courierId, month)
  }

  if ((quota.remaining_quota as number) >= amount) {
    const tx = db.transaction(() => {
      const newUsed = (quota.used_quota as number) + amount
      const newRemaining = (quota.remaining_quota as number) - amount

      db.prepare(`
        UPDATE monthly_quotas
        SET used_quota = ?, remaining_quota = ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(newUsed, newRemaining, quota.id)

      db.prepare(`
        INSERT INTO quota_records (courier_id, type, amount, balance, month, remark)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(courierId, 'consume', -amount, newRemaining, month, '投放消费额度')

      return { used_quota: true, remaining_quota: newRemaining }
    })
    return tx()
  }

  return { used_quota: false, remaining_quota: quota.remaining_quota, reason: 'insufficient_quota' }
}

export function resetMonthlyQuotas() {
  const db = getDb()
  const month = dayjs().format('YYYY-MM')
  const config = getQuotaConfig() as any

  const couriers = db.prepare('SELECT id FROM couriers WHERE status = 1').all() as any[]
  const results: any[] = []

  const tx = db.transaction(() => {
    for (const courier of couriers) {
      const existing = db.prepare('SELECT id FROM monthly_quotas WHERE courier_id = ? AND month = ?').get(courier.id, month)
      if (!existing) {
        initializeMonthlyQuota(courier.id, month)
        results.push({ courier_id: courier.id, status: 'initialized', quota: config.monthly_free_quota })
      } else {
        results.push({ courier_id: courier.id, status: 'already_exists' })
      }
    }
  })

  tx()
  return { total: couriers.length, results }
}

export function getQuotaOverview() {
  const db = getDb()
  const month = dayjs().format('YYYY-MM')

  return db.prepare(`
    SELECT
      c.id,
      c.name,
      c.phone,
      mq.month,
      mq.total_quota,
      mq.used_quota,
      mq.remaining_quota
    FROM couriers c
    LEFT JOIN monthly_quotas mq ON c.id = mq.courier_id AND mq.month = ?
    WHERE c.status = 1
    ORDER BY c.id
  `).all(month)
}
