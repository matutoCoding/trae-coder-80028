import { useEffect, useState } from 'react'
import {
  Table, Button, Modal, Form, Input, Select, DatePicker, InputNumber,
  Space, Tag, message, Card, Descriptions, Divider, Row, Col
} from 'antd'
import { PlusOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker
const { Option } = Select

export default function DeliveryPage() {
  const [list, setList] = useState<any[]>([])
  const [couriers, setCouriers] = useState<any[]>([])
  const [coupons, setCoupons] = useState<any[]>([])
  const [promotions, setPromotions] = useState<any[]>([])
  const [quotaConfig, setQuotaConfig] = useState<any>(null)
  const [currentQuota, setCurrentQuota] = useState<any>(null)
  const [calcResult, setCalcResult] = useState<any>(null)
  const [visible, setVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [detail, setDetail] = useState<any>(null)
  const [form] = Form.useForm()
  const [filters, setFilters] = useState<any>({})

  useEffect(() => {
    loadData()
    loadConfig()
  }, [])

  const loadData = async () => {
    const [l, c, p] = await Promise.all([
      window.api.delivery.list(filters),
      window.api.courier.list(),
      window.api.discount.getPromotions()
    ])
    setList(l)
    setCouriers(c)
    setPromotions(p)
  }

  const loadConfig = async () => {
    const cfg = await window.api.quota.getConfig()
    setQuotaConfig(cfg)
  }

  const loadCourierCoupons = async (courierId: number) => {
    const cps = await window.api.coupon.listCourierCoupons(courierId)
    setCoupons(cps.filter((c: any) => c.status === 'unused'))
  }

  const loadQuota = async (courierId: number) => {
    const q = await window.api.quota.getCurrent(courierId)
    setCurrentQuota(q)
  }

  const previewCalc = async (values: any) => {
    if (!values.courier_id) {
      message.warning('请先选择快递员')
      return
    }
    const result = await window.api.discount.calculate({
      courier_id: values.courier_id,
      base_amount: quotaConfig?.delivery_fee || 1,
      overdue_amount: 0,
      use_quota: values.use_quota,
      coupon_id: values.courier_coupon_id,
      selected_promotion_ids: values.promotion_ids
    })
    setCalcResult(result)
  }

  const handleSubmit = async (values: any) => {
    try {
      const result = await window.api.delivery.create(values)
      message.success(`投递成功！取件码：${result.pickup_code}`)
      setVisible(false)
      form.resetFields()
      setCalcResult(null)
      loadData()
    } catch (e: any) {
      message.error('创建失败：' + e.message)
    }
  }

  const handleSearch = (values: any) => {
    const params: any = {}
    if (values.courier_id) params.courier_id = values.courier_id
    if (values.status) params.status = values.status
    if (values.date && values.date.length === 2) {
      params.start_date = values.date[0].format('YYYY-MM-DD')
      params.end_date = values.date[1].format('YYYY-MM-DD')
    }
    if (values.keyword) params.keyword = values.keyword
    setFilters(params)
    loadData()
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '快递员', dataIndex: 'courier_name' },
    { title: '格口', dataIndex: 'locker_no', width: 80 },
    { title: '取件码', dataIndex: 'pickup_code', width: 100, render: (v: string) => <b style={{ color: '#1677ff' }}>{v}</b> },
    { title: '收件人', dataIndex: 'recipient_phone' },
    {
      title: '费用',
      width: 180,
      render: (_: any, r: any) => (
        <div>
          <div>投递费：¥{r.delivery_fee}</div>
          {r.overdue_fee > 0 && <div style={{ color: '#ff4d4f' }}>滞留费：¥{r.overdue_fee} ({r.overdue_hours}h)</div>}
          {r.discount_amount > 0 && <div style={{ color: '#52c41a' }}>优惠：-¥{r.discount_amount}</div>}
          <Divider style={{ margin: '4px 0' }} />
          <div style={{ fontWeight: 'bold' }}>实付：¥{r.final_amount}</div>
        </div>
      )
    },
    { title: '额度抵扣', dataIndex: 'use_quota', width: 80, render: (v: number) => v ? <Tag color="green">是</Tag> : <Tag>否</Tag> },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (s: string) => s === 'stored' ? <Tag color="blue">待取件</Tag> : <Tag color="green">已取件</Tag>
    },
    { title: '投递时间', dataIndex: 'created_at', width: 160 },
    { title: '取件时间', dataIndex: 'picked_at', width: 160 },
    {
      title: '操作',
      width: 80,
      render: (_: any, r: any) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => showDetail(r.id)}>详情</Button>
      )
    }
  ]

  const showDetail = async (id: number) => {
    const d = await window.api.delivery.getDetail(id)
    setDetail(d)
    setDetailVisible(true)
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">投放管理</div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setVisible(true)}>新建投递</Button>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Form layout="inline" onFinish={handleSearch}>
          <Form.Item name="courier_id" label="快递员">
            <Select placeholder="全部" allowClear style={{ width: 140 }}>
              {couriers.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select placeholder="全部" allowClear style={{ width: 120 }}>
              <Option value="stored">待取件</Option>
              <Option value="picked">已取件</Option>
            </Select>
          </Form.Item>
          <Form.Item name="date" label="时间">
            <RangePicker />
          </Form.Item>
          <Form.Item name="keyword">
            <Input placeholder="取件码/姓名/电话" allowClear style={{ width: 180 }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>查询</Button>
              <Button onClick={() => { setFilters({}); loadData() }}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Table
        columns={columns}
        dataSource={list}
        rowKey="id"
        pagination={{ pageSize: 10, showSizeChanger: true }}
      />

      <Modal
        title="新建投递"
        open={visible}
        width={600}
        onCancel={() => { setVisible(false); setCalcResult(null) }}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          onValuesChange={(changed, all) => {
            if (changed.courier_id) {
              loadCourierCoupons(changed.courier_id)
              loadQuota(changed.courier_id)
              previewCalc(all)
            }
            if (changed.use_quota !== undefined || changed.courier_coupon_id || changed.promotion_ids) {
              previewCalc(all)
            }
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="courier_id" label="快递员" rules={[{ required: true }]}>
                <Select placeholder="请选择">
                  {couriers.map(c => <Option key={c.id} value={c.id}>{c.name} ({c.phone})</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="locker_no" label="格口号" initialValue="A01" rules={[{ required: true }]}>
                <Input placeholder="如：A01" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="recipient_phone" label="收件人电话">
                <Input placeholder="选填" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="size" label="包裹大小" initialValue="medium">
                <Select>
                  <Option value="small">小号</Option>
                  <Option value="medium">中号</Option>
                  <Option value="large">大号</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {currentQuota && (
            <Card size="small" style={{ marginBottom: 12 }}>
              <Space>
                <span>当月额度：</span>
                <Tag color="green">剩余 {currentQuota.remaining_quota}/{currentQuota.total_quota}</Tag>
              </Space>
            </Card>
          )}

          <Divider>优惠选择</Divider>

          <Form.Item name="use_quota" label="使用免费额度" valuePropName="checked">
            <Select style={{ width: 120 }}>
              <Option value={false}>不使用</Option>
              <Option value={true}>使用（抵扣投递费）</Option>
            </Select>
          </Form.Item>

          <Form.Item name="promotion_ids" label="满减活动">
            <Select mode="multiple" placeholder="可选">
              {promotions.map(p => (
                <Option key={p.id} value={p.id}>{p.name}（满{p.min_amount}减{p.discount_amount}）</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="courier_coupon_id" label="优惠券">
            <Select placeholder="可选" allowClear>
              {coupons.map(c => (
                <Option key={c.id} value={c.id}>
                  {c.name} - {c.type === 'fixed' ? `立减${c.value}元` : c.type === 'discount' ? `${c.value}折` : `免滞留${c.value}元`}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {calcResult && (
            <Card size="small" style={{ background: '#f6ffed', marginBottom: 16 }}>
              <Descriptions column={1} size="small" title="费用计算预览">
                <Descriptions.Item label="投递费">¥{calcResult.base_amount}</Descriptions.Item>
                <Descriptions.Item label="优惠合计">-¥{calcResult.discount_amount}</Descriptions.Item>
                {calcResult.steps?.map((s: any, i: number) => (
                  <Descriptions.Item key={i} label={s.rule_name}>{s.detail}（-¥{s.discount_amount}）</Descriptions.Item>
                ))}
                <Descriptions.Item label="实付金额" labelStyle={{ fontWeight: 'bold' }}>
                  <span style={{ fontSize: 20, color: '#ff4d4f', fontWeight: 'bold' }}>¥{calcResult.final_amount}</span>
                  {calcResult.negative_protected && <Tag color="red">负值兜底</Tag>}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => { setVisible(false); setCalcResult(null) }}>取消</Button>
              <Button type="primary" htmlType="submit">确认投递</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="投递详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[<Button key="ok" onClick={() => setDetailVisible(false)}>关闭</Button>]}
      >
        {detail && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="快递员">{detail.courier_name}</Descriptions.Item>
            <Descriptions.Item label="联系电话">{detail.courier_phone}</Descriptions.Item>
            <Descriptions.Item label="格口号">{detail.locker_no}</Descriptions.Item>
            <Descriptions.Item label="取件码">{detail.pickup_code}</Descriptions.Item>
            <Descriptions.Item label="收件人">{detail.recipient_phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="包裹大小">{detail.size}</Descriptions.Item>
            <Descriptions.Item label="投递时间" span={2}>{detail.created_at}</Descriptions.Item>
            <Descriptions.Item label="取件时间" span={2}>{detail.picked_at || '待取件'}</Descriptions.Item>
            <Descriptions.Item label="投递费">¥{detail.delivery_fee}</Descriptions.Item>
            <Descriptions.Item label="滞留费">¥{detail.overdue_fee}（{detail.overdue_hours}小时）</Descriptions.Item>
            <Descriptions.Item label="优惠金额">-¥{detail.discount_amount}</Descriptions.Item>
            <Descriptions.Item label="实付金额">¥{detail.final_amount}</Descriptions.Item>
            {detail.discount_detail_parsed?.steps && (
              <Descriptions.Item label="优惠明细" span={2}>
                {detail.discount_detail_parsed.steps.map((s: any, i: number) => (
                  <div key={i} className={`discount-step step-${s.rule}`}>
                    <b>{s.rule_name}：</b>{s.detail} - ¥{s.discount_amount}
                  </div>
                ))}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}

