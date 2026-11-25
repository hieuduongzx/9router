"use client";

import { useState } from "react";
import Modal from "./Modal";
import Button from "./Button";
import Badge from "./Badge";
import { Icon } from "./ui/icon";

const QUICK_THRESHOLDS = [60, 70, 75, 80, 85, 90];

export default function SmartPolicyModal({
  isOpen,
  onClose,
  comboName,
  currentPolicy = "smart",
  currentThreshold = 80,
  onSave,
}) {
  const [selectedPolicy, setSelectedPolicy] = useState(() => {
    const initialPolicy = currentPolicy || "smart";
    return initialPolicy.startsWith("smart-switch") ? "smart" : initialPolicy;
  });
  const [threshold, setThreshold] = useState(
    () => Math.round((currentThreshold || 0.8) * (currentThreshold <= 1 ? 100 : 1)) || 80,
  );

  const handleSave = () => {
    const finalThreshold = selectedPolicy === "custom"
      ? threshold / 100
      : selectedPolicy === "smart"
        ? 0.8
        : 0;

    onSave({
      smartPolicy: selectedPolicy,
      sessionSticky: selectedPolicy !== "per-turn",
      confidenceThreshold: finalThreshold,
    });
    onClose();
  };

  const policies = [
    {
      id: "smart",
      title: "Smart Switch",
      badge: "Adaptive ≥80%",
      badgeVariant: "success",
      icon: "auto_mode",
      recommended: true,
      desc: "Preserves warm prompt cache across turns. Seamlessly switches models if the conversation topic shifts with high confidence (≥80%).",
    },
    {
      id: "strict",
      title: "Strict Lock",
      badge: "1 Task = 1 Session",
      badgeVariant: "default",
      icon: "lock",
      desc: "Evaluates System One on turn 1, then locks that model for the entire session. Adds +0ms latency and zero extra router calls (100% prompt cache reuse).",
    },
    {
      id: "per-turn",
      title: "Per-Turn",
      badge: "Dynamic",
      badgeVariant: "default",
      icon: "refresh",
      desc: "Evaluates System One independently on every prompt without session stickiness.",
    },
    {
      id: "custom",
      title: "Custom Threshold",
      badge: `Adaptive ≥${threshold}%`,
      badgeVariant: "default",
      icon: "tune",
      desc: "Configure your own confidence threshold required to trigger a model switch.",
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Router Policy — ${comboName || "Combo"}`}
      description="Choose how the System One router manages model selection across conversation turns."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save Policy
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div role="radiogroup" aria-label="Routing policy" className="flex flex-col gap-2.5">
          {policies.map((p) => {
            const isSelected = selectedPolicy === p.id;
            return (
              <div
                key={p.id}
                role="radio"
                tabIndex={0}
                aria-checked={isSelected}
                onClick={() => setSelectedPolicy(p.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedPolicy(p.id);
                  }
                }}
                className={`relative flex cursor-pointer flex-col rounded-xl border p-3.5 outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring ${
                  isSelected
                    ? "border-primary bg-primary/[0.04] shadow-xs"
                    : "border-border hover:border-foreground/25 hover:bg-muted/30"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex size-4 shrink-0 items-center justify-center rounded-full border transition-all ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background"
                      }`}
                    >
                      {isSelected && <span className="size-1.5 rounded-full bg-primary-foreground" />}
                    </span>
                    <span className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground">
                      <Icon name={p.icon} className="size-4" />
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {p.title}
                    </span>
                    {p.recommended && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Recommended
                      </span>
                    )}
                  </div>
                  <Badge variant={p.badgeVariant} size="sm">
                    {p.badge}
                  </Badge>
                </div>

                <p className="mt-1.5 pl-6 text-xs leading-relaxed text-muted-foreground">
                  {p.desc}
                </p>

                {p.id === "custom" && isSelected && (
                  <div
                    className="mt-3 flex flex-col gap-2.5 border-t border-border/60 pl-6 pt-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-muted-foreground">Switch Confidence Threshold:</span>
                      <span className="font-mono text-sm font-semibold text-primary">{threshold}%</span>
                    </div>

                    <input
                      type="range"
                      min="50"
                      max="95"
                      step="1"
                      value={threshold}
                      onChange={(e) => setThreshold(Number(e.target.value))}
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
                    />

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="mr-1 text-[10px] text-muted-foreground">Presets:</span>
                      {QUICK_THRESHOLDS.map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setThreshold(pct)}
                          className={`cursor-pointer rounded px-2 py-0.5 font-mono text-[11px] transition-colors ${
                            threshold === pct
                              ? "bg-primary font-semibold text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/[0.03] p-3 text-xs">
          <Icon name="bolt" className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Prompt Cache Benefits: </span>
            Retaining the same model across session turns keeps upstream prompt caches warm,
            reducing input token costs by up to <strong className="text-foreground">90%</strong> and
            cutting latency in half (Claude Prompt Cache, DeepSeek KV-cache, Gemini Implicit Cache).
          </div>
        </div>
      </div>
    </Modal>
  );
}
