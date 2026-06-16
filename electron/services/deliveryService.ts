import { getDb } from '../database'
import dayjs from 'dayjs'
import { calculateDiscount, DiscountCalculateInput, getCourierAvailableCoupons } from './discountService'
import { getQuotaConfig, getCurrentMonthQuota } from './quotaService'

function generatePickupCode() {
  const chars = '0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export function listDeliveries(params: any = {}) {
  const db = getDb()
  let sql = `
    SELECT d.*, c.name as courier_name, c.phone as courier_phone
    FROM deliveries d
    LEFT JOIN couriers c ON d.courier_id = c.id
    WHERE 1=1
  `
  const conditions: string[] = []
  const args: any[] = []

  if (params.courier_id) {
    conditions.push('d.courier_id = ?')
    args.push(params.courier_id)
  }
  if (params.status) {
    conditions.push('d.status = ?')
    args.push(params.status)
  }
  if (params.start_date) {
    conditions.push("d.created_at >= ?")
    args.push(params.start_date + ' 00:00:00')
  }
  if (params.end_date) {
    conditions.push("d.created_at <= ?")
    args.push(params.end_date + ' 23:59:59')
  }
  if (params.keyword) {
    conditions.push('(d.pickup_code LIKE ? OR c.name LIKE ? OR d.recipient_phone LIKE ?)')
    const kw = `%${params.keyword}%`
    args.push(kw, kw, kw)
  }

  if (conditions.length > 0) {
    sql += ' AND ' + conditions.join(' AND ')
  }
  sql += ' ORDER BY d.id DESC LIMIT 500'

  return db.prepare(sql).all(...args)
}

export function getDeliveryDetail(id: number) {
  const db = getDb()
  const delivery = db.prepare(`
    SELECT d.*, c.name as courier_name, c.phone as courier_phone
    FROM deliveries d
    LEFT JOIN couriers c ON d.courier_id = c.id
    WHERE d.id = ?
  `).get(id) as any

  if (delivery && delivery.discount_detail) {
    try {
      delivery.discount_detail_parsed = JSON.parse(delivery.discount_detail)
    } catch (e) {}
  }
  return delivery
}

export function previewDelivery(data: any) {
  const config = getQuotaConfig() as any
  const calcInput: DiscountCalculateInput = {
    courier_id: data.courier_id,
    base_amount: config.delivery_fee,
    overdue_amount: 0,
    use_quota: data.use_quota,
    coupon_id: data.courier_coupon_id,
    selected_promotion_ids: data.promotion_ids,
    preview: true
  }
  return calculateDiscount(calcInput)
}

export function createDelivery(data: any) {
  const db = getDb()
  const config = getQuotaConfig() as any

  const baseDeliveryFee = config.delivery_fee
  let pickupCode = generatePickupCode()
  while (db.prepare('SELECT id FROM deliveries WHERE pickup_code = ?').get(pickupCode)) {
    pickupCode = generatePickupCode()
  }

  const calcInput: DiscountCalculateInput = {
    courier_id: data.courier_id,
    base_amount: baseDeliveryFee,
    overdue_amount: 0,
    use_quota: data.use_quota,
    coupon_id: data.courier_coupon_id,
    selected_promotion_ids: data.promotion_ids,
    preview: false
  }

  const tx = db.transaction(() => {
    const discountResult = calculateDiscount(calcInput)

    const result = db.prepare(`
      INSERT INTO deliveries (
        courier_id, locker_no, pickup_code, recipient_phone, size,
        delivery_fee, overdue_fee, total_fee, discount_amount, final_amount,
        use_quota, status, coupon_id, promotion_ids, discount_detail
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'stored', ?, ?, ?)
    `).run(
      data.courier_id,
      data.locker_no || 'A01',
      pickupCode,
      data.recipient_phone || null,
      data.size || 'medium',
      discountResult.base_amount,
      0,
      discountResult.total_before,
      discountResult.discount_amount,
      discountResult.final_amount,
      discountResult.use_quota ? 1 : 0,
      data.courier_coupon_id || null,
      data.promotion_ids ? JSON.stringify(data.promotion_ids) : null,
      JSON.stringify(discountResult)
    )

    if (data.courier_coupon_id) {
      db.prepare(`
        UPDATE courier_coupons
        SET status = 'used', used_at = datetime('now', 'localtime'), used_in_delivery = ?
        WHERE id = ? AND status = 'unused'
      `).run(result.lastInsertRowid, data.courier_coupon_id)
    }

    return {
      id: result.lastInsertRowid,
      pickup_code: pickupCode,
      ...discountResult
    }
  })

  return tx()
}

