import { useEffect, useState } from 'react'
import {
  Table, Button, Modal, Form, Input, InputNumber, Select,
  Tag, message, DatePicker, Space
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, GiftOutlined } from '@ant-design/icons'

const { Option } = Select

export default function CouponPage() {
  const [coupons, setCoupons] = useState<any[]>([])
  const [couriers, setCouriers] = useState<any[]>([])
  const [visible, setVisible] = useState(false)
  const [grantVisible, setGrantVisible] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()
  const [grantForm] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [c, cs] = await Promise.all([
      window.api.coupon.list(),
      window.api.courier.list()
    ])
    setCoupons(c)
    setCouriers(cs)
  }

  const handleSubmit = async (values: any) => {
    if (editing) {
      await window.api.coupon.update(editing.id, values)
      message.success('更新成功')
    } else {
      await window.api.coupon.create(values)
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
        await window.api.coupon.delete(id)
        message.success('删除成功')
        loadData()
      }
    })
  }

  const handleGrant = async (values: any) => {
    const r = await window.api.coupon.grantToCourier(values)
    message.success(`发放成功，共 ${r.length} 张`)
    setGrantVisible(false)
    grantForm.resetFields()
  }

  const typeMap: Record<string, string> = {
    fixed: '立减券',
    discount: '折扣券',
    overdue_reduce: '滞留费券'
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '名称', dataIndex: 'name' },
    {
      title: '类型', dataIndex: 'type', width: 100,
      render: (t: string) => <Tag color="blue">{typeMap[t]}</Tag>
    },
    {
      title: '面值', width: 120,
      render: (_: any, r: any) => (
        r.type === 'discount' ? `${r.value}折` : `¥${r.value}`
      )
    },
    {
      title: '最低消费', dataIndex: 'min_amount', width: 100,
      render: (v: number) => `¥${v}`
    },
    { title: '有效期(天)', dataIndex: 'valid_days', width: 100 },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (s: number) => s ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag>
    },
    {
      title: '操作', width: 200,
      render: (_: any, r: any) => (
        <Space>
          <Button type="link" size="small" icon={<GiftOutlined />} onClick={() => {
            grantForm.setFieldsValue({ coupon_id: r.id })
            setGrantVisible(true)
          }}>发放</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => {
            setEditing(r)
            form.setFieldsValue(r)
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
        <div className="page-title">优惠券管理</div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setVisible(true) }}>
          新建优惠券
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={coupons}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editing ? '编辑优惠券' : '新建优惠券'}
        open={visible}
        onCancel={() => { setVisible(false); setEditing(null) }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="优惠券名称" rules={[{ required: true }]}>
            <Input placeholder="如：新用户立减券" />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select onChange={() => form.setFieldsValue({ value: undefined })}>
              <Option value="fixed">立减券（直减金额）</Option>
              <Option value="discount">折扣券（如9折填9）</Option>
              <Option value="overdue_reduce">滞留费减免券</Option>
            </Select>
          </Form.Item>
          <Form.Item name="value" label="面值" rules={[{ required: true }]}>
            <InputNumber min={0} step={0.1} style={{ width: '100%' }} placeholder="根据类型填金额或折扣" />
          </Form.Item>
          <Form.Item name="min_amount" label="最低消费金额" initialValue={0}>
            <InputNumber min={0} step={0.1} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="valid_days" label="有效期(天)" initialValue={30}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue={1}>
            <Select>
              <Option value={1}>启用</Option>
              <Option value={0}>禁用</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="发放优惠券"
        open={grantVisible}
        onCancel={() => setGrantVisible(false)}
        onOk={() => grantForm.submit()}
      >
        <Form form={grantForm} layout="vertical" onFinish={handleGrant}>
          <Form.Item name="coupon_id" label="选择优惠券" rules={[{ required: true }]}>
            <Select>
              {coupons.filter(c => c.status).map(c => (
                <Option key={c.id} value={c.id}>{c.name}（{typeMap[c.type]} {c.type === 'discount' ? `${c.value}折` : `¥${c.value}`}）</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="courier_id" label="发放给快递员" rules={[{ required: true }]}>
            <Select>
              {couriers.map(c => <Option key={c.id} value={c.id}>{c.name}（{c.phone}）</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="quantity" label="发放数量" initialValue={1} rules={[{ required: true }]}>
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
