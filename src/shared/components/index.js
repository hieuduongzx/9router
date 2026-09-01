// Shared Components — public surface.
//
// Two tiers exist on purpose:
//   * `ui/*` is the shadcn primitive layer (Radix + cva). Import those directly
//     — `import { Button } from "@/shared/components/ui/button"` — which is the
//     shadcn convention and keeps tree-shaking honest.
//   * The wrappers re-exported below adapt this codebase's older prop shapes
//     (`isOpen`, `variant="primary"`, `icon="add"`) onto those primitives so the
//     existing markup keeps working. They are adapters, not a second design
//     system: don't add features to them, and prefer `ui/*` in new code.
//
// The two tiers share component names (`Button`, `Card`, `Badge`, …), so this
// barrel intentionally does NOT star-export `ui/*` — that would make every one
// of those names ambiguous.

// --- legacy adapters ---
export { default as Button } from "./Button";
export { default as Input } from "./Input";
export { default as Select } from "./Select";
export { default as Card } from "./Card";
export { default as Badge } from "./Badge";
export { default as Avatar } from "./Avatar";
export { default as Toggle } from "./Toggle";
export { default as Tooltip } from "./Tooltip";
export { default as Modal, ConfirmModal } from "./Modal";
export { default as Drawer } from "./Drawer";
export {
  default as Loading,
  Spinner,
  PageLoading,
  Skeleton,
  CardSkeleton,
  TableSkeleton,
} from "./Loading";

// --- primitives with no legacy counterpart, re-exported for convenience ---
// The shadcn Card slots are imported directly from "@/shared/components/ui/card"
// because the barrel already exports the legacy `Card` adapter and both names
// would collide.
export { Icon } from "./ui/icon";
export { Separator } from "./ui/separator";
export { Toaster } from "./ui/sonner";

// --- app components ---
export { default as EmptyState } from "./EmptyState";
export { default as ThemeToggle } from "./ThemeToggle";
export { ThemeProvider } from "./ThemeProvider";
export { default as Header } from "./Header";
export { default as OAuthModal } from "./OAuthModal";
export { default as ModelSelectModal } from "./ModelSelectModal";
export { default as ManualConfigModal } from "./ManualConfigModal";
export { default as ComboFormModal } from "./ComboFormModal";
export { default as McpMarketplaceModal } from "./McpMarketplaceModal";
export { default as UsageStats } from "./UsageStats";
export { default as LanguageSwitcher } from "./LanguageSwitcher";
export { default as RequestLogger } from "./RequestLogger";
export { default as RequestDetailDrawer } from "./RequestDetailDrawer";
export { default as KiroAuthModal } from "./KiroAuthModal";
export { default as KiroOAuthWrapper } from "./KiroOAuthWrapper";
export { default as KiroSocialOAuthModal } from "./KiroSocialOAuthModal";
export { default as CursorAuthModal } from "./CursorAuthModal";
export { default as IFlowCookieModal } from "./IFlowCookieModal";
export { default as GitLabAuthModal } from "./GitLabAuthModal";
export { default as EditConnectionModal } from "./EditConnectionModal";
export { default as AddCustomEmbeddingModal } from "./AddCustomEmbeddingModal";
export { default as NoAuthProxyCard } from "./NoAuthProxyCard";
export { default as SegmentedControl } from "./SegmentedControl";
export { default as ProviderInfoCard } from "./ProviderInfoCard";
export { default as CapacityBadges } from "./CapacityBadges";
export { default as SectionLabel } from "./SectionLabel";
export { default as CropFrame } from "./CropFrame";
export { default as TerminalBlock } from "./TerminalBlock";
export { default as StatTile } from "./StatTile";
export { default as StatusPill } from "./StatusPill";
export { default as MiniSparkline } from "./MiniSparkline";
export { default as MiniRing } from "./MiniRing";
export { default as PeriodDropdown } from "./PeriodDropdown";
export { default as CursorPagination } from "./CursorPagination";
export {
  default as RequestTableColumnSettings,
  useRequestTableColumns,
} from "./RequestTableColumnSettings";

// Layouts
export * from "./layouts";
