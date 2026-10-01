"use client";
import { Icon } from "@/shared/components/ui/icon";


import PropTypes from "prop-types";
import { Input } from "@/shared/components";

export default function EndpointRow({ label, url, copyId, copied, onCopy }) {
  return <div className="flex items-center gap-2">
    <span className="min-w-[88px] shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-center font-mono text-xs text-text-muted">{label}</span>
    <Input value={url} readOnly className="flex-1 font-mono text-sm" />
    <button type="button" onClick={() => onCopy(url, copyId)} className="shrink-0 rounded p-2 text-text-muted transition-colors hover:bg-black/5 hover:text-primary dark:hover:bg-white/5" aria-label={`Copy ${label} endpoint`}>
      <Icon name={copied === copyId ? "check" : "content_copy"} className="inline-block h-[1em] w-[1em] align-middle text-[18px]" />
    </button>
  </div>;
}

EndpointRow.propTypes = {
  label: PropTypes.string.isRequired,
  url: PropTypes.string.isRequired,
  copyId: PropTypes.string.isRequired,
  copied: PropTypes.string,
  onCopy: PropTypes.func.isRequired,
};
