import { useState } from 'react'
import { Card, Input, Button, Result, Descriptions, Tag, Divider, message } from 'antd'
import { QrcodeOutlined, CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons'

export default function PickupPage() {
  const [pickupCode, setPickupCode] = useState('')
  const [result, setResult] = useState<any>(null)

  const handlePickup = async () => {
    if (!pickupCode || pickupCode.length !== 6) {
      message.warning('请输入6位取件码')
      return
    }
    const r = await window.api.delivery.pickup(pickupCode)
    setResult(r)
    if (r.success) {
      message.success(r.message)
    } else {
      message.error(r.message)
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '40px auto' }}>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <QrcodeOutlined style={{ fontSize: 64, color: '#1677ff' }} />
          <h2 style={{ marginTop: 16 }}>包裹取件核销</h2>
          <p style={{ color: '#999' }}>请输入收件人提供的6位取件码</p>
        </div>

        <Input
          size="large"
          placeholder="请输入6位取件码"
          value={pickupCode}
          onChange={e => setPickupCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          maxLength={6}
          style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8, height: 56 }}
          onPressEnter={handlePickup}
        />

        <Button
          type="primary"
          size="large"
          block
          style={{ marginTop: 16, height: 48, fontSize: 16 }}
          onClick={handlePickup}
        >
          确认取件
        </Button>

        {result && (
          <div style={{ marginTop: 24 }}>
            <Divider />
            {result.success ? (
              <Result
                status="success"
                icon={<CheckCircleFilled style={{ color: '#52c41a' }} />}
                title="取件成功"
                subTitle={
                  result.overdue_info?.overdue_fee > 0
                    ? `本次取件产生滞留费 ¥${result.overdue_info.overdue_fee}（${result.overdue_info.overdue_hours}小时）`
                    : '包裹已顺利取出'
                }
              />
            ) : (
              <Result
                status="error"
                icon={<CloseCircleFilled style={{ color: '#ff4d4f' }} />}
                title="取件失败"
                subTitle={result.message}
              />
            )}
          </div>
        )}

        <div style={{ marginTop: 24, background: '#fafafa', padding: 16, borderRadius: 8 }}>
          <h4 style={{ marginBottom: 12 }}>取件规则说明</h4>
          <ul style={{ color: '#666', lineHeight: 2, paddingLeft: 20 }}>
            <li>免费存放时长：24小时</li>
            <li>超过免费时长按每小时 ¥0.5 计收滞留费</li>
            <li>滞留费从快递员账户扣除，可使用滞留券抵扣</li>
            <li>取件码请妥善保管，丢失请联系快递员</li>
          </ul>
        </div>
      </Card>
    </div>
  )
}
