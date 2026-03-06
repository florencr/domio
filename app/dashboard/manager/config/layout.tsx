"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const CONFIG_NAV = [
  { href: "/dashboard/manager/config/buildings", label: "Buildings" },
  { href: "/dashboard/manager/config/units", label: "Units" },
  { href: "/dashboard/manager/config/unit-types", label: "Unit types" },
  { href: "/dashboard/manager/config/services", label: "Services" },
  { href: "/dashboard/manager/config/expenses", label: "Expenses" },
  { href: "/dashboard/manager/config/vendors", label: "Vendors" },
  { href: "/dashboard/manager/config/categories", label: "Categories" },
  { href: "/dashboard/manager/config/users", label: "Users" },
  { href: "/dashboard/manager/config/documents", label: "Documents" },
  { href: "/dashboard/manager/config/notifications", label: "Notifications" },
  { href: "/dashboard/manager/config/audit", label: "Audit" },
];

export default function ConfigLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1 mb-4">
        {CONFIG_NAV.map(({ href, label }) => {
          const isActive = pathname === href;
          return (
            <Link key={href} href={href}>
              <Button size="sm" variant={isActive ? "default" : "outline"} className="capitalize">
                {label}
              </Button>
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
