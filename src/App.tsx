import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import AdminLayout from "./components/AdminLayout";
import KabidLayout from "./components/KabidLayout";
import { HomeRedirect, RequireRole } from "./components/RequireRole";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminUnits from "./pages/admin/Units";
import AdminEmployees from "./pages/admin/Employees";
import AdminImport from "./pages/admin/ImportPage";
import AdminUsers from "./pages/admin/Users";
import AdminItems from "./pages/admin/Items";
import AdminRecap from "./pages/admin/Recap";
import AdminFormDetail from "./pages/admin/FormDetail";
import AdminSettings from "./pages/admin/Settings";
import KabidHome from "./pages/kabid/Home";
import KabidUnit from "./pages/kabid/UnitEmployees";
import KabidEmployee from "./pages/kabid/EmployeeDetail";
import KabidForm from "./pages/kabid/FormSummary";
import KabidRecap from "./pages/kabid/Recap";
import KabidSettings from "./pages/kabid/Settings";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ScrollToTop />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<HomeRedirect />} />

          <Route
            path="/admin"
            element={
              <RequireRole role="admin">
                <AdminLayout />
              </RequireRole>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="units" element={<AdminUnits />} />
            <Route path="employees" element={<AdminEmployees />} />
            <Route path="import" element={<AdminImport />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="items" element={<AdminItems />} />
            <Route path="recap" element={<AdminRecap />} />
            <Route path="forms/:id" element={<AdminFormDetail />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          <Route
            path="/kabid"
            element={
              <RequireRole role="kabid">
                <KabidLayout />
              </RequireRole>
            }
          >
            <Route index element={<KabidHome />} />
            <Route path="penilaian" element={<KabidHome mode="penilaian" />} />
            <Route path="unit/:unitId" element={<KabidUnit />} />
            <Route path="pegawai/:id" element={<KabidEmployee />} />
            <Route path="form/:id" element={<KabidForm />} />
            <Route path="rekap" element={<KabidRecap />} />
            <Route path="akun" element={<KabidSettings />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
