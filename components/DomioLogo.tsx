"use client";

import Image from "next/image";

export function DomioLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/domio-logo.png"
      alt="Domio"
      width={140}
      height={40}
      className={className}
      priority
    />
  );
}
