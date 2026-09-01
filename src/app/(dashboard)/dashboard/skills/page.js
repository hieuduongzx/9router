"use client";

import { Card, Badge } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import {
  SKILLS,
  SKILLS_REPO_URL,
  getSkillRawUrl,
  getSkillBlobUrl,
} from "@/shared/constants/skills";
import { Icon } from "@/shared/components/ui/icon";

function CopyButton({ value, label = "Copy link" }) {
  const { copied, copy } = useCopyToClipboard(2000);
  return (
    <button
      onClick={() => copy(value)}
      className="px-2 py-1 rounded-sm bg-primary text-white font-mono text-[11px] font-medium hover:bg-primary/90 transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1"
      title={value}
    >
      <Icon name={copied ? "check" : "content_copy"} className="size-[12px]" />
      {copied ? "Copied!" : label}
    </button>
  );
}

function SkillRow({ skill }) {
  const url = getSkillRawUrl(skill.id);
  return (
    <div
      className={`flex items-start gap-3 p-4 border transition-colors ${
        skill.isEntry
          ? "border-brand-500/40 bg-brand-500/5"
          : "border-border-subtle bg-surface hover:bg-surface-2"
      }`}
    >
      <div
        className={`size-9 flex items-center justify-center shrink-0 border ${
          skill.isEntry ? "border-primary bg-primary text-white" : "border-border bg-surface-2 text-foreground"
        }`}
      >
        <Icon name={skill.icon} className="size-[18px]" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-mono font-semibold text-sm text-foreground">{skill.name}</h3>
          {skill.isEntry && (
            <Badge variant="primary" size="sm">START HERE</Badge>
          )}
          {skill.endpoint && (
            <Badge variant="default" size="sm">
              <code className="text-[10px]">{skill.endpoint}</code>
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{skill.description}</p>
        <a
          href={getSkillBlobUrl(skill.id)}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-muted-foreground hover:text-primary mt-1 inline-flex items-center gap-1 break-all"
        >
          {url}
          <Icon name="open_in_new" className="size-[12px]" />
        </a>
      </div>

      <CopyButton value={url} />
    </div>
  );
}

export default function SkillsPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-6">
      <Card padding="md">
        <div className="text-xs text-muted-foreground mb-2">Paste this to your AI:</div>
        <div className="px-3 py-2 border border-border bg-surface-2 font-mono text-[12px] text-foreground">
          Read this skill and use it: {getSkillRawUrl("Router2k")}
        </div>
      </Card>

      <div className="space-y-2">
        {SKILLS.map((skill) => (
          <SkillRow key={skill.id} skill={skill} />
        ))}
      </div>

      <Card padding="md">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-mono text-sm font-semibold text-foreground">More on GitHub</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Browse source, README, and examples.
            </p>
          </div>
          <a
            href={`${SKILLS_REPO_URL}/tree/master/skills`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            <Icon name="open_in_new" className="size-[16px]" />
            View on GitHub
          </a>
        </div>
      </Card>
    </div>
  );
}
