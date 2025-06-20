import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { TenantsPage } from './pages/TenantsPage';
import { TenantDetailsPage } from './pages/TenantDetailsPage';
import { SuperAdminPage } from './pages/SuperAdminPage';
import { ProductsPage } from './pages/ProductsPage';
import { OrdersPage } from './pages/OrdersPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { CustomersPage } from './pages/CustomersPage';
import { DashboardPage } from './pages/DashboardPage';
import { ReportsPage } from './pages/ReportsPage';
import { DeliveryPage } from './pages/DeliveryPage';
import { DeliveryTrackingPage } from './pages/DeliveryTrackingPage';
import { PresalesRoutePlanningPage } from './pages/PresalesRoutePlanningPage';
import { SalesRoutePlanningPage } from './pages/SalesRoutePlanningPage';
import { DeliveryRoutePlanningPage } from './pages/DeliveryRoutePlanningPage';
import { SalesPage } from './pages/SalesPage'; // Renamed from VanSalesPage
import { SalesDispatchPage } from './pages/SalesDispatchPage'; // New import
import { WarehousePage } from './pages/WarehousePage';
import { SettingsPage } from './pages/SettingsPage';
import { ActivityLogsPage } from './pages/ActivityLogsPage';
import { TempSignupPage } from './pages/TempSignupPage';
import { SupplierOrdersPage } from './pages/SupplierOrdersPage';
import { PresalesAgentsVehiclesPage } from './pages/PresalesAgentsVehiclesPage';
import { SalesAgentsVehiclesPage } from './pages/SalesAgentsVehiclesPage';
import { DeliveryAgentsVehiclesPage } from './pages/DeliveryAgentsVehiclesPage';
import { UsersManagementPage } from './pages/UsersManagementPage';
import { ChatbotPage } from './pages/ChatbotPage';
import { AuthGuard } from './components/AuthGuard';
import { DashboardLayout } from './components/DashboardLayout';
import { useAuthStore } from './store/authStore';
import { PromotionsPage } from './pages/PromotionsPage';
import { MarketingDashboardPage } from './pages/MarketingDashboardPage';
import { CampaignManagementPage } from './pages/CampaignManagementPage';
import { PromotionalContentManagementPage } from './pages/PromotionalContentManagementPage';
import { WhatsAppOrdersViewPage } from './pages/WhatsAppOrdersViewPage';
import { WhatsAppChatbotConfigurationPage } from './pages/WhatsAppChatbotConfigurationPage';

