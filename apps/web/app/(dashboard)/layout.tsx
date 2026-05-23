"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Mail,
  MessageSquare,
  Bell,
  MessageCircle,
  Phone,
  FileText,
  GitBranch,
  Users,
  Radio,
  BarChart3,
  Rss,
  Settings,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navSections = [
  {
    label: null,
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Campaigns",
    items: [
      { href: "/email-campaigns", label: "Email", icon: Mail },
      { href: "/sms-campaigns", label: "SMS", icon: MessageSquare },
      { href: "/push-campaigns", label: "Push", icon: Bell },
      { href: "/whatsapp-campaigns", label: "WhatsApp", icon: MessageCircle },
      { href: "/voice-campaigns", label: "Voice", icon: Phone },
    ],
  },
  {
    label: "Automation",
    items: [
      { href: "/templates", label: "Templates", icon: FileText },
      { href: "/rules", label: "Rules", icon: GitBranch },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/users", label: "Users", icon: Users },
      { href: "/channels", label: "Channels", icon: Radio },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/feeds", label: "Feeds", icon: Rss },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-56 flex flex-col shrink-0 bg-sidebar text-sidebar-foreground">
        {/* Logo */}
        <div className="px-5 py-4 flex items-center gap-2.5 border-b border-sidebar-border">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary shadow-sm">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <p className="font-bold text-sm text-white leading-tight">
              ORKESTAI
            </p>
            <p className="text-[10px] text-sidebar-foreground/60 uppercase tracking-widest leading-tight">
              Engage
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
          {navSections.map((section, idx) => (
            <div key={idx}>
              {section.label && (
                <p className="px-3 mb-1.5 text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map(({ href, label, icon: Icon }) => {
                  const isActive =
                    pathname === href || pathname.startsWith(href + "/");
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Tenant footer */}
        <div className="px-5 py-4 border-t border-sidebar-border">
          <p className="text-xs font-semibold text-sidebar-foreground/80">
            ProdeCaballito
          </p>
          <p className="text-[11px] text-sidebar-foreground/40 mt-0.5">
            Enterprise Plan
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="px-8 py-6">{children}</div>
      </main>
    </div>
  );
}
