"use client";
import { Icon } from "@/shared/components/ui/icon";


import PropTypes from "prop-types";

export default function SecurityWarning({ message }) {
  return <div role="alert" className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-400">
    <Icon name="warning" className="inline-block h-[1em] w-[1em] align-middle mt-0.5 shrink-0 text-[16px]" />
    <p className="flex-1 text-xs">{message}</p>
  </div>;
}

SecurityWarning.propTypes = { message: PropTypes.string.isRequired };
