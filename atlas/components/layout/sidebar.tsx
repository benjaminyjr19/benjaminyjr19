"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Inbox,
  Library,
  LogOut,
  Search,
  Settings,
  Sunrise,
  Users,
} from "lucide-react";

import { signOutAction } from "@/app/actions/auth";
import { AtlasMark } from "@/components/layout/atlas-mark";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/today", label: "Today", icon: Sunrise },
  { href: "/review", label: "Review", icon: Inbox },
  { href: "/search", label: "Search", icon: Search },
  { href: "/centre", label: "Centre", icon: Library },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

interface SidebarProps {
  userName: string;
  centreName: string;
  demoMode: boolean;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function Sidebar({ userName, centreName, demoMode }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border/70 bg-background/80 px-4 py-6 backdrop-blur md:flex">
      <Link href="/today" className="flex items-center gap-2.5 px-2">
        <AtlasMark />
        <span className="text-[17px] font-semibold tracking-tight">Atlas</span>
      </Link>

      <nav className="mt-8 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/today" && pathname.startsWith(item.href)) ||
            (item.href === "/today" && pathname.startsWith("/week"));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary-soft font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" strokeWidth={active ? 2.2 : 1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-4">
        <Link
          href="/community"
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
            pathname.startsWith("/community")
              ? "bg-primary-soft font-medium text-accent-foreground"
              : "text-muted-foreground/70 hover:bg-muted hover:text-foreground",
          )}
        >
          <Users className="h-4 w-4" strokeWidth={1.8} />
          Community
          <Badge variant="quiet" className="ml-auto text-[10px]">
            Soon
          </Badge>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-accent-foreground">
              {initials(userName)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{userName}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {centreName}
              </span>
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-52">
            <DropdownMenuLabel>
              {demoMode ? "Preview workspace" : "Signed in"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings /> Settings
              </Link>
            </DropdownMenuItem>
            {!demoMode && (
              <DropdownMenuItem onSelect={() => void signOutAction()}>
                <LogOut /> Sign out
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <p className="px-2 text-[11px] leading-relaxed text-muted-foreground/70">
          Your centre data stays private.
        </p>
      </div>
    </aside>
  );
}

/** Bottom tab bar on small screens. */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border/70 bg-background/90 py-2 backdrop-blur md:hidden">
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/today" && pathname.startsWith(item.href)) ||
          (item.href === "/today" && pathname.startsWith("/week"));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px]",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <item.icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.8} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
