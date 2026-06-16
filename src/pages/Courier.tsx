import { useEffect, useState } from 'react'
import {
  Table, Button, Modal, Form, Input, Select, Tag, Space, message
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'

const { Option } = Select

export default function CourierPage() {
  const [list, setList] = useState<any[]>([])
  const [visible, setVisible] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const data = await window.api.courier.list()
    setList(data)
  }

  const handleSubmit = async (values: any) => {
    if (editing) {
      await window.api.courier.update(editing.id, values)
      message.success('更新成功')
    } else {
      await window.api.courier.create(values)
      message.success('创建成功')
    }
    setVisible(false)
    setEditing(null)
    form.resetFields()
    loadData()
  }

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: '确认停用该快递员？',
      content: '停用后该快递员将无法继续投递，但历史数据保留。',
      onOk: async () => {
        await window.api.courier.delete(id)
        message.success('已停用')
        loadData()
      }
    })
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '姓名', dataIndex: 'name' },
    { title: '手机号', dataIndex: 'phone' },
    { title: '所属公司', dataIndex: 'company' },
    { title: '创建时间', dataIndex: 'created_at' },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (s: number) => s ? <Tag color="green">正常</Tag> : <Tag>停用</Tag>
    },
    {
      title: '操作', width: 150,
      render: (_: any, r: any) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => {
            setEditing(r)
            form.setFieldsValue(r)
            setVisible(true)
          }}>编辑</Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)}>停用</Button>
        </Space>
      )
    }
  ]

  return (
    <div>
      <div className="page-header">
        <div className="page-title">快递员管理</div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          setEditing(null)
          form.resetFields()
          setVisible(true)
        }}>新增快递员</Button>
      </div>

      <Table
        columns={columns}
        dataSource={list}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editing ? '编辑快递员' : '新增快递员'}
        open={visible}
        onCancel={() => { setVisible(false); setEditing(null) }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item name="phone" label="手机号" rules={[
            { required: true, message: '请输入手机号' },
            { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' }
          ]}>
            <Input placeholder="请输入手机号" />
          </Form.Item>
          <Form.Item name="company" label="所属公司">
            <Input placeholder="如：顺丰速运" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