export function calculateOverdueFee(delivery: any) {
  const config = getQuotaConfig() as any
  const storedAt = dayjs(delivery.stored_at)
  const now = dayjs()
  const diffHours = now.diff(storedAt, 'hour')
  const overdueHours = Math.max(0, diffHours - config.free_hours)
  const overdueFee = overdueHours * config.overdue_fee_per_hour
  return { overdue_hours: overdueHours, overdue_fee: Number(overdueFee.toFixed(2)) }
}

export function previewPickupDiscount(pickupCode: string, couponId?: number) {
  const db = getDb()
  const delivery = db.prepare('SELECT * FROM deliveries WHERE pickup_code = ?').get(pickupCode) as any

  if (!delivery) {
    return { success: false, message: '取件码不存在' }
  }
  if (delivery.status !== 'stored') {
    return { success: false, message: '该包裹已被取走或状态异常' }
  }

  const overdueInfo = calculateOverdueFee(delivery)
  if (overdueInfo.overdue_fee <= 0) {
    return {
      success: true,
      delivery,
      overdue_info: overdueInfo,
      discount_result: {
        base_amount: 0,
        overdue_amount: 0,
        total_before: 0,
        discount_amount: 0,
        final_amount: 0,
        steps: [],
        negative_protected: false
      }
    }
  }

  const availableCoupons = getCourierAvailableCoupons(delivery.courier_id, overdueInfo.overdue_fee)

  const calcInput: DiscountCalculateInput = {
    courier_id: delivery.courier_id,
    base_amount: 0,
    overdue_amount: overdueInfo.overdue_fee,
    use_quota: false,
    coupon_id: couponId,
    preview: true
  }
  const discountResult = calculateDiscount(calcInput)

  return {
    success: true,
    delivery,
    overdue_info: overdueInfo,
    available_coupons: availableCoupons,
    discount_result: discountResult
  }
}

export function pickupDelivery(pickupCode: string, couponId?: number) {
  const db = getDb()
  const delivery = db.prepare('SELECT * FROM deliveries WHERE pickup_code = ?').get(pickupCode) as any

  if (!delivery) {
    return { success: false, message: '取件码不存在' }
  }
  if (delivery.status !== 'stored') {
    return { success: false, message: '该包裹已被取走或状态异常' }
  }

  const overdueInfo = calculateOverdueFee(delivery)

  const tx = db.transaction(() => {
    if (overdueInfo.overdue_fee > 0) {
      const calcInput: DiscountCalculateInput = {
        courier_id: delivery.courier_id,
        base_amount: 0,
        overdue_amount: overdueInfo.overdue_fee,
        use_quota: false,
        coupon_id: couponId,
        preview: false
      }
      const discountResult = calculateDiscount(calcInput)

      if (couponId) {
        db.prepare(`
          UPDATE courier_coupons
          SET status = 'used', used_at = datetime('now', 'localtime'), used_in_delivery = ?
          WHERE id = ? AND status = 'unused'
        `).run(delivery.id, couponId)
      }

      db.prepare(`
        UPDATE deliveries
        SET status = 'picked', picked_at = datetime('now', 'localtime'),
            overdue_hours = ?, overdue_fee = ?,
            total_fee = ?, discount_amount = ?, final_amount = ?,
            coupon_id = ?, discount_detail = ?
        WHERE id = ?
      `).run(
        overdueInfo.overdue_hours,
        overdueInfo.overdue_fee,
        discountResult.total_before,
        discountResult.discount_amount,
        discountResult.final_amount,
        couponId || null,
        JSON.stringify(discountResult),
        delivery.id
      )

      return { success: true, message: '取件成功', overdue_info: overdueInfo, discount_result: discountResult }
    } else {
      db.prepare(`
        UPDATE deliveries
        SET status = 'picked', picked_at = datetime('now', 'localtime'), overdue_hours = 0
        WHERE id = ?
      `).run(delivery.id)

      return { success: true, message: '取件成功', overdue_info: overdueInfo, discount_result: null }
    }
  })

  return tx()
}

export function listCouriers() {
  const db = getDb()
  return db.prepare('SELECT * FROM couriers WHERE status = 1 ORDER BY id').all()
}

export function createCourier(data: any) {
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO couriers (name, phone, company) VALUES (?, ?, ?)
  `).run(data.name, data.phone, data.company || null)
  const courier = db.prepare('SELECT * FROM couriers WHERE id = ?').get(result.lastInsertRowid)
  const month = dayjs().format('YYYY-MM')
  getCurrentMonthQuota(Number(result.lastInsertRowid))
  return courier
}

export function updateCourier(id: number, data: any) {
  const db = getDb()
  const result = db.prepare(`
    UPDATE couriers SET name = ?, phone = ?, company = ?, updated_at = datetime('now', 'localtime') WHERE id = ?
  `).run(data.name, data.phone, data.company || null, id)
  return result.changes > 0
}

export function deleteCourier(id: number) {
  const db = getDb()
  const result = db.prepare('UPDATE couriers SET status = 0 WHERE id = ?').run(id)
  return result.changes > 0
}
