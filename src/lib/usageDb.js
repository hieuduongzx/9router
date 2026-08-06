// Shim → re-export from new SQLite-based DB layer (src/lib/db/)
export {
  statsEmitter, trackPendingRequest, getActiveRequests,
  saveRequestUsage, saveRequestFailure, getUsageHistory, getUsageStats, getSystemUsageOverview, getChartData,
  getUsageByOwner,
  appendRequestLog, getRecentLogs, getRequestLogsPage,
  saveRequestDetail, getRequestDetails, getRequestDetailById,
} from "@/lib/db/index.js";
