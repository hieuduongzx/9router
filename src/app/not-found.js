import Link from "next/link";

import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <EmptyState
        icon="map-pin-off"
        title="Page not found"
        description="The page you were looking for isn't here. It may have moved, or the link is wrong."
        action={
          <Button asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        }
      />
    </div>
  );
}
