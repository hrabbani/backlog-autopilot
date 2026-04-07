import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { Activity, Settings, BarChart3 } from "lucide-react";

export const metadata: Metadata = {
  title: "Backlog Autopilot — Control Plane",
  description: "Master control plane for backlog automation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-devin-bg-main">
        <nav className="border-b border-devin-border px-8 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-8">
            <span className="font-semibold text-[14px] text-devin-text-primary">
              Backlog Autopilot
            </span>
            <div className="flex gap-1">
              <NavLink href="/" icon={<Activity size={14} />}>
                Audit Trail
              </NavLink>
              <NavLink href="/config" icon={<Settings size={14} />}>
                Configuration
              </NavLink>
              <NavLink href="/metrics" icon={<BarChart3 size={14} />}>
                Metrics
              </NavLink>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium text-devin-text-secondary hover:text-devin-text-primary hover:bg-devin-hover transition-colors"
    >
      {icon}
      {children}
    </Link>
  );
}
