import { getMachineId } from "@/shared/utils/machine";
import EndpointPageClient from "./endpoint/EndpointPageClient";

// Home = Endpoint (local URL, tunnel, tailscale). API Keys are a separate page.
export default async function DashboardPage() {
  const machineId = await getMachineId();
  return <EndpointPageClient machineId={machineId} />;
}
