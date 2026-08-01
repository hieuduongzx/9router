"use client";

import PropTypes from "prop-types";
import StatTile from "@/shared/components/StatTile";

const fmt = (n) => new Intl.NumberFormat().format(n || 0);

/** Sub-cent spend must not collapse to "$0.00", so widen precision when tiny. */
const fmtCost = (n) => {
  const amount = Number(n) || 0;
  return `$${amount.toFixed(amount > 0 && amount < 0.01 ? 4 : 2)}`;
};

export default function OverviewCards({ stats }) {
  return (
    <div className="tile-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
      <StatTile chip="requests" label="Total Requests" value={fmt(stats.totalRequests)} />
      <StatTile chip="tokens" label="Input Tokens" value={fmt(stats.totalPromptTokens)} />
      <StatTile chip="tokens" label="Cached Tokens" value={fmt(stats.totalCachedTokens)} />
      <StatTile chip="tokens" label="Output Tokens" value={fmt(stats.totalCompletionTokens)} />
      <StatTile
        chip="cost"
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
