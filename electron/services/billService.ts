import { getDb } from '../database'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

export function listBills(params: any = {}) {
  const db = getDb()
  let sql = `
    SELECT b.*, c.name as courier_name, c.phone as courier_phone
    FROM bills b
    LEFT JOIN couriers c ON b.courier_id = c.id
    WHERE 1=1
  `
  const args: any[] = []

  if (params.courier_id) {
    sql += ' AND b.courier_id = ?'
    args.push(params.courier_id)
  }
  if (params.month) {
    sql += ' AND b.month = ?'
    args.push(params.month)
  }
  sql += ' ORDER BY b.month DESC, b.courier_id'

  return db.prepare(sql).all(...args)
}

export function getBillDetail(id: number) {
  const db = getDb()
  const bill = db.prepare(`
    SELECT b.*, c.name as courier_name, c.phone as courier_phone
    FROM bills b
    LEFT JOIN couriers c ON b.courier_id = c.id
    WHERE b.id = ?
  `).get(id) as any

  if (bill) {
    bill.items = db.prepare(`
      SELECT bi.*, d.pickup_code, d.locker_no, d.stored_at, d.picked_at
      FROM bill_items bi
      LEFT JOIN deliveries d ON bi.delivery_id = d.id
      WHERE bi.bill_id = ?
      ORDER BY bi.id
    `).all(id)
  }
  return bill
}

