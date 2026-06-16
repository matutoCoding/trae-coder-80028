export {}

declare global {
  interface Window {
    api: {
      courier: {
        list: () => Promise<any[]>
        create: (data: any) => Promise<any>
        update: (id: number, data: any) => Promise<boolean>
        delete: (id: number) => Promise<boolean>
      }
      quota: {
        getCurrent: (courierId: number) => Promise<any>
        listHistory: (courierId: number) => Promise<any[]>
        grant: (data: any) => Promise<any>
        resetMonthly: () => Promise<any>
        getConfig: () => Promise<any>
        updateConfig: (data: any) => Promise<boolean>
      }
      delivery: {
        list: (params?: any) => Promise<any[]>
        create: (data: any) => Promise<any>
        preview: (data: any) => Promise<any>
        pickup: (pickupCode: string, couponId?: number) => Promise<any>
        previewPickup: (pickupCode: string, couponId?: number) => Promise<any>
        getDetail: (id: number) => Promise<any>
      }
      coupon: {
        list: (params?: any) => Promise<any[]>
        create: (data: any) => Promise<any>
        update: (id: number, data: any) => Promise<boolean>
        delete: (id: number) => Promise<boolean>
        grantToCourier: (data: any) => Promise<any[]>
        listCourierCoupons: (courierId: number) => Promise<any[]>
      }
      discount: {
        calculate: (data: any) => Promise<any>
        getRuleOrder: () => Promise<string[]>
        updateRuleOrder: (order: string[]) => Promise<boolean>
        getPromotions: () => Promise<any[]>
        createPromotion: (data: any) => Promise<any>
        updatePromotion: (id: number, data: any) => Promise<boolean>
        deletePromotion: (id: number) => Promise<boolean>
      }
      bill: {
        list: (params?: any) => Promise<any[]>
        getDetail: (id: number) => Promise<any>
        generateMonthly: (yearMonth: string) => Promise<any>
        exportExcel: (billId: number) => Promise<any>
      }
      stats: {
        overview: () => Promise<any>
      }
    }
  }
}
