"use client";

import { useState } from "react";
import { Card, ModelSelectModal, TerminalBlock } from "@/shared/components";
import { getProviderIconSrc, markProviderIconMissing } from "@/shared/utils/providerIcon";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import Image from "next/image";
import ApiKeySelect from "./ApiKeySelect";
import { Icon } from "@/shared/components/ui/icon";

export default function DefaultToolCard({ toolId, tool, isExpanded, onToggle, baseUrl, apiKeys, activeProviders = [], cloudEnabled = false }) {
  const [copiedField, setCopiedField] = useState(null);
  const [showModelModal, setShowModelModal] = useState(false);
  const [modelValue, setModelValue] = useState("");
  
  // Initialize state directly with computed value - no need for useEffect
  const [selectedApiKey, setSelectedApiKey] = useState(() => 
    apiKeys?.length > 0 ? apiKeys[0].key : ""
  );

  const replaceVars = (text) => {
    const keyToUse = (selectedApiKey && selectedApiKey.trim()) 
      ? selectedApiKey 
      : (!cloudEnabled ? "sk_9router" : "your-api-key");
    
    // Add /v1 suffix only if not already present (DRY - avoid duplicate)
    const normalizedBaseUrl = baseUrl || "http://localhost:20128";
    const baseUrlWithV1 = normalizedBaseUrl.endsWith("/v1") 
      ? normalizedBaseUrl 
      : `${normalizedBaseUrl}/v1`;
    
    return text
      .replace(/\{\{baseUrl\}\}/g, baseUrlWithV1)
      .replace(/\{\{apiKey\}\}/g, keyToUse)
      .replace(/\{\{model\}\}/g, modelValue || "provider/model-id");
  };

  const { copy: copyToClipboard } = useCopyToClipboard();

  const handleCopy = async (text, field) => {
    await copyToClipboard(replaceVars(text), `toolcard-${field}`);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSelectModel = (model) => {
    setModelValue(model.value);
  };

  const hasActiveProviders = activeProviders.length > 0;

  const renderApiKeySelector = () => (
    <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
      <ApiKeySelect value={selectedApiKey} onChange={setSelectedApiKey} apiKeys={apiKeys} cloudEnabled={cloudEnabled} className="flex-1" />
    </div>
  );

  const renderModelSelector = () => {
    return (
      <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
        <input
          type="text"
          value={modelValue}
          onChange={(e) => setModelValue(e.target.value)}
          placeholder="provider/model-id"
          className="w-full sm:w-auto flex-1 px-3 py-2 bg-bg-secondary rounded font-mono text-sm border border-border focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <button
          onClick={() => setShowModelModal(true)}
          disabled={!hasActiveProviders}
          className={`shrink-0 px-3 py-2 rounded border font-mono text-sm transition-colors ${
            hasActiveProviders
              ? "bg-bg-secondary border-border text-foreground hover:border-primary cursor-pointer"
              : "opacity-50 cursor-not-allowed border-border"
          }`}
        >
          Select Model
        </button>
        {modelValue && (
          <>
            <button
              onClick={() => handleCopy(modelValue, "model")}
              className="shrink-0 px-3 py-2 bg-bg-secondary hover:bg-bg-tertiary rounded border border-border transition-colors"
            >
              <Icon name={copiedField === "model" ? "check" : "content_copy"} className="size-[18px]" />
            </button>
            <button
              onClick={() => setModelValue("")}
              className="p-2 text-muted-foreground hover:text-destructive rounded transition-colors"
              title="Clear"
            >
              <Icon name="close" className="size-[18px]" />
            </button>
          </>
        )}
      </div>
    );
  };

  const renderNotes = () => {
    if (!tool.notes || tool.notes.length === 0) return null;
    
    return (
      <div className="flex flex-col gap-2 mb-4">
        {tool.notes.map((note, index) => {
          // Cloud-only tools remain unavailable until the hosted endpoint is enabled.
          if (note.type === "cloudCheck" && cloudEnabled) return null;

          const isWarning = note.type === "warning";
          const isError = note.type === "cloudCheck" && !cloudEnabled;
          
          let bgClass = "bg-info/10 border-info/30";
          let textClass = "text-info dark:text-info";
          let iconClass = "text-info";
          let icon = "info";
          
          if (isWarning) {
            bgClass = "bg-yellow-500/10 border-yellow-500/30";
            textClass = "text-yellow-600 dark:text-yellow-400";
            iconClass = "text-yellow-500";
            icon = "warning";
          } else if (isError) {
            bgClass = "bg-destructive/10 border-destructive/30";
            textClass = "text-destructive dark:text-destructive";
            iconClass = "text-destructive";
            icon = "error";
          }
          
          return (
            <div key={index} className={`flex items-start gap-3 p-3 border ${bgClass}`}>
              <Icon name={icon} className={`size-[18px] ${iconClass}`} />
              <p className={`text-sm ${textClass}`}>{note.text}</p>
            </div>
          );
        })}
      </div>
    );
  };

  const canShowGuide = () => {
    if (tool.requiresExternalUrl && !cloudEnabled) return false;
    if (tool.requiresCloud && !cloudEnabled) return false;
    return true;
  };

  const renderGuideSteps = () => {
    if (!tool.guideSteps) return <p className="text-muted-foreground text-sm">Coming soon...</p>;

    return (
      <div className="flex flex-col gap-4">
        {renderNotes()}
        {canShowGuide() && tool.guideSteps.map((item) => (
          <div key={item.step} className="flex items-start gap-4">
            <div className="flex size-8 shrink-0 items-center justify-center border border-border">
              <span className="step-index">{String(item.step).padStart(2, "0")}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-mono font-medium text-text">{item.title}</p>
              {item.desc && <p className="text-sm text-muted-foreground mt-0.5">{item.desc}</p>}
              {item.type === "apiKeySelector" && renderApiKeySelector()}
              {item.type === "modelSelector" && renderModelSelector()}
              {item.value && (
                item.copyable ? (
                  <div className="mt-2">
                    <TerminalBlock command={replaceVars(item.value)} />
                  </div>
                ) : (
                  <div className="mt-2">
                    <code className="w-full sm:w-auto flex-1 px-3 py-2 bg-bg-secondary text-sm font-mono border border-border truncate">
                      {replaceVars(item.value)}
                    </code>
                  </div>
                )
              )}
            </div>
          </div>
        ))}

        {canShowGuide() && tool.codeBlock && (
          <div className="terminal-block mt-2 rounded-sm px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground tracking-wide text-muted-foreground">{tool.codeBlock.language}</span>
              <button
                onClick={() => handleCopy(tool.codeBlock.code, "codeblock")}
                className="flex items-center gap-1 rounded-sm border border-white/15 px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-white/30 hover:text-white"
              >
                <Icon name={copiedField === "codeblock" ? "check" : "content_copy"} className="size-3.5" />
                {copiedField === "codeblock" ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="overflow-x-auto">
              <code className="text-sm font-mono whitespace-pre">{replaceVars(tool.codeBlock.code)}</code>
            </pre>
          </div>
        )}
      </div>
    );
  };

  const renderIcon = () => {
    if (tool.image) {
      return (
        <Image
          src={tool.image}
          alt={tool.name}
          width={32}
          height={32}
          className="size-8 object-contain"
          sizes="32px"
          onError={(e) => { e.target.style.display = "none"; }}
        loading="lazy"
        decoding="async"
        />
      );
    }
    if (tool.icon) {
      return <Icon name={tool.icon} className="size-5" style={{ color: tool.color }} />;
    }
    const iconSrc = getProviderIconSrc(toolId);
    if (!iconSrc) {
      return <span className="text-xs font-bold" style={{ color: tool.color }}>{(toolId || "?").slice(0, 2).toUpperCase()}</span>;
    }
    return (
      <Image
        src={iconSrc}
        alt={tool.name}
        width={32}
        height={32}
        className="size-8 object-contain"
        sizes="32px"
        onError={(e) => {
          markProviderIconMissing(toolId);
          e.target.style.display = "none";
        }}
      loading="lazy"
      decoding="async"
      />
    );
  };

  return (
    <Card padding="xs" className="overflow-hidden overflow-x-hidden">
      <div className="flex items-center justify-between hover:cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-3">
          <div className="size-8 flex items-center justify-center shrink-0">
            {renderIcon()}
          </div>
          <div className="min-w-0">
            <h3 className="font-mono font-medium text-sm">{tool.name}</h3>
            <p className="text-xs text-muted-foreground truncate">{tool.description}</p>
          </div>
        </div>
        <Icon name="expand_more" className={`text-muted-foreground size-[20px] transition-transform ${isExpanded ? "rotate-180" : ""}`} />
      </div>

      {isExpanded && (
        <div className="mt-6 pt-6 border-t border-border">
          {renderGuideSteps()}
        </div>
      )}

      {showModelModal && (
        <ModelSelectModal
          isOpen={showModelModal}
          onClose={() => setShowModelModal(false)}
          onSelect={handleSelectModel}
          selectedModel={modelValue}
          activeProviders={activeProviders}
          title="Select Model"
        />
      )}
    </Card>
  );
}

