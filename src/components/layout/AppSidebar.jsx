"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogoWithText } from "@/components/ui/logo";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Layers,
  BarChart3,
  Database,
  Settings,
  Terminal,
  Shield,
  Power,
  Globe,
  FileCode,
  Languages,
  Activity,
  LayoutDashboard,
  Key,
  Image,
  Mic,
  Film,
  BarChart,
} from "lucide-react";

// Navigation
const mainNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/api-keys", label: "API Keys", icon: Key },
  { href: "/dashboard/combos", label: "Combos", icon: Layers },
];

const analyticsNavItems = [
  { href: "/dashboard/usage", label: "Usage", icon: BarChart3 },
  { href: "/dashboard/quota", label: "Quota", icon: Activity },
];

const toolsNavItems = [
  { href: "/dashboard/mitm", label: "MITM", icon: Shield },
  { href: "/dashboard/cli-tools", label: "CLI Tools", icon: Terminal },
];

const systemNavItems = [
  { href: "/dashboard/proxy-pools", label: "Proxies", icon: Globe },
  { href: "/dashboard/profile", label: "Settings", icon: Settings },
];

function NavItem({ item, nested = false, active, onClose }) {
  const Icon = item.icon;
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={item.href}
            onClick={onClose}
            className={cn(
              "flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors",
              active
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
              nested && "ml-6",
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            />
            <span className="truncate">{item.label}</span>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" className="lg:hidden">
          {item.label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SectionHeader({ title, count }) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
        {title}
      </span>
      {count !== undefined && (
        <span className="text-[11px] text-muted-foreground/70">{count}</span>
      )}
    </div>
  );
}

export function AppSidebar({ onClose, className }) {
  const pathname = usePathname();
  const [showShutdownModal, setShowShutdownModal] = useState(false);
  const [isShuttingDown, setIsShuttingDown] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [enableTranslator, setEnableTranslator] = useState(false);
  const [version, setVersion] = useState("0.0.0");

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.enableTranslator) setEnableTranslator(true);
      })
      .catch(() => {});

    fetch("/api/version")
      .then((res) => res.json())
      .then((data) => {
        setVersion(data.currentVersion || "0.0.0");
        if (data.hasUpdate) setUpdateInfo(data);
      })
      .catch(() => {});
  }, []);

  const isActive = (href) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    if (href === "/dashboard/endpoint") {
      return pathname.startsWith("/dashboard/endpoint");
    }
    return pathname.startsWith(href);
  };

  const handleShutdown = async () => {
    setIsShuttingDown(true);
    try {
      await fetch("/api/shutdown", { method: "POST" });
    } catch (e) {}
    setIsShuttingDown(false);
    setShowShutdownModal(false);
    setIsDisconnected(true);
  };

  const renderNav = (item, nested = false) => (
    <NavItem
      key={item.href}
      item={item}
      nested={nested}
      active={isActive(item.href)}
      onClose={onClose}
    />
  );

  return (
    <>
      <TooltipProvider delayDuration={0}>
        <div
          className={cn(
            "flex flex-col h-full w-56 bg-sidebar text-sidebar-foreground border-r border-sidebar-border",
            className,
          )}
        >
          {/* Brand */}
          <div className="px-3 py-3 border-b border-sidebar-border">
            <Link
              href="/dashboard"
              className="inline-flex items-center"
            >
              <LogoWithText size="sm" />
            </Link>
          </div>

          {/* Update notification */}
          {updateInfo && (
            <div className="mx-3 mt-3 px-3 py-2 rounded-md bg-muted border border-border">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-foreground" />
                <span className="text-xs font-medium text-foreground">
                  v{updateInfo.latestVersion} available
                </span>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto py-3 space-y-4 scrollbar-thin">
            {/* Main Section */}
            <div className="px-2">
              <SectionHeader title="Core" count={mainNavItems.length} />
              <div className="mt-1 space-y-0.5">
                {mainNavItems.map((item) => renderNav(item))}
              </div>
            </div>

            {/* Providers Section */}
            <div className="px-2">
              <SectionHeader title="Providers" />
              <div className="mt-1 space-y-0.5">
                {renderNav({ href: "/dashboard/providers", label: "Text", icon: Database })}
                {renderNav({ href: "/dashboard/media-providers/embedding", label: "Embeddings", icon: BarChart })}
                {renderNav({ href: "/dashboard/media-providers/image", label: "Image", icon: Image })}
                {renderNav({ href: "/dashboard/media-providers/audio", label: "Audio", icon: Mic })}
                {renderNav({ href: "/dashboard/media-providers/video", label: "Video", icon: Film })}
              </div>
            </div>

            {/* Analytics Section */}
            <div className="px-2">
              <SectionHeader title="Analytics" count={analyticsNavItems.length} />
              <div className="mt-1 space-y-0.5">
                {analyticsNavItems.map((item) => renderNav(item))}
              </div>
            </div>

            {/* Tools Section */}
            <div className="px-2">
              <SectionHeader title="Tools" />
              <div className="mt-1 space-y-0.5">
                {toolsNavItems.map((item) => renderNav(item))}
                {renderNav({ href: "/dashboard/console-log", label: "Console", icon: FileCode })}
                {enableTranslator && renderNav({ href: "/dashboard/translator", label: "Translator", icon: Languages })}
              </div>
            </div>

            {/* System Section */}
            <div className="px-2">
              <SectionHeader title="System" />
              <div className="mt-1 space-y-0.5">
                {systemNavItems.map((item) => renderNav(item))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-sidebar-border space-y-2">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs text-muted-foreground">Running</span>
              </div>
              <span className="text-[11px] font-mono text-muted-foreground/70">v{version}</span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs text-muted-foreground justify-start px-2 hover:text-destructive"
              onClick={() => setShowShutdownModal(true)}
            >
              <Power className="h-3.5 w-3.5 mr-2" />
              Shutdown
            </Button>
          </div>
        </div>
      </TooltipProvider>

      {/* Shutdown Dialog */}
      <AlertDialog open={showShutdownModal} onOpenChange={setShowShutdownModal}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold">Shutdown server</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Stop the proxy server? All active connections will be dropped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-8 text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleShutdown}
              disabled={isShuttingDown}
              className="h-8 text-xs"
            >
              {isShuttingDown ? "Stopping..." : "Shutdown"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disconnected Screen */}
      {isDisconnected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
          <div className="text-center p-8 border border-border rounded-lg max-w-xs bg-card">
            <div className="flex items-center justify-center h-12 w-12 rounded-md bg-muted mx-auto mb-4">
              <Power className="h-5 w-5 text-muted-foreground" />
            </div>
            <h2 className="text-sm font-semibold mb-1 text-foreground">Disconnected</h2>
            <p className="text-xs text-muted-foreground mb-4">Server stopped</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => globalThis.location.reload()}
              className="h-8 text-xs"
            >
              Reload
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
