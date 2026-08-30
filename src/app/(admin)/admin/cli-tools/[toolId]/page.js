import ToolDetailPage from "@/app/(dashboard)/dashboard/cli-tools/[toolId]/page";

// Forward `params` — the original page awaits it server-side.
export default function AdminToolDetailPage(props) {
  return <ToolDetailPage {...props} />;
}
