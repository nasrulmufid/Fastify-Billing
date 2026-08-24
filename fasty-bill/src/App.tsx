import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { Toaster } from "sonner"

import { AdminLayout } from "@/components/layouts/AdminLayout"
import { AuthLayout } from "@/components/layouts/AuthLayout"
import { PortalLayout } from "@/components/layouts/PortalLayout"
import { QueryProvider } from "@/lib/queryProvider"
import { CustomerProvider } from "@/lib/customerStore"
import { PackageProvider } from "@/lib/packageStore"
import { ActivityLogPage } from "@/pages/admin/ActivityLogPage"
import { AdminDashboard } from "@/pages/admin/AdminDashboard"
import { CustomerLayout } from "@/pages/admin/CustomerDetail"
import { CustomersPage } from "@/pages/admin/CustomersPage"
import { InvoiceCreatePage, InvoiceDetailPage } from "@/pages/admin/InvoiceDetail"
import { InvoicesPage } from "@/pages/admin/InvoicesPage"
import { NetworkPage } from "@/pages/admin/NetworkPage"
import { NotificationsPage } from "@/pages/admin/NotificationsPage"
import { HotspotPage } from "@/pages/admin/HotspotPage"
import { PackagesPage } from "@/pages/admin/PackagesPage"
import { PaymentApprovalPage, PaymentDetailPage } from "@/pages/admin/PaymentDetail"
import { PaymentsPage } from "@/pages/admin/PaymentsPage"
import { WAGatewayPage } from "@/pages/admin/WAGatewayPage"
import { SettingsPage } from "@/pages/admin/SettingsPage"
import { TicketDetailPage } from "@/pages/admin/TicketDetail"
import { TicketsPage } from "@/pages/admin/TicketsPage"
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage"
import { LoginPage } from "@/pages/auth/LoginPage"
import { PortalLoginPage } from "@/pages/auth/PortalLoginPage"
import { NotFoundPage } from "@/pages/NotFound"
import { PortalAccountPage } from "@/pages/portal/AccountPage"
import { PortalInvoicesPage } from "@/pages/portal/InvoicesPage"
import { PortalPaymentsPage } from "@/pages/portal/PaymentsPage"
import { PortalTicketDetailPage } from "@/pages/portal/TicketDetailPage"
import { PortalTicketsPage } from "@/pages/portal/TicketsPage"
import { PortalHome } from "@/pages/portal/PortalHome"

export function App() {
  return (
    <QueryProvider>
      <CustomerProvider>
        <PackageProvider>
          <BrowserRouter>
          <Routes>
            {/* Root redirect */}
            <Route path="/" element={<Navigate to="/portal" replace />} />

            {/* Login portal pelanggan (di luar PortalLayout agar tidak redirect) */}
            <Route path="/portal/login" element={<PortalLoginPage />} />

            {/* Portal pelanggan */}
            <Route path="/portal" element={<PortalLayout />}>
              <Route index element={<PortalHome />} />
              <Route path="invoices" element={<PortalInvoicesPage />} />
              <Route path="payments" element={<PortalPaymentsPage />} />
              <Route path="tickets" element={<PortalTicketsPage />} />
              <Route path="tickets/:id" element={<PortalTicketDetailPage />} />
              <Route path="account" element={<PortalAccountPage />} />
            </Route>

            {/* Auth routes */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            </Route>

            {/* Admin routes */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="customers/:id/*" element={<CustomerLayout />} />
              <Route path="packages" element={<PackagesPage />} />
              <Route path="hotspot" element={<HotspotPage />} />
              <Route path="invoices" element={<InvoicesPage />} />
              <Route path="invoices/new" element={<InvoiceCreatePage />} />
              <Route path="invoices/:id" element={<InvoiceDetailPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="payments/approval" element={<PaymentApprovalPage />} />
              <Route path="payments/:id" element={<PaymentDetailPage />} />
              <Route path="network" element={<NetworkPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="tickets" element={<TicketsPage />} />
              <Route path="tickets/:id" element={<TicketDetailPage />} />
              <Route path="activity-log" element={<ActivityLogPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="wa-gateway" element={<WAGatewayPage />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <Toaster richColors position="top-right" />
          </BrowserRouter>
        </PackageProvider>
      </CustomerProvider>
    </QueryProvider>
  )
}

export default App
