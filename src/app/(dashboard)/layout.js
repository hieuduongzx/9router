"use client";

import { AppLayout } from "@/components/layout";
import { useNotificationStore } from "@/store/notificationStore";

export default function DashboardRootLayout({ children }) {
  const notifications = useNotificationStore((state) => state.notifications);
  const removeNotification = useNotificationStore((state) => state.removeNotification);

  return (
    <AppLayout notifications={notifications} onDismissNotification={removeNotification}>
      {children}
    </AppLayout>
  );
}

