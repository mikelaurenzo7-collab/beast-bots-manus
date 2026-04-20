import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { Bell, Bot, LayoutDashboard, LogOut, Menu, MessageCircle, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function NavBar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const unreadQuery = trpc.notifications.unreadCount.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const unread = unreadQuery.data ?? 0;

  const navLinks = [
    { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
    ...(isAuthenticated
      ? [
          { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
          { href: "/chat", label: "BeastBot AI", icon: MessageCircle },
        ]
      : []),
  ];

  return (
    <header className="sticky top-0 z-50 bg-card border-b-2 border-border">
      <div className="container flex items-center justify-between h-14">
        {/* Logo */}
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center shadow-pop-sm">
              <Bot className="w-5 h-5 text-background" />
            </div>
            <span className="font-display font-bold text-lg text-foreground hidden sm:block">
              Beast Bots
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <div
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  location === href
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </div>
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <Link href="/notifications">
                <div className="relative w-9 h-9 flex items-center justify-center rounded-lg border-2 border-border hover:bg-secondary cursor-pointer transition-colors">
                  <Bell className="w-4 h-4" />
                  {unread > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#E8541A] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </div>
              </Link>
              <div className="flex items-center gap-2 pl-2 border-l-2 border-border">
                <div className="w-7 h-7 rounded-full bg-foreground flex items-center justify-center text-background text-xs font-bold">
                  {(user?.name ?? "U")[0].toUpperCase()}
                </div>
                <button
                  onClick={() => logout()}
                  className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <LogOut className="w-3 h-3" />
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <a href={getLoginUrl()}>
              <button className="pop-btn bg-foreground text-background px-4 py-1.5 rounded-lg text-sm font-semibold">
                Sign In
              </button>
            </a>
          )}

          {/* Mobile menu toggle */}
          <button
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg border-2 border-border"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t-2 border-border bg-card px-4 py-3 flex flex-col gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium",
                  location === href ? "bg-foreground text-background" : "text-foreground hover:bg-secondary"
                )}
                onClick={() => setMobileOpen(false)}
              >
                <Icon className="w-4 h-4" />
                {label}
              </div>
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
