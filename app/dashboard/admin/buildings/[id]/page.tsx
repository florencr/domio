"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function EditBuildingPage() {
  const router = useRouter();
  const params = useParams();
  const buildingId = params?.id as string;

  useEffect(() => {
    if (buildingId) router.replace(`/dashboard/admin/buildings?edit=${buildingId}`);
    else router.replace("/dashboard/admin/overview");
  }, [buildingId, router]);

  return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Redirecting...</p></div>;
}
