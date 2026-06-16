import { getDb } from '../database'
import dayjs from 'dayjs'
import crypto from 'crypto'

export function listCoupons(params: any = {}) {
  const db = getDb()
  let sql = 'SELECT * FROM coupons WHERE 1=1'
  const args: any[] = []

  if (params.status !== undefined) {
    sql += ' AND status = ?'
    args.push(params.status)
  }
  sql += ' ORDER BY id DESC'

  return db.prepare(sql).all(...args)
}

export function createCoupon(data: any) {
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO coupons (name, type, value, min_amount, valid_days, status)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(data.name, data.type, data.value, data.min_amount || 0, data.valid_days || 30)
  return { id: result.lastInsertRowid, ...data }
}

export function updateCoupon(id: number, data: any) {
  const db = getDb()
  const result = db.prepare(`
    UPDATE coupons SET name = ?, type = ?, value = ?, min_amount = ?, valid_days = ?, status = ? WHERE id = ?
  `).run(data.name, data.type, data.value, data.min_amount || 0, data.valid_days || 30, data.status, id)
  return result.changes > 0
}

export function deleteCoupon(id: number) {
  const db = getDb()
  const result = db.prepare('DELETE FROM coupons WHERE id = ?').run(id)
  return result.changes > 0
}

function generateCouponCode() {
  return 'CP' + crypto.randomBytes(4).toString('hex').toUpperCase()
}

export function grantCouponToCourier(data: any) {
  const db = getDb()
  const coupon = db.prepare('SELECT * FROM coupons WHERE id = ?').get(data.coupon_id) as any
  if (!coupon) {
    throw new Error('优惠券不存在')
  }

  const validFrom = dayjs().format('YYYY-MM-DD HH:mm:ss')
  const validTo = dayjs().add(coupon.valid_days, 'day').format('YYYY-MM-DD HH:mm:ss')

  const tx = db.transaction(() => {
    const results: any[] = []
    for (let i = 0; i < (data.quantity || 1); i++) {
      let code = generateCouponCode()
      while (db.prepare('SELECT id FROM courier_coupons WHERE code = ?').get(code)) {
        code = generateCouponCode()
      }
      const result = db.prepare(`
        INSERT INTO courier_coupons (courier_id, coupon_id, code, valid_from, valid_to)
        VALUES (?, ?, ?, ?, ?)
      `).run(data.courier_id, data.coupon_id, code, validFrom, validTo)
      results.push({ id: result.lastInsertRowid, code })
    }
    return results
  })

  return tx()
}

export function listCourierCoupons(courierId: number) {
  const db = getDb()
  return db.prepare(`
    SELECT cc.*, c.name, c.type, c.value, c.min_amount
    FROM courier_coupons cc
    JOIN coupons c ON cc.coupon_id = c.id
    WHERE cc.courier_id = ?
    ORDER BY cc.created_at DESC
    LIMIT 200
  `).all(courierId)
}
