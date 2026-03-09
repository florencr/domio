"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminManagersPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard/admin/users"); }, [router]);
  return <p className="text-muted-foreground p-4">Redirecting to Users...</p>;
}
