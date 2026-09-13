"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/wordmark";
import { LogoutButton } from "@/components/logout-button";
import { navItems } from "@/components/dashboard/nav-items";

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

function NavLinks({
  isOwner,
  collapsed = false,
  onNavigate,
}: {
  isOwner: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => !item.ownerOnly || isOwner);

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {visibleItems.map(({ href, label, icon: Icon }) => {
        const isActive = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={cn(
              "flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors",
              collapsed ? "justify-center px-2" : "gap-3 px-3",
              isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <Icon className="size-5 shrink-0" />
            {collapsed ? null : label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardShell({
  email,
  isOwner,
  children,
}: {
  email: string | null;
  isOwner: boolean;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  // Desktop-only — the mobile drawer is untouched. Starts expanded on
  // every render (including the server-rendered HTML, which has no
  // access to localStorage) and is corrected right after mount, same
  // pattern as any client-only preference read — this trades one brief
  // flash on first paint for avoiding a hydration mismatch.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
    } catch {
      // Private browsing / storage disabled — just stay expanded.
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // Ignore — the toggle still works for this session either way.
      }
      return next;
    });
  }

  return (
    <div className="flex min-h-svh bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col bg-sidebar py-4 transition-[width] duration-200 md:flex",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className={cn("flex items-center pb-4", collapsed ? "flex-col gap-2 px-2" : "justify-between px-4")}>
          <Wordmark onDark showText={!collapsed} />
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="shrink-0 rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={toggleCollapsed}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>
        <NavLinks isOwner={isOwner} collapsed={collapsed} />
        <div className={cn("mt-auto pt-4", collapsed ? "flex flex-col items-center px-2" : "px-4")}>
          {collapsed ? null : (
            <p className="mb-2 truncate text-xs text-sidebar-foreground/60">{email}</p>
          )}
          <LogoutButton iconOnly={collapsed} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-sidebar py-4">
            <div className="flex items-center justify-between px-4 pb-4">
              <Wordmark onDark />
              <button
                type="button"
                aria-label="Close menu"
                className="rounded-md p-2 text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={() => setMobileOpen(false)}
              >
                <X className="size-5" />
              </button>
            </div>
            <NavLinks isOwner={isOwner} onNavigate={() => setMobileOpen(false)} />
            <div className="mt-auto px-4 pt-4">
              <p className="mb-2 truncate text-xs text-sidebar-foreground/60">{email}</p>
              <LogoutButton />
            </div>
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background px-4 py-3 md:hidden">
          <button
            type="button"
            aria-label="Open menu"
            className="rounded-md p-2 text-foreground hover:bg-accent"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </button>
          <Wordmark />
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