function App() {
  const { isLoading, profile } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Redirect superadmin to superadmin dashboard
  const isSuperAdmin = profile?.role === 'superadmin';

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/track" element={<DeliveryTrackingPage />} />
        <Route path="/temp-signup" element={<TempSignupPage />} />
        
        {/* Superadmin Dashboard */}
        {isSuperAdmin && (
          <Route
            path="/superadmin"
            element={
              <AuthGuard allowedRoles={['superadmin']}>
                <DashboardLayout>
                  <SuperAdminPage />
                </DashboardLayout>
              </AuthGuard>
            }
          />
        )}
        
        <Route
          path="/"
          element={
            <AuthGuard>
              {isSuperAdmin ? <Navigate to="/superadmin" replace /> : (
                <DashboardLayout>
                  <DashboardPage />
                </DashboardLayout>
              )}
            </AuthGuard>
          }
        />
        
        <Route
          path="/tenants"
          element={
            <AuthGuard allowedRoles={['admin', 'superadmin']}>
              <DashboardLayout>
                <TenantsPage />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        <Route
          path="/tenants/:id"
          element={
            <AuthGuard allowedRoles={['admin', 'superadmin']}>
              <DashboardLayout>
                <TenantDetailsPage />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        {/* Assets Module */}
        <Route
          path="/products"
          element={
            <AuthGuard>
              <DashboardLayout>
                <ProductsPage />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        <Route
          path="/customers"
          element={
            <AuthGuard>
              <DashboardLayout>
                <CustomersPage />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        {/* Promotions Page - Fixed route */}
        <Route
          path="/promotions"
          element={
            <AuthGuard allowedRoles={['admin', 'sales', 'superadmin']}>
              <DashboardLayout>
                <PromotionsPage />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        {/* Presales Module */}
        <Route
          path="/presales/orders"
          element={
            <AuthGuard requiredModules={['presales_delivery']}>
              <DashboardLayout>
                <OrdersPage moduleType="presales" />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        <Route
          path="/presales/agents-vehicles"
          element={
            <AuthGuard 
              allowedRoles={['admin', 'presales', 'superadmin']}
              requiredModules={['presales_delivery']}
            >
              <DashboardLayout>
                <PresalesAgentsVehiclesPage />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        {/* Module-specific Route Planning */}
        <Route
          path="/presales/route-planning"
          element={
            <AuthGuard 
              allowedRoles={['admin', 'presales', 'superadmin']}
              requiredModules={['presales_delivery']}
            >
              <DashboardLayout>
                <PresalesRoutePlanningPage />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        <Route
          path="/sales/route-planning"
          element={
            <AuthGuard 
              allowedRoles={['admin', 'sales', 'superadmin']}
              requiredModules={['van_sales']}
            >
              <DashboardLayout>
                <SalesRoutePlanningPage />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        <Route
          path="/delivery/route-planning"
          element={
            <AuthGuard 
              allowedRoles={['admin', 'delivery', 'superadmin']}
              requiredModules={['presales_delivery']}
            >
              <DashboardLayout>
                <DeliveryRoutePlanningPage />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        {/* Sales Module */}
        <Route
          path="/sales"
          element={
            <AuthGuard 
              allowedRoles={['sales', 'admin', 'superadmin']}
              requiredModules={['van_sales']}
            >
              <DashboardLayout>
                <SalesPage />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        <Route
          path="/sales/agents-vehicles"
          element={
            <AuthGuard 
              allowedRoles={['admin', 'sales', 'superadmin']}
              requiredModules={['van_sales']}
            >
              <DashboardLayout>
                <SalesAgentsVehiclesPage />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        <Route
          path="/sales/orders"
          element={
            <AuthGuard requiredModules={['van_sales']}>
              <DashboardLayout>
                <OrdersPage moduleType="sales" />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        <Route
          path="/sales/dispatch"
          element={
            <AuthGuard 
              allowedRoles={['admin', 'superadmin']}
              requiredModules={['van_sales']}
            >
              <DashboardLayout>
                <SalesDispatchPage />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        <Route
          path="/sales/invoices"
          element={
            <AuthGuard requiredModules={['van_sales']}>
              <DashboardLayout>
                <InvoicesPage moduleType="sales" />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        {/* Delivery Module */}
        <Route
          path="/delivery/orders"
          element={
            <AuthGuard requiredModules={['presales_delivery']}>
              <DashboardLayout>
                <OrdersPage moduleType="delivery" />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        <Route
          path="/delivery/agents-vehicles"
          element={
            <AuthGuard 
              allowedRoles={['admin', 'delivery', 'superadmin']}
              requiredModules={['presales_delivery']}
            >
              <DashboardLayout>
                <DeliveryAgentsVehiclesPage />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        <Route
          path="/deliveries"
          element={
            <AuthGuard requiredModules={['presales_delivery']}>
              <DashboardLayout>
                <DeliveryPage />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        {/* Marketing Module */}
        <Route
          path="/marketing/dashboard"
          element={
            <AuthGuard>
              <DashboardLayout>
                <MarketingDashboardPage />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        <Route
          path="/marketing/campaigns"
          element={
            <AuthGuard>
              <DashboardLayout>
                <CampaignManagementPage />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        <Route
          path="/marketing/content"
          element={
            <AuthGuard>
              <DashboardLayout>
                <PromotionalContentManagementPage />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        <Route
          path="/marketing/whatsapp-orders"
          element={
            <AuthGuard>
              <DashboardLayout>
                <WhatsAppOrdersViewPage />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        <Route
          path="/marketing/chatbot-config"
          element={
            <AuthGuard allowedRoles={['admin', 'superadmin']}>
              <DashboardLayout>
                <WhatsAppChatbotConfigurationPage />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        {/* Warehouse Module */}
        <Route
          path="/warehouse"
          element={
            <AuthGuard 
              allowedRoles={['warehouse', 'admin', 'superadmin']}
              requiredModules={['wms']}
            >
              <DashboardLayout>
                <WarehousePage />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        <Route
          path="/supplier-orders"
          element={
            <AuthGuard 
              allowedRoles={['warehouse', 'admin', 'superadmin']}
              requiredModules={['wms']}
            >
              <DashboardLayout>
                <SupplierOrdersPage />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        {/* Reports Module */}
        <Route
          path="/reports/:reportType"
          element={
            <AuthGuard>
              <DashboardLayout>
                <ReportsPage />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        {/* Management Module */}
        <Route
          path="/activity-logs"
          element={
            <AuthGuard allowedRoles={['admin', 'superadmin']}>
              <DashboardLayout>
                <ActivityLogsPage />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        <Route
          path="/settings"
          element={
            <AuthGuard allowedRoles={['admin', 'superadmin']}>
              <DashboardLayout>
                <SettingsPage />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        <Route
          path="/users-management"
          element={
            <AuthGuard allowedRoles={['admin', 'superadmin']}>
              <DashboardLayout>
                <UsersManagementPage />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        {/* Chatbot */}
        <Route
          path="/chatbot"
          element={
            <AuthGuard>
              <DashboardLayout>
                <ChatbotPage />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;