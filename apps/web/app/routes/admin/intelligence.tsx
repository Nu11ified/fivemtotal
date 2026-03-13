import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export const Route = createFileRoute("/admin/intelligence")({
  component: IntelligencePage,
});

interface HashReputation {
  id: string;
  sha256: string;
  type: string;
  list: string;
  family: string;
  source: string;
}

interface IocIndicator {
  id: string;
  type: string;
  value: string;
  family: string;
  confidence: number;
}

function IntelligencePage() {
  const [activeTab, setActiveTab] = useState<"hashes" | "iocs">("hashes");
  const [hashes, setHashes] = useState<HashReputation[]>([]);
  const [iocs, setIocs] = useState<IocIndicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHashForm, setShowHashForm] = useState(false);
  const [showIocForm, setShowIocForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [hashRes, iocRes] = await Promise.all([
        api<{ hashes: HashReputation[] }>("/api/admin/intelligence/hashes"),
        api<{ iocs: IocIndicator[] }>("/api/admin/intelligence/iocs"),
      ]);
      setHashes(hashRes.hashes || []);
      setIocs(iocRes.iocs || []);
    } catch {
      // API may not be available
    } finally {
      setLoading(false);
    }
  }

  async function createHash(data: Omit<HashReputation, "id">) {
    try {
      await api("/api/admin/intelligence/hashes", {
        method: "POST",
        body: data,
      });
      setShowHashForm(false);
      loadData();
    } catch {
      // handle error
    }
  }

  async function createIoc(data: Omit<IocIndicator, "id">) {
    try {
      await api("/api/admin/intelligence/iocs", {
        method: "POST",
        body: data,
      });
      setShowIocForm(false);
      loadData();
    } catch {
      // handle error
    }
  }

  async function deleteHash(id: string) {
    try {
      await api(`/api/admin/intelligence/hashes/${id}`, { method: "DELETE" });
      setHashes((prev) => prev.filter((h) => h.id !== id));
    } catch {
      // handle error
    }
  }

  async function deleteIoc(id: string) {
    try {
      await api(`/api/admin/intelligence/iocs/${id}`, { method: "DELETE" });
      setIocs((prev) => prev.filter((i) => i.id !== id));
    } catch {
      // handle error
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold text-zinc-100">
          Threat Intelligence
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Manage hash reputation lists and IOC indicators
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-black/30 rounded-lg p-1 w-fit mb-6">
        <button
          onClick={() => setActiveTab("hashes")}
          className={`px-4 py-2 text-sm rounded-md transition-colors ${
            activeTab === "hashes"
              ? "bg-white/10 text-zinc-100 font-medium"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Hash Reputation
        </button>
        <button
          onClick={() => setActiveTab("iocs")}
          className={`px-4 py-2 text-sm rounded-md transition-colors ${
            activeTab === "iocs"
              ? "bg-white/10 text-zinc-100 font-medium"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          IOC Indicators
        </button>
      </div>

      {activeTab === "hashes" ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg font-semibold text-zinc-200">
              Hash Reputation ({hashes.length})
            </h2>
            <button
              onClick={() => setShowHashForm(!showHashForm)}
              className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors"
            >
              Add Hash
            </button>
          </div>

          {showHashForm && (
            <HashForm
              onSave={createHash}
              onCancel={() => setShowHashForm(false)}
            />
          )}

          <div className="glass rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    SHA256
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    List
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Family
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-zinc-500">
                      Loading...
                    </td>
                  </tr>
                ) : hashes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-zinc-500">
                      No hash reputations defined yet.
                    </td>
                  </tr>
                ) : (
                  hashes.map((hash) => (
                    <tr key={hash.id} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-3 font-mono text-xs text-zinc-300 max-w-[200px] truncate">
                        {hash.sha256}
                      </td>
                      <td className="px-5 py-3 text-zinc-400">{hash.type}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            hash.list === "blacklist"
                              ? "bg-severity-critical/10 text-severity-critical"
                              : "bg-severity-safe/10 text-severity-safe"
                          }`}
                        >
                          {hash.list}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-accent">{hash.family}</td>
                      <td className="px-5 py-3 text-zinc-400">{hash.source}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => deleteHash(hash.id)}
                          className="text-xs text-zinc-500 hover:text-severity-critical transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg font-semibold text-zinc-200">
              IOC Indicators ({iocs.length})
            </h2>
            <button
              onClick={() => setShowIocForm(!showIocForm)}
              className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors"
            >
              Add IOC
            </button>
          </div>

          {showIocForm && (
            <IocForm
              onSave={createIoc}
              onCancel={() => setShowIocForm(false)}
            />
          )}

          <div className="glass rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Family
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Confidence
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
                ) : iocs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-zinc-500">
                      No IOC indicators defined yet.
                    </td>
                  </tr>
                ) : (
                  iocs.map((ioc) => (
                    <tr key={ioc.id} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-3 text-zinc-400">{ioc.type}</td>
                      <td className="px-5 py-3 font-mono text-xs text-zinc-300">
                        {ioc.value}
                      </td>
                      <td className="px-5 py-3 text-accent">{ioc.family}</td>
                      <td className="px-5 py-3 text-zinc-400">
                        {ioc.confidence}%
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => deleteIoc(ioc.id)}
                          className="text-xs text-zinc-500 hover:text-severity-critical transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function HashForm({
  onSave,
  onCancel,
}: {
  onSave: (d: Omit<HashReputation, "id">) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    sha256: "",
    type: "file",
    list: "blacklist",
    family: "",
    source: "",
  });

  return (
    <div className="glass rounded-xl p-4 mb-4 space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <input
          type="text"
          placeholder="SHA256 hash"
          value={form.sha256}
          onChange={(e) => setForm({ ...form, sha256: e.target.value })}
          className="px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent/50 font-mono"
        />
        <select
          value={form.list}
          onChange={(e) => setForm({ ...form, list: e.target.value })}
          className="px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent/50"
        >
          <option value="blacklist">Blacklist</option>
          <option value="whitelist">Whitelist</option>
        </select>
        <input
          type="text"
          placeholder="Family"
          value={form.family}
          onChange={(e) => setForm({ ...form, family: e.target.value })}
          className="px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent/50"
        />
      </div>
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Source"
          value={form.source}
          onChange={(e) => setForm({ ...form, source: e.target.value })}
          className="px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent/50"
        />
        <button
          onClick={() => onSave(form)}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
        >
          Add
        </button>
        <button onClick={onCancel} className="text-sm text-zinc-400">
          Cancel
        </button>
      </div>
    </div>
  );
}

function IocForm({
  onSave,
  onCancel,
}: {
  onSave: (d: Omit<IocIndicator, "id">) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    type: "domain",
    value: "",
    family: "",
    confidence: 80,
  });

  return (
    <div className="glass rounded-xl p-4 mb-4 space-y-3">
      <div className="grid sm:grid-cols-4 gap-3">
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent/50"
        >
          <option value="domain">Domain</option>
          <option value="ip">IP Address</option>
          <option value="url">URL</option>
          <option value="hash">Hash</option>
        </select>
        <input
          type="text"
          placeholder="Value"
          value={form.value}
          onChange={(e) => setForm({ ...form, value: e.target.value })}
          className="px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent/50 font-mono"
        />
        <input
          type="text"
          placeholder="Family"
          value={form.family}
          onChange={(e) => setForm({ ...form, family: e.target.value })}
          className="px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent/50"
        />
        <input
          type="number"
          placeholder="Confidence %"
          value={form.confidence}
          onChange={(e) =>
            setForm({ ...form, confidence: parseInt(e.target.value) || 0 })
          }
          className="px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent/50"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onSave(form)}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
        >
          Add
        </button>
        <button onClick={onCancel} className="text-sm text-zinc-400">
          Cancel
        </button>
      </div>
    </div>
  );
}
