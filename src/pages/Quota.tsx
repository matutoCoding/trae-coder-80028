import { useEffect, useState } from 'react'
import {
  Table, Button, Modal, Form, Input, InputNumber, Select,
  Card, Row, Col, Statistic, Tag, Divider, message, Drawer, List
} from 'antd'
import {
  PlusOutlined, SyncOutlined, SettingOutlined, HistoryOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'

const { Option } = Select

export default function QuotaPage() {
  const [couriers, setCouriers] = useState<any[]>([])
  const [overview, setOverview] = useState<any[]>([])
  const [config, setConfig] = useState<any>(null)
  const [grantVisible, setGrantVisible] = useState(false)
  const [configVisible, setConfigVisible] = useState(false)
  const [historyVisible, setHistoryVisible] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [currentCourier, setCurrentCourier] = useState<any>(null)
  const [grantForm] = Form.useForm()
  const [configForm] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [c, cfg, qv] = await Promise.all([
      window.api.courier.list(),
      window.api.quota.getConfig(),
      window.api.stats.overview()
    ])
    setCouriers(c)
    setConfig(cfg)
    const ov: any[] = []
    for (const courier of c) {
      const quota = await window.api.quota.getCurrent(courier.id)
      ov.push({ ...courier, quota })
    }
    setOverview(ov)
  }

  const showHistory = async (courier: any) => {
    setCurrentCourier(courier)
    const h = await window.api.quota.listHistory(courier.id)
    setHistory(h)
    setHistoryVisible(true)
  }

  const handleGrant = async (values: any) => {
    await window.api.quota.grant(values)
    message.success('额度发放成功')
    setGrantVisible(false)
    grantForm.resetFields()
    loadData()
  }

  const handleResetMonthly = async () => {
    Modal.confirm({
      title: '确认重置本月额度？',
      content: '将为所有快递员初始化本月免费额度（已存在额度的快递员不受影响）。额度不累加，每月重置。',
      onOk: async () => {
        const r = await window.api.quota.resetMonthly()
        message.success(`已处理 ${r.total} 位快递员`)
        loadData()
      }
    })
  }

  const handleUpdateConfig = async (values: any) => {
    await window.api.quota.updateConfig(values)
    message.success('配置更新成功')
    setConfigVisible(false)
    loadData()
  }

  const typeMap: Record<string, { color: string; text: string }> = {
    grant: { color: 'blue', text: '月度发放' },
    manual_grant: { color: 'purple', text: '手动发放' },
    consume: { color: 'orange', text: '投递消费' }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '姓名', dataIndex: 'name' },
    { title: '手机号', dataIndex: 'phone' },
    { title: '所属公司', dataIndex: 'company' },
    {
      title: '本月额度',
      width: 200,
      render: (_: any, r: any) => {
        const used = r.quota?.used_quota || 0
        const total = r.quota?.total_quota || 0
        const remaining = r.quota?.remaining_quota || 0
        const pct = total > 0 ? (used / total * 100) : 0
        return (
          <div>
            <div style={{ marginBottom: 4 }}>
              已用 <b>{used}</b> / {total}
              <Tag color={remaining > 10 ? 'green' : remaining > 0 ? 'orange' : 'red'} style={{ marginLeft: 8 }}>
                剩余 {remaining}
              </Tag>
            </div>
            <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${pct}%`,
                height: '100%',
                background: pct > 90 ? '#ff4d4f' : pct > 70 ? '#faad14' : '#52c41a'
              }} />
            </div>
          </div>
        )
      }
    },
    {
      title: '操作',
      width: 160,
      render: (_: any, r: any) => (
        <div>
          <Button type="link" size="small" onClick={() => { setCurrentCourier(r); grantForm.setFieldsValue({ courier_id: r.id }); setGrantVisible(true) }}>发放额度</Button>
          <Button type="link" size="small" onClick={() => showHistory(r)} icon={<HistoryOutlined />}>记录</Button>
        </div>
      )
    }
  ]

  return (
    <div>
      <div className="page-header">
        <div className="page-title">额度管控</div>
        <div>
          <Button icon={<SyncOutlined />} onClick={handleResetMonthly} style={{ marginRight: 8 }}>
            重置本月额度
          </Button>
          <Button icon={<SettingOutlined />} onClick={() => { configForm.setFieldsValue(config); setConfigVisible(true) }}>
            额度配置
          </Button>
        </div>
      </div>

      {config && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic title="月度免费额度" value={config.monthly_free_quota} suffix="次" />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="单次投递费" value={config.delivery_fee} precision={2} prefix="¥" />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="免费存放时长" value={config.free_hours} suffix="小时" />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="超时滞留费率" value={config.overdue_fee_per_hour} precision={2} prefix="¥/" suffix="小时" />
            </Card>
          </Col>
        </Row>
      )}

      <Card>
        <Table
          columns={columns}
          dataSource={overview}
          rowKey="id"
          pagination={false}
        />
      </Card>

      <Modal
        title="手动发放额度"
        open={grantVisible}
        onCancel={() => setGrantVisible(false)}
        onOk={() => grantForm.submit()}
      >
        <Form form={grantForm} layout="vertical" onFinish={handleGrant}>
          <Form.Item name="courier_id" label="快递员" rules={[{ required: true }]}>
            <Select placeholder="请选择">
              {couriers.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="amount" label="发放数量" rules={[{ required: true }]}>
            <InputNumber min={1} max={1000} style={{ width: '100%' }} placeholder="请输入发放次数" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="选填，发放原因" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="额度配置"
        open={configVisible}
        onCancel={() => setConfigVisible(false)}
        onOk={() => configForm.submit()}
        width={500}
      >
        <Form form={configForm} layout="vertical" onFinish={handleUpdateConfig}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="monthly_free_quota" label="月度免费额度(次)" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="delivery_fee" label="单次投递费(元)" rules={[{ required: true }]}>
                <InputNumber min={0} step={0.1} precision={2} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="free_hours" label="免费存放(小时)" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="overdue_fee_per_hour" label="滞留费(元/小时)" rules={[{ required: true }]}>
                <InputNumber min={0} step={0.1} precision={2} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Divider />
          <p style={{ color: '#999', fontSize: 12 }}>
            ⚠️ 修改后对新投递生效，每月初免费额度自动重置，不累加结转
          </p>
        </Form>
      </Modal>

      <Drawer
        title={`额度变动记录 - ${currentCourier?.name || ''}`}
        open={historyVisible}
        onClose={() => setHistoryVisible(false)}
        width={500}
      >
        <List
          dataSource={history}
          renderItem={(item: any) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Tag color={typeMap[item.type]?.color}>{typeMap[item.type]?.text}</Tag>
                    <span style={{ color: item.amount >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>
                      {item.amount >= 0 ? '+' : ''}{item.amount}
                    </span>
                  </div>
                }
                description={
                  <div>
                    <div>{item.remark || '-'}</div>
                    <div style={{ color: '#999', fontSize: 12 }}>
                      余额：{item.balance} · {item.created_at}
                    </div>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Drawer>
    </div>
  )
}
