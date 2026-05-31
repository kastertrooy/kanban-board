import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Kanban",
  description: "Kanban board client",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
