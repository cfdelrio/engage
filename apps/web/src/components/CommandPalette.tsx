"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  group: string;
}

const COMMANDS: Command[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Métricas y eventos en tiempo real",
    icon: LayoutDashboard,
    href: "/dashboard",
    group: "Navegar",
  },
  {
    id: "email",
    label: "Email Campaigns",
    description: "Campañas de correo",
    icon: Mail,
    href: "/email-campaigns",
    group: "Campañas",
  },
  {
    id: "sms",
    label: "SMS Campaigns",
    description: "Campañas de mensajería",
    icon: MessageSquare,
    href: "/sms-campaigns",
    group: "Campañas",
  },
  {
    id: "push",
    label: "Push Campaigns",
    description: "Notificaciones push",
    icon: Bell,
    href: "/push-campaigns",
    group: "Campañas",
  },
  {
    id: "whatsapp",
    label: "WhatsApp Campaigns",
    description: "Campañas de WhatsApp",
    icon: MessageCircle,
    href: "/whatsapp-campaigns",
    group: "Campañas",
  },
  {
    id: "voice",
    label: "Voice Campaigns",
    description: "Campañas de voz",
    icon: Phone,
    href: "/voice-campaigns",
    group: "Campañas",
  },
  {
    id: "templates",
    label: "Templates",
    description: "Plantillas de mensajes",
    icon: FileText,
    href: "/templates",
    group: "Automatización",
  },
  {
    id: "rules",
    label: "Rules",
    description: "Reglas IF/THEN",
    icon: GitBranch,
    href: "/rules",
    group: "Automatización",
  },
  {
    id: "users",
    label: "Users",
    description: "Gestión de usuarios",
    icon: Users,
    href: "/users",
    group: "Gestionar",
  },
  {
    id: "channels",
    label: "Channels",
    description: "Configuración de canales",
    icon: Radio,
    href: "/channels",
    group: "Gestionar",
  },
  {
    id: "analytics",
    label: "Analytics",
    description: "Reportes y métricas",
    icon: BarChart3,
    href: "/analytics",
    group: "Gestionar",
  },
  {
    id: "feeds",
    label: "Feeds",
    description: "Feeds de notificaciones",
    icon: Rss,
    href: "/feeds",
    group: "Gestionar",
  },
  {
    id: "settings",
    label: "Settings",
    description: "Configuración general",
    icon: Settings,
    href: "/settings",
    group: "Gestionar",
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered =
    query.trim() === ""
      ? COMMANDS
      : COMMANDS.filter(
          (c) =>
            c.label.toLowerCase().includes(query.toLowerCase()) ||
            c.description?.toLowerCase().includes(query.toLowerCase()) ||
            c.group.toLowerCase().includes(query.toLowerCase()),
        );

  const grouped = filtered.reduce<Record<string, Command[]>>((acc, cmd) => {
    if (!acc[cmd.group]) acc[cmd.group] = [];
    (acc[cmd.group] as Command[]).push(cmd);
    return acc;
  }, {});

  const navigate = useCallback(
    (href: string) => {
      router.push(href);
      onClose();
    },
    [router, onClose],
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cmd = filtered[selectedIdx];
        if (cmd) navigate(cmd.href);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, filtered, selectedIdx, navigate, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center pt-[14vh] px-4 bg-black/50 animate-fade-in"
      onClick={onClose}
      style={{ animation: "fade-in 0.15s ease-out both" }}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-border bg-card/95 shadow-2xl overflow-hidden animate-scale-in"
        style={{ backdropFilter: "blur(20px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            placeholder="Buscar páginas, campañas, funciones..."
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/50 text-foreground"
          />
          <kbd className="hidden sm:inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Zap className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm">
                Sin resultados para &ldquo;{query}&rdquo;
              </p>
            </div>
          ) : (
            Object.entries(grouped).map(([group, cmds]) => (
              <div key={group}>
                <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  {group}
                </p>
                {cmds.map((cmd) => {
                  const globalIdx = filtered.indexOf(cmd);
                  const isSelected = globalIdx === selectedIdx;
                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      onClick={() => navigate(cmd.href)}
                      onMouseEnter={() => setSelectedIdx(globalIdx)}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                        isSelected
                          ? "bg-primary/10 text-foreground"
                          : "text-foreground/80 hover:bg-muted/60"
                      }`}
                    >
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <cmd.icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <span className="font-medium">{cmd.label}</span>
                        {cmd.description && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {cmd.description}
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <kbd className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground shrink-0">
                          ↵
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2 flex items-center gap-4 text-[11px] text-muted-foreground/60">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">
              ↑↓
            </kbd>
            navegar
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">
              ↵
            </kbd>
            abrir
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">
              esc
            </kbd>
            cerrar
          </span>
        </div>
      </div>
    </div>
  );
}
