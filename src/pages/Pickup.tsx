import { useState } from 'react'
import {
  Card, Input, Button, Descriptions, Tag, message, Select, Space,
  Alert, Divider, Result, Modal
} from 'antd'
import {
  QrcodeOutlined, CheckCircleFilled, CloseCircleFilled,
  GiftOutlined
} from '@ant-design/icons'

const { Option } = Select

export default function PickupPage() {
  const [pickupCode, setPickupCode] = useState('')
  const [previewData, setPreviewData] = useState<any>(null)
  const [selectedCoupon, setSelectedCoupon] = useState<number | undefined>(undefined)
  const [pickupResult, setPickupResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const queryPickup = async () => {
    if (!pickupCode || pickupCode.length !== 6) {
      message.warning('请输入6位取件码')
      return
    }
    setLoading(true)
    try {
      const result = await window.api.delivery.previewPickup(pickupCode)
      if (!result.success) {
        message.error(result.message)
        setPreviewData(null)
        setPickupResult(null)
      } else {
        setPreviewData(result)
        setPickupResult(null)
        setSelectedCoupon(undefined)
      }
    } catch (e: any) {
      message.error('查询失败：' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCouponChange = async (couponId: number | undefined) => {
    setSelectedCoupon(couponId)
    if (pickupCode) {
      const result = await window.api.delivery.previewPickup(pickupCode, couponId)
      if (result.success) {
        setPreviewData(result)
      }
    }
  }

  const handleConfirmPickup = async () => {
    if (!pickupCode || !previewData) return

    Modal.confirm({
      title: '确认取件',
      content: previewData.discount_result?.final_amount > 0
        ? `本次取件产生滞留费 ¥${previewData.overdue_info.overdue_fee}，使用优惠后实付 ¥${previewData.discount_result.final_amount}，确认核销？`
        : '确认取件核销？',
      okText: '确认取件',
      cancelText: '取消',
      onOk: async () => {
        try {
          const result = await window.api.delivery.pickup(pickupCode, selectedCoupon)
          if (result.success) {
            setPickupResult(result)
            setPreviewData(null)
            setPickupCode('')
            setSelectedCoupon(undefined)
            message.success('取件成功')
          } else {
            message.error(result.message)
          }
        } catch (e: any) {
          message.error('取件失败：' + e.message)
        }
      }
    })
  }

  const couponTypeLabel = (type: string, value: number) => {
    switch (type) {
      case 'fixed': return `立减¥${value}`
      case 'discount': return `${value}折`
      case 'overdue_reduce': return `免滞留¥${value}`
      default: return ''
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '20px auto' }}>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <QrcodeOutlined style={{ fontSize: 56, color: '#1677ff' }} />
          <h2 style={{ marginTop: 12 }}>包裹取件核销</h2>
          <p style={{ color: '#999' }}>输入6位取件码查询包裹并完成取件</p>
        </div>

        <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
          <Input
            size="large"
            placeholder="请输入6位取件码"
            value={pickupCode}
            onChange={e => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 6)
              setPickupCode(val)
              setPickupResult(null)
              if (val.length !== 6) {
                setPreviewData(null)
              }
            }}
            maxLength={6}
            style={{ textAlign: 'center', fontSize: 22, letterSpacing: 8, height: 52 }}
            onPressEnter={queryPickup}
          />
          <Button
            type="primary"
            size="large"
            onClick={queryPickup}
            loading={loading}
            style={{ height: 52, padding: '0 30px' }}
          >
            查询
          </Button>
        </Space.Compact>

        {previewData && previewData.success && (
          <div style={{ marginTop: 20 }}>
            <Alert
              message="包裹信息"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="快递员">
                {previewData.delivery?.courier_name || '未知'}
              </Descriptions.Item>
              <Descriptions.Item label="格口号">
                {previewData.delivery?.locker_no}
              </Descriptions.Item>
              <Descriptions.Item label="取件码">
                <b style={{ color: '#1677ff' }}>{previewData.delivery?.pickup_code}</b>
              </Descriptions.Item>
              <Descriptions.Item label="投递时间">
                {previewData.delivery?.stored_at}
              </Descriptions.Item>
              <Descriptions.Item label="收件人">
                {previewData.delivery?.recipient_phone || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="包裹大小">
                {previewData.delivery?.size === 'small' ? '小号' : previewData.delivery?.size === 'large' ? '大号' : '中号'}
              </Descriptions.Item>
            </Descriptions>

            {previewData.overdue_info?.overdue_fee > 0 && (
              <>
                <Card size="small" style={{ marginBottom: 16 }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#666' }}>超时时长</span>
                      <Tag color="orange">{previewData.overdue_info.overdue_hours} 小时</Tag>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#666' }}>滞留费（应收）</span>
                      <span style={{ color: '#ff4d4f', fontSize: 18, fontWeight: 'bold' }}>
                        ¥{previewData.overdue_info.overdue_fee}
                      </span>
                    </div>
                  </Space>
                </Card>

                <Card size="small" title={<span><GiftOutlined /> 选择优惠券</span>} style={{ marginBottom: 16 }}>
                  {previewData.available_coupons && previewData.available_coupons.length > 0 ? (
                    <div>
                      <Select
                        style={{ width: '100%' }}
                        placeholder="请选择优惠券（可选）"
                        allowClear
                        value={selectedCoupon}
                        onChange={handleCouponChange}
                        size="large"
                      >
                        {previewData.available_coupons.map((c: any) => (
                          <Option key={c.id} value={c.id}>
                            <Space>
                              <Tag color={c.type === 'overdue_reduce' ? 'orange' : 'purple'}>
                                {couponTypeLabel(c.type, c.value)}
                              </Tag>
                              <span>{c.name}</span>
                              <span style={{ color: '#999', fontSize: 12 }}>
                                满{c.min_amount}可用
                              </span>
                            </Space>
                          </Option>
                        ))}
                      </Select>

                      {previewData.discount_result && (
                        <div style={{ marginTop: 12, padding: 12, background: '#f6ffed', borderRadius: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span>滞留费</span>
                            <span>¥{previewData.discount_result.overdue_amount}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#52c41a' }}>
                            <span>优惠抵扣</span>
                            <span>-¥{previewData.discount_result.discount_amount}</span>
                          </div>
                          {previewData.discount_result.steps?.map((s: any, i: number) => (
                            <div key={i} style={{ fontSize: 12, color: '#666', paddingLeft: 12, marginBottom: 2 }}>
                              · {s.rule_name}：{s.detail}
                            </div>
                          ))}
                          <Divider style={{ margin: '8px 0' }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                            <span>实付金额</span>
                            <span style={{ color: '#ff4d4f', fontSize: 20 }}>
                              ¥{previewData.discount_result.final_amount}
                            </span>
                          </div>
                          {previewData.discount_result.negative_protected && (
                            <Tag color="red" style={{ marginTop: 6 }}>已执行负值兜底，最低0元</Tag>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: '#999', textAlign: 'center', padding: '20px 0' }}>
                      暂无可用优惠券
                    </div>
                  )}
                </Card>
              </>
            )}

            {previewData.overdue_info?.overdue_fee <= 0 && (
              <Alert
                message="在免费存放期内，无需支付滞留费"
                type="success"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            <Button
              type="primary"
              size="large"
              block
              style={{ height: 48, fontSize: 16 }}
              onClick={handleConfirmPickup}
            >
              确认取件
            </Button>
          </div>
        )}

        {pickupResult && pickupResult.success && (
          <div style={{ marginTop: 24 }}>
            <Result
              status="success"
              icon={<CheckCircleFilled style={{ color: '#52c41a' }} />}
              title="取件成功"
              subTitle="包裹已顺利取出"
            />

            {pickupResult.discount_result && pickupResult.overdue_info?.overdue_fee > 0 && (
              <Card size="small" style={{ marginTop: 16 }}>
                <Descriptions column={1} size="small" title="费用明细">
                  <Descriptions.Item label="超时时长">
                    {pickupResult.overdue_info.overdue_hours} 小时
                  </Descriptions.Item>
                  <Descriptions.Item label="滞留费">
                    ¥{pickupResult.discount_result.overdue_amount}
                  </Descriptions.Item>
                  <Descriptions.Item label="优惠抵扣">
                    <span style={{ color: '#52c41a' }}>-¥{pickupResult.discount_result.discount_amount}</span>
                  </Descriptions.Item>
                  {pickupResult.discount_result.steps?.map((s: any, i: number) => (
                    <Descriptions.Item key={i} label={s.rule_name}>
                      {s.detail}
                    </Descriptions.Item>
                  ))}
                  <Descriptions.Item label="实付金额" labelStyle={{ fontWeight: 'bold' }}>
                    <span style={{ color: '#ff4d4f', fontSize: 20, fontWeight: 'bold' }}>
                      ¥{pickupResult.discount_result.final_amount}
                    </span>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            )}
          </div>
        )}

        {pickupResult && !pickupResult.success && (
          <div style={{ marginTop: 24 }}>
            <Result
              status="error"
              icon={<CloseCircleFilled style={{ color: '#ff4d4f' }} />}
              title="取件失败"
              subTitle={pickupResult.message}
            />
          </div>
        )}

        <div style={{ marginTop: 24, background: '#fafafa', padding: 16, borderRadius: 8 }}>
          <h4 style={{ marginBottom: 12 }}>取件规则说明</h4>
          <ul style={{ color: '#666', lineHeight: 2, paddingLeft: 20 }}>
            <li>免费存放时长：24小时</li>
            <li>超过免费时长按每小时 ¥0.5 计收滞留费</li>
            <li>滞留费从快递员账户扣除</li>
            <li>可使用滞留券或通用优惠券抵扣滞留费</li>
            <li>优惠后金额最低为 0 元（负值兜底）</li>
            <li>取件码请妥善保管，丢失请联系快递员</li>
          </ul>
        </div>
      </Card>
    </div>
  )
}
