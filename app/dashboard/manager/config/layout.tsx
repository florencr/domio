"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";

const CONFIG_NAV = [
  { href: "/dashboard/manager/config/account", key: "nav.config.account" },
  { href: "/dashboard/manager/config/buildings", key: "nav.config.buildings" },
  { href: "/dashboard/manager/config/units", key: "nav.config.units" },
  { href: "/dashboard/manager/config/unit-types", key: "nav.config.unitTypes" },
  { href: "/dashboard/manager/config/services", key: "nav.config.services" },
  { href: "/dashboard/manager/config/expenses", key: "nav.config.expenses" },
  { href: "/dashboard/manager/config/vendors", key: "nav.config.vendors" },
  { href: "/dashboard/manager/config/categories", key: "nav.config.categories" },
  { href: "/dashboard/manager/config/users", key: "nav.config.users" },
  { href: "/dashboard/manager/config/documents", key: "nav.config.documents" },
  { href: "/dashboard/manager/config/notifications", key: "nav.config.notifications" },
  { href: "/dashboard/manager/config/audit", key: "nav.config.audit" },
];

export default function ConfigLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { locale } = useLocale();

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1 mb-4">
        {CONFIG_NAV.map(({ href, key }) => {
          const isActive = pathname === href;
          return (
            <Link key={href} href={href}>
              <Button size="sm" variant={isActive ? "default" : "outline"} className="capitalize">
                {t(locale, key)}
              </Button>
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
