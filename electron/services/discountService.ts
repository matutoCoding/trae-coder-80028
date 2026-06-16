import { getDb } from '../database'
import dayjs from 'dayjs'
import { consumeQuota } from './quotaService'

export function getDiscountRuleOrder() {
  const db = getDb()
  const row = db.prepare('SELECT rule_order FROM discount_rule_order WHERE id = 1').get() as any
  return JSON.parse(row.rule_order)
}

export function updateDiscountRuleOrder(order: string[]) {
  const db = getDb()
  const validRules = ['promotion', 'coupon', 'quota']
  const filtered = order.filter(r => validRules.includes(r))
  const unique = [...new Set(filtered)]
  for (const r of validRules) {
    if (!unique.includes(r)) unique.push(r)
  }
  const result = db.prepare(`
    UPDATE discount_rule_order SET rule_order = ?, updated_at = datetime('now', 'localtime') WHERE id = 1
  `).run(JSON.stringify(unique))
  return result.changes > 0
}

export function listPromotions() {
  const db = getDb()
  return db.prepare('SELECT * FROM promotions ORDER BY id DESC').all()
}

export function createPromotion(data: any) {
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO promotions (name, type, min_amount, discount_amount, start_date, end_date, status)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(data.name, data.type, data.min_amount, data.discount_amount, data.start_date || null, data.end_date || null)
  return { id: result.lastInsertRowid, ...data }
}

export function updatePromotion(id: number, data: any) {
  const db = getDb()
  const result = db.prepare(`
    UPDATE promotions
    SET name = ?, type = ?, min_amount = ?, discount_amount = ?, start_date = ?, end_date = ?, status = ?
    WHERE id = ?
  `).run(data.name, data.type, data.min_amount, data.discount_amount, data.start_date || null, data.end_date || null, data.status, id)
  return result.changes > 0
}

export function deletePromotion(id: number) {
  const db = getDb()
  const result = db.prepare('DELETE FROM promotions WHERE id = ?').run(id)
  return result.changes > 0
}

export function getAvailablePromotions(amount: number) {
  const db = getDb()
  const now = dayjs().format('YYYY-MM-DD')
  return db.prepare(`
    SELECT * FROM promotions
    WHERE status = 1
      AND min_amount <= ?
      AND (start_date IS NULL OR start_date <= ?)
      AND (end_date IS NULL OR end_date >= ?)
    ORDER BY min_amount DESC
  `).all(amount, now, now)
}

export function getCourierAvailableCoupons(courierId: number, amount: number) {
  const db = getDb()
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
  return db.prepare(`
    SELECT cc.*, c.name, c.type, c.value, c.min_amount
    FROM courier_coupons cc
    JOIN coupons c ON cc.coupon_id = c.id
    WHERE cc.courier_id = ?
      AND cc.status = 'unused'
      AND c.min_amount <= ?
      AND cc.valid_from <= ?
      AND cc.valid_to >= ?
    ORDER BY c.value DESC
  `).all(courierId, amount, now, now)
}

export interface DiscountCalculateInput {
  courier_id: number
  base_amount: number
  overdue_amount: number
  use_quota?: boolean
  coupon_id?: number
  selected_promotion_ids?: number[]
}

export interface DiscountStep {
  rule: string
  rule_name: string
  before_amount: number
  discount_amount: number
  after_amount: number
  detail: string
}

export interface DiscountCalculateResult {
  base_amount: number
  overdue_amount: number
  total_before: number
  discount_amount: number
  final_amount: number
  use_quota: boolean
  quota_used: number
  steps: DiscountStep[]
  applied_coupon?: any
  applied_promotions?: any[]
  negative_protected: boolean
}

