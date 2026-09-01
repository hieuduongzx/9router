"use client";

import { useState, useEffect } from "react";
import { Card, Button, Input, Modal, CardSkeleton, ConfirmModal } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { Icon } from "@/shared/components/ui/icon";

function maskKey(fullKey) {
  if (!fullKey || fullKey.length <= 10) return fullKey || "";
  return fullKey.slice(0, 6) + "•".repeat(fullKey.length - 10) + fullKey.slice(-4);
}

export default function ApiKeysPageClient() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [visibleKeys, setVisibleKeys] = useState(new Set());
  const { copied, copy } = useCopyToClipboard();

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/keys");
        if (response.ok) {
          const data = await response.json();
          setKeys(data.keys || []);
        }
      } catch (error) {
        console.log("Error loading API keys page:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);


  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName }),
      });
      const data = await res.json();
      if (res.ok) {
        setCreatedKey(data.key);
        const keysRes = await fetch("/api/keys");
        if (keysRes.ok) {
          const kd = await keysRes.json();
          setKeys(kd.keys || []);
        }
        setNewKeyName("");
        setShowAddModal(false);
      }
    } catch (error) {
      console.log("Error creating key:", error);
    }
  };

  const handleDeleteKey = async (id) => {
    setConfirmState({
      title: "Delete API Key",
      message: "Delete this API key?",
      onConfirm: async () => {
        setConfirmState(null);
        try {
          const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
          if (res.ok) {
            setKeys((prev) => prev.filter((k) => k.id !== id));
            setVisibleKeys((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
          }
        } catch (error) {
          console.log("Error deleting key:", error);
        }
      },
    });
  };

  const handleToggleKey = async (id, isActive) => {
    try {
      const res = await fetch(`/api/keys/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (res.ok) {
        setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, isActive } : k)));
      }
    } catch (error) {
      console.log("Error toggling key:", error);
    }
  };

  const toggleKeyVisibility = (keyId) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(keyId)) next.delete(keyId);
      else next.add(keyId);
      return next;
    });
  };

  const activeKeyCount = keys.filter((key) => key.isActive !== false).length;

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card id="api-keys" padding="none" className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <div className="flex items-center gap-2">
              <Icon name="vpn_key" className="size-[20px] text-primary" />
              <h2 className="font-mono text-sm font-semibold text-foreground">API keys</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Every AI request must include an active key.
            </p>
          </div>
          <Button icon="add" onClick={() => setShowAddModal(true)}>
            Create key
          </Button>
        </div>

        {keys.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border bg-bg-alt px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
            <span><strong className="font-mono font-semibold text-foreground">{keys.length}</strong> total</span>
            <span><strong className="font-mono font-semibold text-success">{activeKeyCount}</strong> active</span>
            <span><strong className="font-mono font-semibold text-foreground">{keys.length - activeKeyCount}</strong> paused</span>
          </div>
        )}

        {keys.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="mb-4 inline-flex size-12 items-center justify-center border border-border bg-surface-2 text-foreground">
              <Icon name="vpn_key" className="size-[26px]" />
            </div>
            <p className="mb-1 font-medium text-foreground">No API keys yet</p>
            <p className="mb-4 text-sm text-muted-foreground">
              Create a key before sending your first AI request.
            </p>
            <Button icon="add" onClick={() => setShowAddModal(true)}>
              Create key
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] table-fixed text-left text-sm">
              <thead className="thead-data">
                <tr>
                  <th className="w-[22%] px-4 py-2.5 font-medium sm:px-5">Name</th>
                  <th className="w-[36%] px-4 py-2.5 font-medium">Key</th>
                  <th className="w-[16%] px-4 py-2.5 font-medium">Created</th>
                  <th className="w-[12%] px-4 py-2.5 font-medium">Status</th>
                  <th className="w-[14%] px-4 py-2.5 text-right font-medium sm:px-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {keys.map((key) => {
                  const isActive = key.isActive !== false;
                  const isVisible = visibleKeys.has(key.id);
                  return (
                    <tr
                      key={key.id}
                      className={`transition-colors hover:bg-primary/[0.03] ${isActive ? "" : "bg-bg-alt/40"}`}
                    >
                      <td className="px-4 py-3 sm:px-5">
                        <span className={`block truncate font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`} title={key.name}>
                          {key.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-1">
                          <code className="block min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground" title={isVisible ? key.key : undefined}>
                            {isVisible ? key.key : maskKey(key.key)}
                          </code>
                          <button
                            type="button"
                            onClick={() => toggleKeyVisibility(key.id)}
                            className="inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                            title={isVisible ? "Hide key" : "Show key"}
                            aria-label={isVisible ? `Hide ${key.name}` : `Show ${key.name}`}
                          >
                            <Icon name={isVisible ? "visibility_off" : "visibility"} className="size-[16px]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => copy(key.key, key.id)}
                            className="inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                            title="Copy key"
                            aria-label={`Copy ${key.name}`}
                          >
                            <Icon name={copied === key.id ? "check" : "content_copy"} className="size-[16px]" />
                          </button>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                        {new Date(key.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 font-mono text-xs font-medium uppercase tracking-wide ${
                          isActive ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                        }`}>
                          <span className={`size-1.5 ${isActive ? "bg-success" : "bg-warning"}`} />
                          {isActive ? "Active" : "Paused"}
                        </span>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (isActive) {
                                setConfirmState({
                                  title: "Pause API Key",
                                  message: `Pause API key "${key.name}"?\n\nThis key will stop working immediately but can be resumed later.`,
                                  onConfirm: async () => {
                                    setConfirmState(null);
                                    handleToggleKey(key.id, false);
                                  },
                                });
                              } else {
                                handleToggleKey(key.id, true);
                              }
                            }}
                            className="inline-flex size-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                            title={isActive ? "Pause key" : "Resume key"}
                            aria-label={isActive ? `Pause ${key.name}` : `Resume ${key.name}`}
                          >
                            <Icon name={isActive ? "pause_circle" : "play_circle"} className="size-[18px]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteKey(key.id)}
                            className="inline-flex size-8 items-center justify-center rounded-sm text-error transition-colors hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/30"
                            title="Delete key"
                            aria-label={`Delete ${key.name}`}
                          >
                            <Icon name="delete" className="size-[18px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={showAddModal}
        title="Create API Key"
        onClose={() => {
          setShowAddModal(false);
          setNewKeyName("");
        }}
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Key Name"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Production Key"
          />
          <div className="flex gap-2">
            <Button onClick={handleCreateKey} fullWidth disabled={!newKeyName.trim()}>
              Create
            </Button>
            <Button
              onClick={() => {
                setShowAddModal(false);
                setNewKeyName("");
              }}
              variant="ghost"
              fullWidth
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!createdKey}
        title="API Key Created"
        onClose={() => setCreatedKey(null)}
      >
        <div className="flex flex-col gap-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2 font-medium">
              Save this key now!
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              This is the only time you will see this key. Store it securely.
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              value={createdKey || ""}
              readOnly
              className="flex-1 font-mono text-sm"
            />
            <Button
              variant="secondary"
              icon={copied === "created_key" ? "check" : "content_copy"}
              onClick={() => copy(createdKey, "created_key")}
            >
              {copied === "created_key" ? "Copied!" : "Copy"}
            </Button>
          </div>
          <Button onClick={() => setCreatedKey(null)} fullWidth>
            Done
          </Button>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!confirmState}
        onClose={() => setConfirmState(null)}
        onConfirm={confirmState?.onConfirm}
        title={confirmState?.title || "Confirm"}
        message={confirmState?.message}
        variant="danger"
      />
    </div>
  );
}
