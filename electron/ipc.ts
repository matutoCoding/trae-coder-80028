import { ipcMain } from 'electron'
import * as courierService from './services/deliveryService'
import * as quotaService from './services/quotaService'
import * as discountService from './services/discountService'
import * as couponService from './services/couponService'
import * as billService from './services/billService'
import * as deliveryService from './services/deliveryService'

export function registerIpcHandlers() {
  ipcMain.handle('courier:list', () => courierService.listCouriers())
  ipcMain.handle('courier:create', (_e, data) => courierService.createCourier(data))
  ipcMain.handle('courier:update', (_e, id, data) => courierService.updateCourier(id, data))
  ipcMain.handle('courier:delete', (_e, id) => courierService.deleteCourier(id))

  ipcMain.handle('quota:getCurrent', (_e, courierId) => quotaService.getCurrentMonthQuota(courierId))
  ipcMain.handle('quota:listHistory', (_e, courierId) => quotaService.listQuotaHistory(courierId))
  ipcMain.handle('quota:grant', (_e, data) => quotaService.grantQuota(data))
  ipcMain.handle('quota:resetMonthly', () => quotaService.resetMonthlyQuotas())
  ipcMain.handle('quota:getConfig', () => quotaService.getQuotaConfig())
  ipcMain.handle('quota:updateConfig', (_e, data) => quotaService.updateQuotaConfig(data))
  ipcMain.handle('quota:overview', () => quotaService.getQuotaOverview())

  ipcMain.handle('delivery:list', (_e, params) => deliveryService.listDeliveries(params))
  ipcMain.handle('delivery:create', (_e, data) => deliveryService.createDelivery(data))
  ipcMain.handle('delivery:preview', (_e, data) => deliveryService.previewDelivery(data))
  ipcMain.handle('delivery:pickup', (_e, pickupCode, couponId) => deliveryService.pickupDelivery(pickupCode, couponId))
  ipcMain.handle('delivery:previewPickup', (_e, pickupCode, couponId) => deliveryService.previewPickupDiscount(pickupCode, couponId))
  ipcMain.handle('delivery:getDetail', (_e, id) => deliveryService.getDeliveryDetail(id))

  ipcMain.handle('coupon:list', (_e, params) => couponService.listCoupons(params))
  ipcMain.handle('coupon:create', (_e, data) => couponService.createCoupon(data))
  ipcMain.handle('coupon:update', (_e, id, data) => couponService.updateCoupon(id, data))
  ipcMain.handle('coupon:delete', (_e, id) => couponService.deleteCoupon(id))
  ipcMain.handle('coupon:grantToCourier', (_e, data) => couponService.grantCouponToCourier(data))
  ipcMain.handle('coupon:listCourierCoupons', (_e, courierId) => couponService.listCourierCoupons(courierId))

  ipcMain.handle('discount:calculate', (_e, data) => discountService.calculateDiscount(data))
  ipcMain.handle('discount:getRuleOrder', () => discountService.getDiscountRuleOrder())
  ipcMain.handle('discount:updateRuleOrder', (_e, order) => discountService.updateDiscountRuleOrder(order))
  ipcMain.handle('discount:getPromotions', () => discountService.listPromotions())
  ipcMain.handle('discount:createPromotion', (_e, data) => discountService.createPromotion(data))
  ipcMain.handle('discount:updatePromotion', (_e, id, data) => discountService.updatePromotion(id, data))
  ipcMain.handle('discount:deletePromotion', (_e, id) => discountService.deletePromotion(id))

  ipcMain.handle('bill:list', (_e, params) => billService.listBills(params))
  ipcMain.handle('bill:getDetail', (_e, id) => billService.getBillDetail(id))
  ipcMain.handle('bill:generateMonthly', (_e, yearMonth) => billService.generateMonthlyBill(yearMonth))
  ipcMain.handle('bill:exportExcel', (_e, billId) => billService.exportBillToExcel(billId))

  ipcMain.handle('stats:overview', () => billService.getOverviewStats())
}
