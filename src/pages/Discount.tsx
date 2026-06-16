import { useEffect, useState } from 'react'
import {
  Card, Table, Button, Modal, Form, Input, InputNumber, Select,
  DatePicker, Space, Tag, message
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, HolderOutlined,
  ThunderboltOutlined, TagOutlined, FundOutlined, SafetyCertificateOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'

const { Option } = Select

const ruleLabels: Record<string, { label: string; icon: any; color: string }> = {
  promotion: { label: '满减活动', icon: <ThunderboltOutlined />, color: 'purple' },
  coupon: { label: '优惠券', icon: <TagOutlined />, color: 'orange' },
  quota: { label: '免费额度', icon: <FundOutlined />, color: 'green' },
  negative_protection: { label: '负值兜底', icon: <SafetyCertificateOutlined />, color: 'red' }
}

export default function DiscountPage() {
  const [promotions, setPromotions] = useState<any[]>([])
  const [ruleOrder, setRuleOrder] = useState<string[]>([])
  const [visible, setVisible] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [p, o] = await Promise.all([
      window.api.discount.getPromotions(),
      window.api.discount.getRuleOrder()
    ])
    setPromotions(p)
    setRuleOrder(o)
  }

  const handleSubmit = async (values: any) => {
    const data = {
      ...values,
      start_date: values.date_range?.[0]?.format('YYYY-MM-DD') || null,
      end_date: values.date_range?.[1]?.format('YYYY-MM-DD') || null
    }
    delete data.date_range

    if (editing) {
      await window.api.discount.updatePromotion(editing.id, data)
      message.success('更新成功')
    } else {
      await window.api.discount.createPromotion(data)
      message.success('创建成功')
    }
    setVisible(false)
    setEditing(null)
    form.resetFields()
    loadData()
  }

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: '确认删除？',
      onOk: async () => {
        await window.api.discount.deletePromotion(id)
        message.success('删除成功')
        loadData()
      }
    })
  }

  const moveRule = (index: number, direction: number) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= ruleOrder.length) return
    const newOrder = [...ruleOrder]
    ;[newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]]
    setRuleOrder(newOrder)
  }

  const saveRuleOrder = async () => {
    await window.api.discount.updateRuleOrder(ruleOrder)
    message.success('优惠顺序已保存')
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '活动名称', dataIndex: 'name' },
    {
      title: '类型', dataIndex: 'type', width: 100,
      render: (t: string) => <Tag color="purple">{t === 'full_reduce' ? '满减' : '折扣'}</Tag>
    },
    {
      title: '优惠内容', width: 160,
      render: (_: any, r: any) => (
        r.type === 'full_reduce'
          ? <span>满 <b>¥{r.min_amount}</b> 减 <b style={{ color: '#ff4d4f' }}>¥{r.discount_amount}</b></span>
          : <span>满 <b>¥{r.min_amount}</b> 享 <b style={{ color: '#ff4d4f' }}>{r.discount_amount}折</b></span>
      )
    },
    {
      title: '有效期', width: 220,
      render: (_: any, r: any) => (
        r.start_date || r.end_date ? `${r.start_date || '不限'} ~ ${r.end_date || '不限'}` : '永久有效'
      )
    },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (s: number) => s ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag>
    },
    {
      title: '操作', width: 150,
      render: (_: any, r: any) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => {
            setEditing(r)
            form.setFieldsValue({
              ...r,
              date_range: r.start_date && r.end_date ? [dayjs(r.start_date), dayjs(r.end_date)] : null
            })
            setVisible(true)
          }}>编辑</Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)}>删除</Button>
        </Space>
      )
    }
  ]

  return (
    <div>
      <div className="page-header">
        <div className="page-title">优惠规则</div>
      </div>

      <Card title="优惠计算顺序配置" style={{ marginBottom: 24 }} size="small">
        <p style={{ color: '#666', marginBottom: 16 }}>
          优惠计算顺序会影响最终实付金额。系统按配置顺序依次计算，优惠后金额不能为负（负值兜底校验自动执行）。
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {ruleOrder.map((rule, index) => (
            <div key={rule} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {index > 0 && <Tag color="default">→</Tag>}
              <Tag color={ruleLabels[rule].color} style={{ padding: '4px 12px', fontSize: 14 }}>
                {ruleLabels[rule].icon} {index + 1}. {ruleLabels[rule].label}
              </Tag>
              <Space size={2}>
                <Button
                  size="small"
                  onClick={() => moveRule(index, -1)}
                  disabled={index === 0}
                >↑</Button>
                <Button
                  size="small"
                  onClick={() => moveRule(index, 1)}
                  disabled={index === ruleOrder.length - 1}
                >↓</Button>
              </Space>
            </div>
          ))}
          <Tag color="red" style={{ padding: '4px 12px', fontSize: 14, marginLeft: 8 }}>
            {ruleLabels.negative_protection.icon} 自动: 负值兜底
          </Tag>
        </div>
        <div style={{ marginTop: 16 }}>
          <Button type="primary" onClick={saveRuleOrder}>保存顺序</Button>
        </div>
      </Card>

      <Card
        title="满减活动"
        size="small"
        extra={
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => {
            setEditing(null)
            form.resetFields()
            setVisible(true)
          }}>
            新建活动
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={promotions}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editing ? '编辑满减活动' : '新建满减活动'}
        open={visible}
        onCancel={() => { setVisible(false); setEditing(null) }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="活动名称" rules={[{ required: true }]}>
            <Input placeholder="如：满10减2活动" />
          </Form.Item>
          <Form.Item name="type" label="活动类型" rules={[{ required: true }]} initialValue="full_reduce">
            <Select>
              <Option value="full_reduce">满额立减</Option>
              <Option value="discount">满额折扣</Option>
            </Select>
          </Form.Item>
          <Form.Item name="min_amount" label="最低消费金额(元)" rules={[{ required: true }]}>
            <InputNumber min={0} step={0.1} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="discount_amount" label="优惠值" rules={[{ required: true }]}>
            <InputNumber min={0} step={0.1} precision={2} style={{ width: '100%' }} placeholder="满减填金额，折扣填数字(如9表示9折)" />
          </Form.Item>
          <Form.Item name="date_range" label="活动有效期">
            <DatePicker.RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue={1}>
            <Select>
              <Option value={1}>启用</Option>
              <Option value={0}>禁用</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Card title="负值兜底校验规则说明" size="small" style={{ marginTop: 24 }}>
        <div style={{ color: '#666', lineHeight: 2 }}>
          <p>⚠️ 当多项优惠叠加后可能导致实付金额为负数时，系统自动执行 <Tag color="red">负值兜底</Tag>：</p>
          <ul style={{ paddingLeft: 24 }}>
            <li>实付金额最终不能小于 0 元</li>
            <li>若优惠总额度超过应付金额，仅抵扣至应付金额为止</li>
            <li>计算步骤中会记录兜底金额，便于审计追溯</li>
          </ul>
        </div>
      </Card>
    </div>
  )
}
