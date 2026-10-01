"use client";

import { useEffect, useState } from "react";
import QuickStartPanel from "../components/QuickStartPanel";

/**
 * The standalone endpoint route shows exactly what the dashboard home shows —
 * same panel, same copy — so there is only one description of how to point a
 * client at the gateway.
 */
export default function EndpointPageClient() {
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/keys", { cache: "no-store", signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const keys = Array.isArray(data?.keys) ? data.keys : [];
        setApiKey(keys.find((key) => key.isActive)?.key || keys[0]?.key || "");
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <QuickStartPanel apiKey={apiKey} />
    </div>
  );
}
