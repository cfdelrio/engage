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
      <aside className="w-56 border-r bg-card flex flex-col shrink-0">
        <div className="p-5 border-b">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <div>
              <p className="font-bold text-sm">ORKESTAI</p>
              <p className="text-xs text-muted-foreground">ENGAGE</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto space-y-4">
          {navSections.map((section, idx) => (
            <div key={idx}>
              {section.label && (
                <p className="px-3 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                      pathname === href || pathname.startsWith(href + "/")
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t">
          <p className="text-xs font-medium">ProdeCaballito</p>
          <p className="text-xs text-muted-foreground">Enterprise Plan</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
