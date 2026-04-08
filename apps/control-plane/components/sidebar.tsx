"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Settings, BarChart3, Clock } from "lucide-react";

const navItems = [
  { href: "/", label: "Audit Trail", icon: Activity },
  { href: "/metrics", label: "Metrics", icon: BarChart3 },
  { href: "/scheduling", label: "Scheduling", icon: Clock },
] as const;

const bottomItems = [
  { href: "/config", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[200px] shrink-0 bg-devin-bg-sidebar border-r border-devin-border flex flex-col h-full">
      <div className="px-4 py-4">
        <span className="text-[13px] font-semibold text-devin-text-primary tracking-tight">
          Backlog Autopilot
        </span>
      </div>

      <nav className="flex flex-col gap-0.5 px-2 mt-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] transition-colors ${
                active
                  ? "bg-devin-sidebar-active text-devin-text-primary font-medium"
                  : "text-devin-text-secondary hover:text-devin-text-primary hover:bg-devin-hover"
              }`}
            >
              <Icon size={15} strokeWidth={active ? 2 : 1.5} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-2 pb-3 flex flex-col gap-0.5">
        {bottomItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] transition-colors ${
                active
                  ? "bg-devin-sidebar-active text-devin-text-primary font-medium"
                  : "text-devin-text-secondary hover:text-devin-text-primary hover:bg-devin-hover"
              }`}
            >
              <Icon size={15} strokeWidth={active ? 2 : 1.5} />
              {label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
