"use client";

import PropTypes from "prop-types";
import StatTile from "@/shared/components/StatTile";

const fmt = (n) => new Intl.NumberFormat().format(n || 0);
const fmtCost = (n) => `$${(n || 0).toFixed(2)}`;

export default function OverviewCards({ stats }) {
  return (
    <div className="tile-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
      <StatTile chip="requests" label="Total Requests" value={fmt(stats.totalRequests)} />
      <StatTile chip="tokens" label="Input Tokens" value={fmt(stats.totalPromptTokens)} />
      <StatTile chip="info" label="Cached Tokens" value={fmt(stats.totalCachedTokens)} />
      <StatTile chip="cost" label="Output Tokens" value={fmt(stats.totalCompletionTokens)} />
      <StatTile
        chip="danger"
        label="Est. Cost"
        value={`~${fmtCost(stats.totalCost)}`}
        sub="Estimated, not actual billing"
      />
    </div>
  );
}

OverviewCards.propTypes = {
  stats: PropTypes.object.isRequired,
};