export function generateMonthlyBill(yearMonth: string) {
  const db = getDb()
  const couriers = db.prepare('SELECT id FROM couriers WHERE status = 1').all() as any[]
  const results: any[] = []

  const startDate = `${yearMonth}-01 00:00:00`
  const endDate = dayjs(yearMonth + '-01').endOf('month').format('YYYY-MM-DD HH:mm:ss')

  const tx = db.transaction(() => {
    for (const courier of couriers) {
      const existing = db.prepare('SELECT id FROM bills WHERE courier_id = ? AND month = ?').get(courier.id, yearMonth)
      if (existing) {
        db.prepare('DELETE FROM bill_items WHERE bill_id = ?').run((existing as any).id)
        db.prepare('DELETE FROM bills WHERE id = ?').run((existing as any).id)
      }

      const deliveries = db.prepare(`
        SELECT * FROM deliveries
        WHERE courier_id = ?
          AND created_at >= ?
          AND created_at <= ?
      `).all(courier.id, startDate, endDate) as any[]

      let totalDeliveries = deliveries.length
      let quotaDeliveries = 0
      let paidDeliveries = 0
      let totalDeliveryFee = 0
      let totalOverdueFee = 0
      let totalFee = 0
      let totalDiscount = 0
      let finalAmount = 0

      const billResult = db.prepare(`
        INSERT INTO bills (courier_id, month, total_deliveries, quota_deliveries, paid_deliveries,
          delivery_fee, overdue_fee, total_fee, discount_amount, final_amount, status)
        VALUES (?, ?, 0, 0, 0, 0, 0, 0, 0, 0, 'unpaid')
      `).run(courier.id, yearMonth)

      const billId = billResult.lastInsertRowid

      for (const d of deliveries) {
        totalDeliveryFee += Number(d.delivery_fee || 0)
        totalOverdueFee += Number(d.overdue_fee || 0)
        totalFee += Number(d.total_fee || 0)
        totalDiscount += Number(d.discount_amount || 0)
        finalAmount += Number(d.final_amount || 0)

        if (d.use_quota) quotaDeliveries++
        else paidDeliveries++

        if (d.delivery_fee > 0) {
          db.prepare(`
            INSERT INTO bill_items (bill_id, delivery_id, type, amount, remark)
            VALUES (?, ?, 'delivery', ?, ?)
          `).run(billId, d.id, d.delivery_fee, `投递费-${d.locker_no}`)
        }
        if (d.overdue_fee > 0) {
          db.prepare(`
            INSERT INTO bill_items (bill_id, delivery_id, type, amount, remark)
            VALUES (?, ?, 'overdue', ?, ?)
          `).run(billId, d.id, d.overdue_fee, `滞留费-${d.overdue_hours}小时`)
        }
        if (d.discount_amount > 0) {
          db.prepare(`
            INSERT INTO bill_items (bill_id, delivery_id, type, amount, remark)
            VALUES (?, ?, 'discount', ?, ?)
          `).run(billId, d.id, -d.discount_amount, '优惠抵扣')
        }
      }

      db.prepare(`
        UPDATE bills SET
          total_deliveries = ?, quota_deliveries = ?, paid_deliveries = ?,
          delivery_fee = ?, overdue_fee = ?, total_fee = ?,
          discount_amount = ?, final_amount = ?, generated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(
        totalDeliveries, quotaDeliveries, paidDeliveries,
        Number(totalDeliveryFee.toFixed(2)),
        Number(totalOverdueFee.toFixed(2)),
        Number(totalFee.toFixed(2)),
        Number(totalDiscount.toFixed(2)),
        Number(finalAmount.toFixed(2)),
        billId
      )

      results.push({
        courier_id: courier.id,
        bill_id: billId,
        total_deliveries: totalDeliveries,
        final_amount: Number(finalAmount.toFixed(2))
      })
    }
  })

  tx()
  return { month: yearMonth, generated: results.length, details: results }
}

export function exportBillToExcel(billId: number) {
  const db = getDb()
  const bill = getBillDetail(billId)
  if (!bill) throw new Error('账单不存在')

  const headerData = [
    ['快递柜投放管理系统 - 月度账单'],
    [],
    ['账单月份', bill.month],
    ['快递员', bill.courier_name],
    ['联系电话', bill.courier_phone],
    ['生成时间', bill.generated_at],
    [],
    ['汇总信息'],
    ['总投递次数', bill.total_deliveries],
    ['免费额度投递', bill.quota_deliveries],
    ['付费投递', bill.paid_deliveries],
    ['投递费合计', bill.delivery_fee],
    ['滞留费合计', bill.overdue_fee],
    ['总金额', bill.total_fee],
    ['优惠抵扣', bill.discount_amount],
    ['应付金额', bill.final_amount],
    [],
    ['明细列表']
  ]

  const detailHeaders = ['类型', '金额', '备注', '取件码', '格口号', '投递时间', '取件时间']
  const detailRows = (bill.items || []).map((item: any) => [
    item.type === 'delivery' ? '投递费' : item.type === 'overdue' ? '滞留费' : '优惠',
    item.amount,
    item.remark,
    item.pickup_code,
    item.locker_no,
    item.stored_at,
    item.picked_at || ''
  ])

  const wsData = [...headerData, detailHeaders, ...detailRows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 20 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '账单明细')

  const exportDir = path.join(app.getPath('desktop'), '快递柜账单导出')
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true })
  }
  const fileName = `账单_${bill.courier_name}_${bill.month}.xlsx`
  const filePath = path.join(exportDir, fileName)
  XLSX.writeFile(wb, filePath)

  return { file_path: filePath, file_name: fileName }
}

export function getOverviewStats() {
  const db = getDb()
  const month = dayjs().format('YYYY-MM')

  const totalCouriers = db.prepare('SELECT COUNT(*) as cnt FROM couriers WHERE status = 1').get() as any
  const totalDeliveries = db.prepare("SELECT COUNT(*) as cnt FROM deliveries WHERE substr(created_at, 1, 7) = ?").get(month) as any
  const pendingPickups = db.prepare("SELECT COUNT(*) as cnt FROM deliveries WHERE status = 'stored'").get() as any
  const totalRevenue = db.prepare(`
    SELECT COALESCE(SUM(final_amount), 0) as total
    FROM deliveries
    WHERE substr(created_at, 1, 7) = ?
  `).get(month) as any

  const quotaUsage = db.prepare(`
    SELECT SUM(used_quota) as used, SUM(total_quota) as total
    FROM monthly_quotas WHERE month = ?
  `).get(month) as any

  return {
    month,
    total_couriers: totalCouriers.cnt,
    total_deliveries: totalDeliveries.cnt,
    pending_pickups: pendingPickups.cnt,
    total_revenue: Number(totalRevenue.total || 0).toFixed(2),
    quota_used: quotaUsage.used || 0,
    quota_total: quotaUsage.total || 0
  }
}
