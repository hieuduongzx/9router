/**
 * Root error boundary. Next renders this for an unhandled error in a server
 * component on the matched route. The page form mirrors loading.js so the user
 * doesn't land on a wildly different layout when something blows up.
 *
 * Must export its own `<html>` and `<body>` because the root layout is not
 * guaranteed to be in place when this renders. Imported directly from the
 * primitive modules to keep the dependency graph small — the public barrel
 * pulls in too much for an error-boundary module.
 */
"use client";

import { Card, CardContent } from "@/shared/components/ui/card";
import { EmptyState } from "@/shared/components";

export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
          <Card padding="lg" className="w-full max-w-md">
            <CardContent>
              <EmptyState
                icon="alert_triangle"
                title="Something went wrong"
                description={
                  error?.message
                    ? `${error.message}. Try again, or refresh the page if the problem keeps happening.`
                    : "An unexpected error happened. Try again."
                }
                action={
                  <button
                    type="button"
                    onClick={() =>
                      typeof reset === "function" ? reset() : globalThis.location.reload()
                    }
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90"
                  >
                    Try again
                  </button>
                }
              />
            </CardContent>
          </Card>
        </div>
      </body>
    </html>
  );
}
