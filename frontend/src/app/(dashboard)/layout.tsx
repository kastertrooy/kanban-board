"use client";

import { DashboardProvider } from "@/components/dashboard/dashboard-context";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <DashboardProvider>{children}</DashboardProvider>;
}
