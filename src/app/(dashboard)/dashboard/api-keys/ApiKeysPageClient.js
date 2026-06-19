"use client";

import PropTypes from "prop-types";
import { useState, useEffect } from "react";
import { Card, Button, Input, Modal, CardSkeleton, Toggle } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

export default function ApiKeysPageClient() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState(null);
  const [requireApiKey, setRequireApiKey] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState(new Set());

  const { copied, copy } = useCopyToClipboard();

  useEffect(() => {
    fetchData();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setRequireApiKey(data.requireApiKey || false);
      }
    } catch (error) {
      console.log("Error loading settings:", error);
    }
  };

  const fetchData = async () => {
    try {
      const keysRes = await fetch("/api/keys");
      const keysData = await keysRes.json();
      if (keysRes.ok) {
        setKeys(keysData.keys || []);
      }
    } catch (error) {
      console.log("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequireApiKey = async (value) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requireApiKey: value }),
      });
      if (res.ok) setRequireApiKey(value);
    } catch (error) {
      console.log("Error updating requireApiKey:", error);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;

    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        setCreatedKey(data);
        setNewKeyName("");
        fetchData();
      }
    } catch (error) {
      console.log("Error creating key:", error);
    }
  };

  const handleDeleteKey = async (id) => {
    if (!confirm("Delete this API key?")) return;

    try {
      const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
      if (res.ok) {
        setKeys(keys.filter((k) => k.id !== id));
        setVisibleKeys(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    } catch (error) {
      console.log("Error deleting key:", error);
    }
  };

  const handleToggleKey = async (id, isActive) => {
    try {
      const res = await fetch(`/api/keys/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (res.ok) {
        setKeys(prev => prev.map(k => k.id === id ? { ...k, isActive } : k));
      }
    } catch (error) {
      console.log("Error toggling key:", error);
    }
  };

  const maskKey = (fullKey) => {
    if (!fullKey) return "";
    return fullKey.length > 12 ? fullKey.slice(0, 12) + "..." : fullKey;
  };

  const toggleKeyVisibility = (keyId) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(keyId)) next.delete(keyId);
      else next.add(keyId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="text-text-muted">Manage API keys for accessing the proxy</p>
        </div>
        <Button icon="add" onClick={() => setShowAddModal(true)}>
          Create Key
        </Button>
      </div>

      {/* Settings Card */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Require API key</p>
            <p className="text-sm text-text-muted">
              Requests without a valid key will be rejected
            </p>
          </div>
          <Toggle
            checked={requireApiKey}
            onChange={() => handleRequireApiKey(!requireApiKey)}
          />
        </div>
      </Card>

      {/* API Keys Table */}
      <Card>
        {keys.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
              <span className="material-symbols-outlined text-[32px]">vpn_key</span>
            </div>
            <p className="text-text-main font-medium mb-1">No API keys yet</p>
            <p className="text-sm text-text-muted mb-4">Create your first API key to get started</p>
            <Button icon="add" onClick={() => setShowAddModal(true)}>
              Create Key
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">
                    API Key
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Created
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {keys.map((key) => (
                  <tr 
                    key={key.id} 
                    className={`hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors ${key.isActive === false ? "opacity-60" : ""}`}
                  >
                    {/* Name Column */}
                    <td className="py-3 px-4">
                      <span className="font-medium text-sm">{key.name}</span>
                    </td>

                    {/* Value Column */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-text-muted bg-black/5 dark:bg-white/5 px-2 py-1 rounded">
                          {visibleKeys.has(key.id) ? key.key : maskKey(key.key)}
                        </code>
                        <button
                          onClick={() => toggleKeyVisibility(key.id)}
                          className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-muted hover:text-primary transition-colors"
                          title={visibleKeys.has(key.id) ? "Hide key" : "Show key"}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {visibleKeys.has(key.id) ? "visibility_off" : "visibility"}
                          </span>
                        </button>
                        <button
                          onClick={() => copy(key.key, key.id)}
                          className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-muted hover:text-primary transition-colors"
                          title="Copy key"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {copied === key.id ? "check" : "content_copy"}
                          </span>
                        </button>
                      </div>
                    </td>

                    {/* Created Date Column */}
                    <td className="py-3 px-4">
                      <span className="text-sm text-text-muted">
                        {new Date(key.createdAt).toLocaleDateString()}
                      </span>
                    </td>

                    {/* Toggle Column */}
                    <td className="py-3 px-4 text-center">
                      <Toggle
                        checked={key.isActive !== false}
                        onChange={() => handleToggleKey(key.id, key.isActive === false)}
                        size="sm"
                      />
                    </td>

                    {/* Actions Column */}
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="delete"
                        onClick={() => handleDeleteKey(key.id)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add Key Modal */}
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
            placeholder="e.g., Production, Development"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateKey()}
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              onClick={handleCreateKey}
              fullWidth
              disabled={!newKeyName.trim()}
            >
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

      {/* Created Key Modal */}
      <Modal
        isOpen={!!createdKey}
        title="API Key Created"
        onClose={() => setCreatedKey(null)}
      >
        <div className="flex flex-col gap-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-yellow-600 dark:text-yellow-400">warning</span>
              <div>
                <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-1">
                  Copy your API key now
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  You won&apos;t be able to see it again!
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Your API Key</label>
            <div className="flex gap-2">
              <Input
                value={createdKey?.key || ""}
                readOnly
                className="flex-1 font-mono text-sm"
              />
              <Button
                variant="secondary"
                icon={copied === createdKey?.id ? "check" : "content_copy"}
                onClick={() => copy(createdKey?.key, createdKey?.id)}
              >
                {copied === createdKey?.id ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>

          <Button onClick={() => setCreatedKey(null)} fullWidth>
            Done
          </Button>
        </div>
      </Modal>
    </div>
  );
}

ApiKeysPageClient.propTypes = {
  // No props needed for this component
};
