"use client";

import { useParams } from "next/navigation";
import ProviderDetailClient from "./ProviderDetailClient";

export default function ProviderDetailPage() {
  const params = useParams();
  return <ProviderDetailClient providerId={params.id} />;
}
