import ApiKeysPageClient from "./ApiKeysPageClient";

export const metadata = {
  title: "API Keys - Api2K",
  description: "Manage API keys for accessing the proxy",
};

export default function ApiKeysPage() {
  return <ApiKeysPageClient />;
}
