import { getUsagePeriodLabel } from "@/shared/constants/usagePeriods";

/**
 * Time ranges the admin account endpoints accept.
 * Must stay in sync with VALID_PERIODS in src/app/api/users/**.
 */
export const ACCOUNT_PERIODS = [
  { value: "24h", label: getUsagePeriodLabel("24h") },
  { value: "7d", label: getUsagePeriodLabel("7d") },
  { value: "30d", label: getUsagePeriodLabel("30d") },
  { value: "all", label: "All time" },
];

export const DEFAULT_ACCOUNT_PERIOD = "30d";

export function accountPeriodLabel(value) {
  return ACCOUNT_PERIODS.find((period) => period.value === value)?.label || value;
}