export function calculateDiscount(input: DiscountCalculateInput): DiscountCalculateResult {
  const db = getDb()
  const ruleOrder = getDiscountRuleOrder()
  const total_before = Number((input.base_amount + input.overdue_amount).toFixed(2))
  let current_amount = total_before
  const steps: DiscountStep[] = []
  let total_discount = 0
  let use_quota = false
  let quota_used = 0
  let applied_coupon: any = null
  let applied_promotions: any[] = []
  let negative_protected = false

  for (const rule of ruleOrder) {
    const before_amount = Number(current_amount.toFixed(2))

    if (rule === 'promotion') {
      const promotions = getAvailablePromotions(total_before)
      if (promotions.length > 0) {
        let promotion: any = null
        if (input.selected_promotion_ids && input.selected_promotion_ids.length > 0) {
          promotion = promotions.find((p: any) => input.selected_promotion_ids!.includes(p.id))
        }
        if (!promotion) {
          promotion = promotions[0]
        }

        if (promotion) {
          let discount = 0
          let detail = ''
          if (promotion.type === 'full_reduce') {
            discount = Number(promotion.discount_amount)
            detail = `满${promotion.min_amount}减${promotion.discount_amount}`
          } else if (promotion.type === 'discount') {
            discount = Number((current_amount * (1 - promotion.discount_amount / 10)).toFixed(2))
            detail = `${promotion.discount_amount}折优惠`
          }

          if (discount > 0) {
            current_amount = Number((current_amount - discount).toFixed(2))
            total_discount += discount
            applied_promotions.push(promotion)
            steps.push({
              rule: 'promotion',
              rule_name: '满减活动',
              before_amount,
              discount_amount: Number(discount.toFixed(2)),
              after_amount: Number(current_amount.toFixed(2)),
              detail: `${promotion.name}：${detail}`
            })
          }
        }
      }
    } else if (rule === 'coupon') {
      if (input.coupon_id) {
        const coupons = getCourierAvailableCoupons(input.courier_id, total_before) as any[]
        const coupon = coupons.find((c: any) => c.id === input.coupon_id)
        if (coupon) {
          let discount = 0
          let detail = ''
          if (coupon.type === 'fixed') {
            discount = Number(coupon.value)
            detail = `立减${coupon.value}元`
          } else if (coupon.type === 'discount') {
            discount = Number((current_amount * (1 - coupon.value / 10)).toFixed(2))
            detail = `${coupon.value}折优惠券`
          } else if (coupon.type === 'overdue_reduce') {
            discount = Math.min(input.overdue_amount, Number(coupon.value))
            detail = `滞留费减免${coupon.value}元`
          }

          if (discount > 0) {
            current_amount = Number((current_amount - discount).toFixed(2))
            total_discount += discount
            applied_coupon = coupon
            steps.push({
              rule: 'coupon',
              rule_name: '优惠券',
              before_amount,
              discount_amount: Number(discount.toFixed(2)),
              after_amount: Number(current_amount.toFixed(2)),
              detail: `${coupon.name}：${detail}`
            })
          }
        }
      }
    } else if (rule === 'quota') {
      if (input.use_quota && input.base_amount > 0) {
        const result = consumeQuota(input.courier_id, 1)
        if (result.used_quota) {
          use_quota = true
          quota_used = 1
          const quotaDiscount = Math.min(input.base_amount, current_amount)
          if (quotaDiscount > 0) {
            current_amount = Number((current_amount - quotaDiscount).toFixed(2))
            total_discount += quotaDiscount
            steps.push({
              rule: 'quota',
              rule_name: '免费额度',
              before_amount,
              discount_amount: Number(quotaDiscount.toFixed(2)),
              after_amount: Number(current_amount.toFixed(2)),
              detail: '使用免费投放额度'
            })
          }
        }
      }
    }
  }

  if (current_amount < 0) {
    total_discount += current_amount
    current_amount = 0
    negative_protected = true
    steps.push({
      rule: 'negative_protection',
      rule_name: '负值兜底',
      before_amount: Number((current_amount + Math.abs(current_amount)).toFixed(2)),
      discount_amount: Number(Math.abs(current_amount).toFixed(2)),
      after_amount: 0,
      detail: '优惠叠加后金额不能为负，已兜底至0元'
    })
  }

  return {
    base_amount: Number(input.base_amount.toFixed(2)),
    overdue_amount: Number(input.overdue_amount.toFixed(2)),
    total_before: Number(total_before.toFixed(2)),
    discount_amount: Number(total_discount.toFixed(2)),
    final_amount: Number(current_amount.toFixed(2)),
    use_quota,
    quota_used,
    steps,
    applied_coupon,
    applied_promotions,
    negative_protected
  }
}
