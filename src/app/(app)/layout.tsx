"use client";

import type { ReactNode } from "react";
import { ViewerGate } from "@/components/viewer";
import { Shell } from "@/components/shell";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ViewerGate>
      <Shell>{children}</Shell>
    </ViewerGate>
  );
}
