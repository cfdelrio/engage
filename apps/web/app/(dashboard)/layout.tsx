"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  FileText,
  GitBranch,
  LayoutDashboard,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Radio,
  Rss,
  Search,
  Settings,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";

const navSections = [
  {
    label: null,
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Campañas",
    items: [
      { href: "/email-campaigns", label: "Email", icon: Mail },
      { href: "/sms-campaigns", label: "SMS", icon: MessageSquare },
      { href: "/push-campaigns", label: "Push", icon: Bell },
      { href: "/whatsapp-campaigns", label: "WhatsApp", icon: MessageCircle },
      { href: "/voice-campaigns", label: "Voice", icon: Phone },
    ],
  },
  {
    label: "Automatización",
    items: [
      { href: "/templates", label: "Templates", icon: FileText },
      { href: "/rules", label: "Rules", icon: GitBranch },
    ],
  },
  {
    label: "Gestionar",
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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const isMac =
    typeof navigator !== "undefined" && navigator.platform.startsWith("Mac");

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />

      <div className="flex h-screen bg-background">
        {/* Sidebar */}
        <aside className="w-56 flex flex-col shrink-0 bg-sidebar text-sidebar-foreground">
          {/* Logo */}
          <div className="px-5 py-4 flex items-center gap-2.5 border-b border-sidebar-border">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary shadow-sm shrink-0">
              <Zap className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[13px] text-white leading-tight tracking-wide">
                ORKESTAI
              </p>
              <p className="text-[9px] text-sidebar-foreground/50 uppercase tracking-[0.15em] leading-tight">
                Engage
              </p>
            </div>
          </div>

          {/* Search / ⌘K */}
          <div className="px-3 pt-3 pb-1">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-sidebar-accent/60 hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground/80 transition-colors text-xs"
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 text-left">Buscar...</span>
              <kbd className="inline-flex items-center gap-0.5 rounded border border-sidebar-border px-1 font-mono text-[10px] opacity-60">
                {isMac ? "⌘" : "⌃"}K
              </kbd>
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
            {navSections.map((section, idx) => (
              <div key={idx}>
                {section.label && (
                  <p className="px-3 mb-1 text-[10px] font-semibold text-sidebar-foreground/35 uppercase tracking-widest">
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
                          "group flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 transition-opacity",
                            isActive
                              ? "opacity-100"
                              : "opacity-60 group-hover:opacity-100",
                          )}
                        />
                        {label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Tenant footer */}
          <div className="px-4 py-3.5 border-t border-sidebar-border">
            <div className="flex items-center gap-2">
              <div className="relative shrink-0">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-live-pulse" />
                <div className="absolute inset-0 h-2 w-2 rounded-full bg-emerald-500 animate-status-ring" />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-sidebar-foreground/80 leading-tight truncate">
                  ProdeCaballito
                </p>
                <p className="text-[10px] text-sidebar-foreground/35 leading-tight">
                  Enterprise Plan
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <div className="px-8 py-6">{children}</div>
        </main>
      </div>
    </>
  );
}
