import DashboardLayout from "@/shared/components/layouts/DashboardLayout";

export default function AdminRootLayout({ children }) {
  return <DashboardLayout variant="admin">{children}</DashboardLayout>;
}
