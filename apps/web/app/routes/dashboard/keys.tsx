import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export const Route = createFileRoute("/dashboard/keys")({
  component: ApiKeysPage,
});

interface ApiKey {
  id: string;
  name: string;
  createdAt: string;
  dailyUsage: number;
  active: boolean;
}

function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadKeys();
  }, []);

  async function loadKeys() {
    try {
      const result = await api<{ keys: ApiKey[] }>("/api/keys");
      setKeys(result.keys || []);
    } catch {
      // API may not be available
    } finally {
      setLoading(false);
    }
  }

  async function createKey() {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const result = await api<{ key: string; id: string }>("/api/keys", {
        method: "POST",
        body: { name: newKeyName },
      });
      setRawKey(result.key);
      setNewKeyName("");
      loadKeys();
    } catch {
      // handle error
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: string) {
    try {
      await api(`/api/keys/${id}`, { method: "DELETE" });
      setKeys((prev) => prev.filter((k) => k.id !== id));
      setRevokeConfirm(null);
    } catch {
      // handle error
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-2xl font-bold text-zinc-100">
            API Keys
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Manage your API keys for CI/CD integration
          </p>
        </div>
        <button
          onClick={() => {
            setShowCreate(true);
            setRawKey(null);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Create Key
        </button>
      </div>

      {/* Create Key Modal */}
      {showCreate && (
        <div className="glass rounded-xl p-6 mb-6">
          {rawKey ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-severity-safe">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium">Key created successfully</span>
              </div>
              <div className="p-3 bg-black/50 rounded-lg border border-white/5">
                <p className="text-xs text-zinc-500 mb-1">
                  Copy this key now. You won&apos;t be able to see it again.
                </p>
                <code className="text-sm text-accent font-mono break-all">
                  {rawKey}
                </code>
              </div>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setRawKey(null);
                }}
                className="text-sm text-zinc-400 hover:text-zinc-200"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="font-heading font-semibold text-zinc-200">
                Create new API key
              </h3>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Key name
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., CI Pipeline, Server 1"
                  className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-accent/50"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={createKey}
                  disabled={creating || !newKeyName.trim()}
                  className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="text-sm text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Keys Table */}
      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Name
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Created
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Daily Usage
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-zinc-500">
                  Loading...
                </td>
              </tr>
            ) : keys.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-zinc-500">
                  No API keys yet. Create one to get started.
                </td>
              </tr>
            ) : (
              keys.map((key) => (
                <tr key={key.id} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3 font-medium text-zinc-200">
                    {key.name}
                  </td>
                  <td className="px-5 py-3 text-zinc-400">
                    {new Date(key.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-zinc-400">{key.dailyUsage}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                        key.active ? "text-severity-safe" : "text-zinc-500"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          key.active ? "bg-severity-safe" : "bg-zinc-600"
                        }`}
                      />
                      {key.active ? "Active" : "Revoked"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {key.active &&
                      (revokeConfirm === key.id ? (
                        <span className="inline-flex items-center gap-2">
                          <button
                            onClick={() => revokeKey(key.id)}
                            className="text-xs text-severity-critical hover:text-severity-critical/80"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setRevokeConfirm(null)}
                            className="text-xs text-zinc-500 hover:text-zinc-300"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setRevokeConfirm(key.id)}
                          className="text-xs text-zinc-500 hover:text-severity-critical transition-colors"
                        >
                          Revoke
                        </button>
                      ))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
