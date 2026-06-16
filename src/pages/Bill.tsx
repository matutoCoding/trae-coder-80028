import { useEffect, useState } from 'react'
import {
  Table, Button, Modal, Form, Select, Card, Row, Col, Statistic,
  Tag, Descriptions, Divider, message, Drawer, List
} from 'antd'
import {
  PlusOutlined, FileExcelOutlined, EyeOutlined,
  DownloadOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'

const { Option } = Select

export default function BillPage() {
  const [bills, setBills] = useState<any[]>([])
  const [couriers, setCouriers] = useState<any[]>([])
  const [generateVisible, setGenerateVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [detail, setDetail] = useState<any>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [b, c] = await Promise.all([
      window.api.bill.list(),
      window.api.courier.list()
    ])
    setBills(b)
    setCouriers(c)
  }

  const handleGenerate = async (values: any) => {
    const month = values.month.format('YYYY-MM')
    Modal.confirm({
      title: `确认生成 ${month} 月账单？`,
      content: '将统计该月所有快递员的投递记录生成账单，已存在的账单会被重新覆盖。',
      onOk: async () => {
        const r = await window.api.bill.generateMonthly(month)
        message.success(`已生成 ${r.details.length} 位快递员账单`)
        setGenerateVisible(false)
        form.resetFields()
        loadData()
      }
    })
  }

  const showDetail = async (id: number) => {
    const d = await window.api.bill.getDetail(id)
    setDetail(d)
    setDetailVisible(true)
  }

  const handleExport = async (id: number) => {
    try {
      const r = await window.api.bill.exportExcel(id)
      message.success(`导出成功：${r.file_path}`)
    } catch (e: any) {
      message.error('导出失败：' + e.message)
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '账单月份', dataIndex: 'month', width: 100 },
    { title: '快递员', dataIndex: 'courier_name' },
    { title: '手机号', dataIndex: 'courier_phone', width: 120 },
    {
      title: '投递统计', width: 180,
      render: (_: any, r: any) => (
        <div>
          <div>总投递：<b>{r.total_deliveries}</b> 次</div>
          <div>免费：<Tag color="green">{r.quota_deliveries}</Tag> · 付费：<Tag color="orange">{r.paid_deliveries}</Tag></div>
        </div>
      )
    },
    {
      title: '费用明细', width: 200,
      render: (_: any, r: any) => (
        <div>
          <div>投递费：¥{r.delivery_fee}</div>
          <div style={{ color: '#ff4d4f' }}>滞留费：¥{r.overdue_fee}</div>
          <div style={{ color: '#52c41a' }}>优惠抵扣：-¥{r.discount_amount}</div>
          <Divider style={{ margin: '4px 0' }} />
          <div style={{ fontWeight: 'bold', color: '#ff4d4f' }}>实付：¥{r.final_amount}</div>
        </div>
      )
    },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (s: string) => s === 'paid' ? <Tag color="green">已支付</Tag> : <Tag color="orange">待支付</Tag>
    },
    { title: '生成时间', dataIndex: 'generated_at', width: 160 },
    {
      title: '操作', width: 160,
      render: (_: any, r: any) => (
        <div>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => showDetail(r.id)}>详情</Button>
          <Button type="link" size="small" icon={<FileExcelOutlined />} onClick={() => handleExport(r.id)}>导出</Button>
        </div>
      )
    }
  ]

  return (
    <div>
      <div className="page-header">
        <div className="page-title">账单管理</div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setGenerateVisible(true)}>
          生成月度账单
        </Button>
      </div>

      {bills.length > 0 && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card size="small">
              <Statistic title="账单总数" value={bills.length} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="投递费合计"
                value={bills.reduce((s, b) => s + Number(b.delivery_fee || 0), 0).toFixed(2)}
                precision={2}
                prefix="¥"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="滞留费合计"
                value={bills.reduce((s, b) => s + Number(b.overdue_fee || 0), 0).toFixed(2)}
                precision={2}
                prefix="¥"
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="实付总额"
                value={bills.reduce((s, b) => s + Number(b.final_amount || 0), 0).toFixed(2)}
                precision={2}
                prefix="¥"
                valueStyle={{ color: '#722ed1', fontWeight: 'bold' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card>
        <Table
          columns={columns}
          dataSource={bills}
          rowKey="id"
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      <Modal
        title="生成月度账单"
        open={generateVisible}
        onCancel={() => setGenerateVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleGenerate}>
          <Form.Item name="month" label="选择月份" rules={[{ required: true }]}>
            <Select style={{ width: '100%' }} placeholder="请选择月份">
              {[0, 1, 2, 3].map(i => {
                const m = dayjs().subtract(i, 'month')
                return <Option key={i} value={m}>{m.format('YYYY年MM月')}</Option>
              })}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="账单详情"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={600}
        extra={
          detail && <Button icon={<DownloadOutlined />} onClick={() => handleExport(detail.id)}>导出Excel</Button>
        }
      >
        {detail && (
          <div>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="快递员">{detail.courier_name}</Descriptions.Item>
              <Descriptions.Item label="手机号">{detail.courier_phone}</Descriptions.Item>
              <Descriptions.Item label="账单月份">{detail.month}</Descriptions.Item>
              <Descriptions.Item label="状态">
                {detail.status === 'paid' ? <Tag color="green">已支付</Tag> : <Tag color="orange">待支付</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="总投递">{detail.total_deliveries} 次</Descriptions.Item>
              <Descriptions.Item label="生成时间">{detail.generated_at}</Descriptions.Item>
            </Descriptions>

            <Divider />

            <Descriptions bordered column={2} size="small" title="费用汇总">
              <Descriptions.Item label="投递费" labelStyle={{ fontWeight: 'bold' }}>¥{detail.delivery_fee}</Descriptions.Item>
              <Descriptions.Item label="滞留费" labelStyle={{ fontWeight: 'bold' }}>¥{detail.overdue_fee}</Descriptions.Item>
              <Descriptions.Item label="总金额">¥{detail.total_fee}</Descriptions.Item>
              <Descriptions.Item label="优惠抵扣" style={{ color: '#52c41a' }}>-¥{detail.discount_amount}</Descriptions.Item>
              <Descriptions.Item label="应付金额" span={2} labelStyle={{ fontWeight: 'bold' }}>
                <span style={{ color: '#ff4d4f', fontSize: 20, fontWeight: 'bold' }}>¥{detail.final_amount}</span>
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">消费明细</Divider>

            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={detail.items || []}
              columns={[
                { title: '类型', dataIndex: 'type', width: 80, render: (t: string) => t === 'delivery' ? '投递' : t === 'overdue' ? '滞留' : '优惠' },
                { title: '金额', dataIndex: 'amount', width: 80, render: (v: number) => <span style={{ color: v < 0 ? '#52c41a' : '#000' }}>¥{v}</span> },
                { title: '取件码', dataIndex: 'pickup_code', width: 80 },
                { title: '备注', dataIndex: 'remark' },
                { title: '投递时间', dataIndex: 'stored_at', width: 150 }
              ]}
            />
          </div>
        )}
      </Drawer>
    </div>
  )
}
