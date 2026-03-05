"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function AuthCodeErrorPage() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h1 className="text-lg font-semibold mb-2">Sign in failed</h1>
        <p className="text-sm text-muted-foreground mb-4">
          {message || "Something went wrong. Please try again."}
        </p>
        <Button asChild>
          <Link href="/">Back to sign in</Link>
        </Button>
      </div>
    </div>
  );
}
