import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SeverityBadge } from "../../components/SeverityBadge";
import { api } from "../../lib/api";

export const Route = createFileRoute("/admin/rules")({
  component: RulesPage,
});

interface Rule {
  id: string;
  name: string;
  category: string;
  severity: string;
  active: boolean;
  pattern?: string;
  description?: string;
}

function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const emptyRule: Rule = {
    id: "",
    name: "",
    category: "",
    severity: "medium",
    active: true,
    pattern: "{}",
    description: "",
  };

  useEffect(() => {
    loadRules();
  }, []);

  async function loadRules() {
    try {
      const result = await api<{ rules: Rule[] }>("/api/admin/rules");
      setRules(result.rules || []);
    } catch {
      // API may not be available
    } finally {
      setLoading(false);
    }
  }

  async function saveRule(rule: Rule) {
    try {
      if (rule.id) {
        await api(`/api/admin/rules/${rule.id}`, {
          method: "PUT",
          body: rule,
        });
      } else {
        await api("/api/admin/rules", {
          method: "POST",
          body: rule,
        });
      }
      setEditingRule(null);
      setShowCreate(false);
      loadRules();
    } catch {
      // handle error
    }
  }

  async function toggleActive(rule: Rule) {
    try {
      await api(`/api/admin/rules/${rule.id}`, {
        method: "PUT",
        body: { ...rule, active: !rule.active },
      });
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, active: !r.active } : r)),
      );
    } catch {
      // handle error
    }
  }

  const ruleBeingEdited = editingRule || (showCreate ? { ...emptyRule } : null);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-2xl font-bold text-zinc-100">
            Detection Rules
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Manage malware detection rules
          </p>
        </div>
        <button
          onClick={() => {
            setShowCreate(true);
            setEditingRule(null);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Create Rule
        </button>
      </div>

      {/* Edit/Create Form */}
      {ruleBeingEdited && (
        <RuleForm
          rule={ruleBeingEdited}
          onSave={saveRule}
          onCancel={() => {
            setEditingRule(null);
            setShowCreate(false);
          }}
        />
      )}

      {/* Rules Table */}
      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Name
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Category
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Severity
              </th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Active
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
            ) : rules.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-zinc-500">
                  No rules defined yet.
                </td>
              </tr>
            ) : (
              rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3">
                    <span className="font-medium text-zinc-200">
                      {rule.name}
                    </span>
                    {rule.description && (
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {rule.description}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-zinc-400">{rule.category}</td>
                  <td className="px-5 py-3">
                    <SeverityBadge severity={rule.severity} />
                  </td>
                  <td className="px-5 py-3 text-center">
                    <button
                      onClick={() => toggleActive(rule)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        rule.active ? "bg-accent" : "bg-zinc-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                          rule.active ? "translate-x-4.5" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => setEditingRule(rule)}
                      className="text-xs text-zinc-500 hover:text-accent transition-colors"
                    >
                      Edit
                    </button>
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

function RuleForm({
  rule,
  onSave,
  onCancel,
}: {
  rule: Rule;
  onSave: (rule: Rule) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(rule);

  return (
    <div className="glass rounded-xl p-6 mb-6 space-y-4">
      <h3 className="font-heading font-semibold text-zinc-200">
        {rule.id ? "Edit Rule" : "Create Rule"}
      </h3>

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
            Category
          </label>
          <input
            type="text"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent/50"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Severity
          </label>
          <select
            value={form.severity}
            onChange={(e) => setForm({ ...form, severity: e.target.value })}
            className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent/50"
          >
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="info">Info</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Description
          </label>
          <input
            type="text"
            value={form.description || ""}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent/50"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">
          Pattern (JSON)
        </label>
        <textarea
          value={form.pattern || "{}"}
          onChange={(e) => setForm({ ...form, pattern: e.target.value })}
          rows={6}
          className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-zinc-200 font-mono focus:outline-none focus:border-accent/50 resize-y"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => onSave(form)}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
        >
          {rule.id ? "Update" : "Create"}
        </button>
        <button
          onClick={onCancel}
          className="text-sm text-zinc-400 hover:text-zinc-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
