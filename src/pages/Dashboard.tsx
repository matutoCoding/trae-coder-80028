import { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, List, Tag } from 'antd'
import {
  UserOutlined,
  InboxOutlined,
  ClockCircleOutlined,
  DollarOutlined
} from '@ant-design/icons'

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [recentDeliveries, setRecentDeliveries] = useState<any[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const s = await window.api.stats.overview()
    setStats(s)
    const list = await window.api.delivery.list()
    setRecentDeliveries(list.slice(0, 8))
  }

  const statusMap: Record<string, { color: string; text: string }> = {
    stored: { color: 'blue', text: '待取件' },
    picked: { color: 'green', text: '已取件' }
  }

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="快递员总数"
              value={stats?.total_couriers || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="本月投递量"
              value={stats?.total_deliveries || 0}
              prefix={<InboxOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待取件包裹"
              value={stats?.pending_pickups || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="本月营收(元)"
              value={stats?.total_revenue || 0}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="额度使用概览" size="small">
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 48, color: '#1677ff', fontWeight: 'bold' }}>
                {stats?.quota_used || 0}
              </div>
              <div style={{ color: '#999', fontSize: 14 }}>
                / {stats?.quota_total || 0} 次免费额度已使用
              </div>
              <div style={{ marginTop: 16, background: '#f0f0f0', borderRadius: 10, height: 12, width: '80%', margin: '16px auto', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, #1677ff, #69b1ff)',
                  width: `${stats?.quota_total ? ((stats.quota_used / stats.quota_total) * 100) : 0}%`,
                  borderRadius: 10
                }} />
              </div>
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="最近投递记录" size="small">
            <List
              dataSource={recentDeliveries}
              renderItem={(item: any) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <span>{item.courier_name} - {item.locker_no}</span>
                        <Tag color={statusMap[item.status]?.color}>
                          {statusMap[item.status]?.text}
                        </Tag>
                      </div>
                    }
                    description={
                      <div>
                        <span>取件码: <b>{item.pickup_code}</b></span>
                        <span style={{ marginLeft: 20, color: '#999' }}>{item.created_at}</span>
                        <span style={{ marginLeft: 20, color: '#52c41a' }}>¥{item.final_amount}</span>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
