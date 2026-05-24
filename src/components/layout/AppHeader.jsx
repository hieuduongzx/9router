"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";
import {
  Menu,
  Moon,
  Sun,
  ChevronRight,
  User,
} from "lucide-react";

// Breadcrumb mapping
const getBreadcrumbs = (pathname) => {
  const paths = pathname.split("/").filter(Boolean);

  if (paths.length === 0 || (paths.length === 1 && paths[0] === "dashboard")) {
    return [{ label: "Api2K", href: "/dashboard", isRoot: true }];
  }

  const crumbs = [{ label: "Api2K", href: "/dashboard", isRoot: true }];

  const routeLabels = {
    endpoint: "Endpoint",
    providers: "Providers",
    models: "Models",
    combos: "Combos",
    usage: "Usage",
    quota: "Quota",
    mitm: "MITM",
    "cli-tools": "CLI Tools",
    "proxy-pools": "Proxies",
    profile: "Settings",
    "console-log": "Console",
    translator: "Translator",
    "api-keys": "API Keys",
  };

  const lastSegment = paths[paths.length - 1];
  const label = routeLabels[lastSegment] || lastSegment;

  crumbs.push({
    label,
    href: pathname,
    active: true,
  });

  return crumbs;
};

export function AppHeader({ onMenuClick, className }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const breadcrumbs = useMemo(() => getBreadcrumbs(pathname), [pathname]);

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        router.push("/login");
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to logout:", err);
    }
  };

  return (
    <header
      className={cn(
        "flex items-center justify-between px-4 h-12 bg-background border-b border-border sticky top-0 z-30",
        className,
      )}
    >
      {/* Left - Breadcrumbs */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-8 w-8 -ml-1"
          onClick={onMenuClick}
        >
          <Menu className="h-4 w-4" />
        </Button>

        <nav className="flex items-center text-sm">
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;

            return (
              <div key={crumb.href} className="flex items-center">
                {index > 0 && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 mx-1.5" />
                )}
                <Link
                  href={crumb.href}
                  className={cn(
                    "flex items-center gap-1.5 px-1.5 py-1 rounded-md transition-colors",
                    isLast
                      ? "text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {crumb.isRoot && <Logo size="xs" />}
                  <span>{crumb.label}</span>
                </Link>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Right - Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <User className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48" align="end" forceMount>
            <DropdownMenuLabel className="font-normal py-2 px-3">
              <div className="flex flex-col space-y-0.5">
                <p className="text-sm font-medium text-foreground">Admin</p>
                <p className="text-xs text-muted-foreground">Api2K</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="text-sm cursor-pointer">
              <Link href="/dashboard/profile">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive text-sm cursor-pointer focus:text-destructive"
            >
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
