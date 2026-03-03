import { PushNotificationSetup } from "@/components/PushNotificationSetup";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PushNotificationSetup />
      {children}
    </>
  );
}
