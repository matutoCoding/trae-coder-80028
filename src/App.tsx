import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu } from 'antd'
import {
  DashboardOutlined,
  InboxOutlined,
  FundOutlined,
  TagOutlined,
  FileTextOutlined,
  QrcodeOutlined,
  UserOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { useState } from 'react'
import DashboardPage from './pages/Dashboard'
import DeliveryPage from './pages/Delivery'
import QuotaPage from './pages/Quota'
import DiscountPage from './pages/Discount'
import BillPage from './pages/Bill'
import PickupPage from './pages/Pickup'
import CouponPage from './pages/Coupon'
import CourierPage from './pages/Courier'

const { Sider, Header, Content } = Layout

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '数据总览' },
  { key: '/delivery', icon: <InboxOutlined />, label: '投放管理' },
  { key: '/pickup', icon: <QrcodeOutlined />, label: '取件核销' },
  { key: '/quota', icon: <FundOutlined />, label: '额度管控' },
  { key: '/coupon', icon: <TagOutlined />, label: '优惠券管理' },
  { key: '/discount', icon: <SettingOutlined />, label: '优惠规则' },
  { key: '/bill', icon: <FileTextOutlined />, label: '账单管理' },
  { key: '/courier', icon: <UserOutlined />, label: '快递员管理' }
]

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <Layout className="app-layout">
      <Sider
        className="app-sider"
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={220}
      >
        <div className="app-logo">
          {collapsed ? '柜' : '快递柜管理系统'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {menuItems.find(m => m.key === location.pathname)?.label || '快递柜投放管理系统'}
          </div>
          <div style={{ color: '#666' }}>管理员</div>
        </Header>
        <Content className="app-content">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/delivery" element={<DeliveryPage />} />
            <Route path="/pickup" element={<PickupPage />} />
            <Route path="/quota" element={<QuotaPage />} />
            <Route path="/coupon" element={<CouponPage />} />
            <Route path="/discount" element={<DiscountPage />} />
            <Route path="/bill" element={<BillPage />} />
            <Route path="/courier" element={<CourierPage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

export default App
