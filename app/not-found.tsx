import Link from "next/link";
import { DomioLogo } from "@/components/DomioLogo";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/30">
      <DomioLogo className="h-12 w-auto mb-4" />
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground mt-2">The page you are looking for does not exist.</p>
      <Link href="/" className="mt-6 text-sm text-primary hover:underline">
        ← Back to home
      </Link>
    </div>
  );
}
