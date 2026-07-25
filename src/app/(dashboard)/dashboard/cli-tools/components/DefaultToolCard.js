"use client";

import { useState } from "react";
import { Card, ModelSelectModal, TerminalBlock } from "@/shared/components";
import { getProviderIconSrc, markProviderIconMissing } from "@/shared/utils/providerIcon";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import Image from "next/image";
import ApiKeySelect from "./ApiKeySelect";

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
              ? "bg-bg-secondary border-border text-text-main hover:border-primary cursor-pointer"
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
              <span className="material-symbols-outlined text-lg">
                {copiedField === "model" ? "check" : "content_copy"}
              </span>
            </button>
            <button
              onClick={() => setModelValue("")}
              className="p-2 text-text-muted hover:text-red-500 rounded transition-colors"
              title="Clear"
            >
              <span className="material-symbols-outlined text-lg">close</span>
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
          
          let bgClass = "bg-blue-500/10 border-blue-500/30";
          let textClass = "text-blue-600 dark:text-blue-400";
          let iconClass = "text-blue-500";
          let icon = "info";
          
          if (isWarning) {
            bgClass = "bg-yellow-500/10 border-yellow-500/30";
            textClass = "text-yellow-600 dark:text-yellow-400";
            iconClass = "text-yellow-500";
            icon = "warning";
          } else if (isError) {
            bgClass = "bg-red-500/10 border-red-500/30";
            textClass = "text-red-600 dark:text-red-400";
            iconClass = "text-red-500";
            icon = "error";
          }
          
          return (
            <div key={index} className={`flex items-start gap-3 p-3 border ${bgClass}`}>
              <span className={`material-symbols-outlined text-lg ${iconClass}`}>{icon}</span>
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
    if (!tool.guideSteps) return <p className="text-text-muted text-sm">Coming soon...</p>;

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
              {item.desc && <p className="text-sm text-text-muted mt-0.5">{item.desc}</p>}
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
              <span className="font-mono text-[11px] uppercase tracking-wide text-zinc-400">{tool.codeBlock.language}</span>
              <button
                onClick={() => handleCopy(tool.codeBlock.code, "codeblock")}
                className="flex items-center gap-1 rounded-sm border border-white/15 px-2 py-1 font-mono text-xs text-zinc-400 transition-colors hover:border-white/30 hover:text-white"
              >
                <span className="material-symbols-outlined text-sm">
                  {copiedField === "codeblock" ? "check" : "content_copy"}
                </span>
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
      return <span className="material-symbols-outlined text-xl" style={{ color: tool.color }}>{tool.icon}</span>;
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
            <p className="text-xs text-text-muted truncate">{tool.description}</p>
          </div>
        </div>
        <span className={`material-symbols-outlined text-text-muted text-[20px] transition-transform ${isExpanded ? "rotate-180" : ""}`}>expand_more</span>
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

