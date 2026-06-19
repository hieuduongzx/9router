import { getMachineId } from "@/shared/utils/machine";
import DashboardPageClient from "./DashboardPageClient";

export const metadata = {
  title: "Dashboard - Api2K",
  description: "Overview of your AI proxy usage and configuration",
};

export default async function DashboardPage() {
  const machineId = await getMachineId();
  return <DashboardPageClient machineId={machineId} />;
}
