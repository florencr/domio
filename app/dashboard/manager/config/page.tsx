"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ManagerConfigPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/manager/config/buildings");
  }, [router]);
  return (
    <div className="min-h-[200px] flex items-center justify-center">
      <p className="text-muted-foreground">Redirecting...</p>
    </div>
  );
}
