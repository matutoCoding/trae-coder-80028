import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  courier: {
    list: () => ipcRenderer.invoke('courier:list'),
    create: (data: any) => ipcRenderer.invoke('courier:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('courier:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('courier:delete', id)
  },
  quota: {
    getCurrent: (courierId: number) => ipcRenderer.invoke('quota:getCurrent', courierId),
    listHistory: (courierId: number) => ipcRenderer.invoke('quota:listHistory', courierId),
    grant: (data: any) => ipcRenderer.invoke('quota:grant', data),
    resetMonthly: () => ipcRenderer.invoke('quota:resetMonthly'),
    getConfig: () => ipcRenderer.invoke('quota:getConfig'),
    updateConfig: (data: any) => ipcRenderer.invoke('quota:updateConfig', data)
  },
  delivery: {
    list: (params: any) => ipcRenderer.invoke('delivery:list', params),
    create: (data: any) => ipcRenderer.invoke('delivery:create', data),
    pickup: (pickupCode: string) => ipcRenderer.invoke('delivery:pickup', pickupCode),
    getDetail: (id: number) => ipcRenderer.invoke('delivery:getDetail', id)
  },
  coupon: {
    list: (params: any) => ipcRenderer.invoke('coupon:list', params),
    create: (data: any) => ipcRenderer.invoke('coupon:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('coupon:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('coupon:delete', id),
    grantToCourier: (data: any) => ipcRenderer.invoke('coupon:grantToCourier', data),
    listCourierCoupons: (courierId: number) => ipcRenderer.invoke('coupon:listCourierCoupons', courierId)
  },
  discount: {
    calculate: (data: any) => ipcRenderer.invoke('discount:calculate', data),
    getRuleOrder: () => ipcRenderer.invoke('discount:getRuleOrder'),
    updateRuleOrder: (order: string[]) => ipcRenderer.invoke('discount:updateRuleOrder', order),
    getPromotions: () => ipcRenderer.invoke('discount:getPromotions'),
    createPromotion: (data: any) => ipcRenderer.invoke('discount:createPromotion', data),
    updatePromotion: (id: number, data: any) => ipcRenderer.invoke('discount:updatePromotion', id, data),
    deletePromotion: (id: number) => ipcRenderer.invoke('discount:deletePromotion', id)
  },
  bill: {
    list: (params: any) => ipcRenderer.invoke('bill:list', params),
    getDetail: (id: number) => ipcRenderer.invoke('bill:getDetail', id),
    generateMonthly: (yearMonth: string) => ipcRenderer.invoke('bill:generateMonthly', yearMonth),
    exportExcel: (billId: number) => ipcRenderer.invoke('bill:exportExcel', billId)
  },
  stats: {
    overview: () => ipcRenderer.invoke('stats:overview')
  }
})
