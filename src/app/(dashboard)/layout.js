import DashboardLayout from "@/shared/components/layouts/DashboardLayout";

export default function DashboardRootLayout({ children }) {
  return <DashboardLayout variant="user">{children}</DashboardLayout>;
}
