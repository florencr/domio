"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function EditSitePage() {
  const router = useRouter();
  const params = useParams();
  const siteId = params?.id as string;

  useEffect(() => {
    if (siteId) router.replace(`/dashboard/admin?tab=sites&edit=${siteId}`);
    else router.replace("/dashboard/admin");
  }, [siteId, router]);

  return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Redirecting...</p></div>;
}
