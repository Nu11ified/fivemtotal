import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DataTable, type Column } from "../../components/DataTable";
import { api } from "../../lib/api";

export const Route = createFileRoute("/admin/audit")({
  component: AuditLogPage,
});

interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  target: string;
  details: string;
  [key: string]: unknown;
}

function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await api<{ entries: AuditEntry[] }>(
          "/api/admin/audit?limit=200",
        );
        setEntries(result.entries || []);
      } catch {
        // API may not be available
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const columns: Column<AuditEntry>[] = [
    {
      key: "timestamp",
      header: "Time",
      sortable: true,
      render: (row) => (
        <span className="text-zinc-400 text-xs">
          {new Date(row.timestamp).toLocaleString()}
        </span>
      ),
    },
    {
      key: "user",
      header: "User",
      sortable: true,
      render: (row) => (
        <span className="text-zinc-200 font-medium">{row.user}</span>
      ),
    },
    {
      key: "action",
      header: "Action",
      sortable: true,
      render: (row) => (
        <span className="px-2 py-0.5 rounded bg-white/5 text-xs font-mono text-zinc-300">
          {row.action}
        </span>
      ),
    },
    {
      key: "target",
      header: "Target",
      sortable: true,
      render: (row) => (
        <span className="text-zinc-400 font-mono text-xs">{row.target}</span>
      ),
    },
    {
      key: "details",
      header: "Details",
      render: (row) => (
        <span className="text-zinc-500 text-xs max-w-xs truncate block">
          {row.details}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-zinc-800 rounded w-48" />
          <div className="h-64 bg-zinc-800 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold text-zinc-100">
          Audit Log
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Track all system actions and changes
        </p>
      </div>

      <DataTable
        columns={columns}
        data={entries}
        pageSize={25}
        emptyMessage="No audit entries found"
        filterFn={(row, query) => {
          const q = query.toLowerCase();
          return (
            row.user.toLowerCase().includes(q) ||
            row.action.toLowerCase().includes(q) ||
            row.target.toLowerCase().includes(q) ||
            row.details.toLowerCase().includes(q)
          );
        }}
      />
    </div>
  );
}
