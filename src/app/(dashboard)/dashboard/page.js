import { getMachineId } from "@/shared/utils/machine";
import DashboardHomeClient from "./DashboardHomeClient";

export default async function DashboardPage() {
  const machineId = await getMachineId();
  return <DashboardHomeClient machineId={machineId} />;
}
