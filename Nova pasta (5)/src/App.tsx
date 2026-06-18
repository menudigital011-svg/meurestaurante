import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import MenuPage from './pages/MenuPage';
import AdminDashboard from './pages/Admin/Dashboard';
import ProductDetail from './pages/ProductDetail';
import AdminLayout from './components/Admin/AdminLayout';
import AdminMenu from './pages/Admin/Menu';
import AdminOrders from './pages/Admin/Orders';
import AdminSettings from './pages/Admin/Settings';
import AdminTables from './pages/Admin/Tables';
import Login from './pages/Login';
import { AuthProvider } from './components/AuthProvider';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Client Side */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/r/:restaurantId" element={<MenuPage />} />
          <Route path="/r/:restaurantId/table/:tableId" element={<MenuPage />} />
          <Route path="/r/:restaurantId/product/:id" element={<ProductDetail />} />
          <Route path="/login" element={<Login />} />
          
          {/* Admin Side - Protected */}
          <Route element={<ProtectedRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="menu" element={<AdminMenu />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="tables" element={<AdminTables />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
          </Route>

          {/* Catch all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </Router>
  );
}
