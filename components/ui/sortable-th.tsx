"use client";

import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

type SortableThProps = {
  column: string;
  sortCol: string | null;
  sortDir: "asc" | "desc";
  onSort: (col: string) => void;
  children: React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
};

export function SortableTh({ column, sortCol, sortDir, onSort, children, className, align = "left" }: SortableThProps) {
  const isActive = sortCol === column;
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

  return (
    <th
      className={cn("cursor-pointer select-none hover:bg-muted/50 transition-colors", alignClass, className)}
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1 w-fit" style={align === "right" ? { marginLeft: "auto" } : undefined}>
        {children}
        {isActive ? (
          sortDir === "asc" ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />
        ) : (
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        )}
      </div>
    </th>
  );
}

export function sortBy<T>(
  arr: T[],
  col: string | null,
  dir: "asc" | "desc",
  getValue: (row: T, col: string) => string | number
): T[] {
  if (!col) return arr;
  return [...arr].sort((a, b) => {
    const va = getValue(a, col);
    const vb = getValue(b, col);
    const cmp = typeof va === "number" && typeof vb === "number"
      ? va - vb
      : String(va).localeCompare(String(vb));
    return dir === "asc" ? cmp : -cmp;
  });
}
