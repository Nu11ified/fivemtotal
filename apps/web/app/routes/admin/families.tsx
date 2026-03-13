import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export const Route = createFileRoute("/admin/families")({
  component: FamiliesPage,
});

interface MalwareFamily {
  id: string;
  name: string;
  description: string;
  firstSeen: string;
  lastSeen: string;
}

function FamiliesPage() {
  const [families, setFamilies] = useState<MalwareFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MalwareFamily | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const emptyFamily: MalwareFamily = {
    id: "",
    name: "",
    description: "",
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
  };

  useEffect(() => {
    loadFamilies();
  }, []);

  async function loadFamilies() {
    try {
      const result = await api<{ families: MalwareFamily[] }>(
        "/api/admin/families",
      );
      setFamilies(result.families || []);
    } catch {
      // API may not be available
    } finally {
      setLoading(false);
    }
  }

  async function saveFamily(family: MalwareFamily) {
    try {
      if (family.id) {
        await api(`/api/admin/families/${family.id}`, {
          method: "PUT",
          body: family,
        });
      } else {
        await api("/api/admin/families", {
          method: "POST",
          body: family,
        });
      }
      setEditing(null);
      setShowCreate(false);
      loadFamilies();
    } catch {
      // handle error
    }
  }

  async function deleteFamily(id: string) {
    try {
      await api(`/api/admin/families/${id}`, { method: "DELETE" });
      setFamilies((prev) => prev.filter((f) => f.id !== id));
      setDeleteConfirm(null);
    } catch {
      // handle error
    }
  }

  const formTarget = editing || (showCreate ? { ...emptyFamily } : null);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-2xl font-bold text-zinc-100">
            Malware Families
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Track and manage known malware families
          </p>
        </div>
        <button
          onClick={() => {
            setShowCreate(true);
            setEditing(null);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Family
        </button>
      </div>

      {/* Form */}
      {formTarget && (
        <div className="glass rounded-xl p-6 mb-6 space-y-4">
          <h3 className="font-heading font-semibold text-zinc-200">
            {formTarget.id ? "Edit Family" : "Add Family"}
          </h3>
          <FamilyForm
            family={formTarget}
            onSave={saveFamily}
            onCancel={() => {
              setEditing(null);
              setShowCreate(false);
            }}
          />
        </div>
      )}

      {/* Table */}
      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Name
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Description
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                First Seen
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Last Seen
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
            ) : families.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-zinc-500">
                  No malware families defined yet.
                </td>
              </tr>
            ) : (
              families.map((family) => (
                <tr key={family.id} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3 font-medium text-accent">
                    {family.name}
                  </td>
                  <td className="px-5 py-3 text-zinc-400 max-w-xs truncate">
                    {family.description}
                  </td>
                  <td className="px-5 py-3 text-zinc-400">
                    {new Date(family.firstSeen).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-zinc-400">
                    {new Date(family.lastSeen).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-right space-x-3">
                    <button
                      onClick={() => setEditing(family)}
                      className="text-xs text-zinc-500 hover:text-accent transition-colors"
                    >
                      Edit
                    </button>
                    {deleteConfirm === family.id ? (
                      <span className="inline-flex items-center gap-2">
                        <button
                          onClick={() => deleteFamily(family.id)}
                          className="text-xs text-severity-critical"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="text-xs text-zinc-500"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(family.id)}
                        className="text-xs text-zinc-500 hover:text-severity-critical transition-colors"
                      >
                        Delete
                      </button>
                    )}
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

function FamilyForm({
  family,
  onSave,
  onCancel,
}: {
  family: MalwareFamily;
  onSave: (f: MalwareFamily) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(family);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Name
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Description
          </label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent/50"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onSave(form)}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
        >
          {family.id ? "Update" : "Create"}
        </button>
        <button onClick={onCancel} className="text-sm text-zinc-400 hover:text-zinc-200">
          Cancel
        </button>
      </div>
    </div>
  );
}
