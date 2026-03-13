import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DataTable, type Column } from "../../components/DataTable";
import { SeverityBadge } from "../../components/SeverityBadge";
import { api } from "../../lib/api";

export const Route = createFileRoute("/admin/queue")({
  component: ReviewQueuePage,
});

interface QueueItem {
  id: string;
  filename: string;
  uploadDate: string;
  autoVerdict: string;
  severity: string;
  confidence: number;
  findingCount: number;
  assignedTo: string | null;
  [key: string]: unknown;
}

function ReviewQueuePage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      try {
        const result = await api<{ items: QueueItem[] }>("/api/admin/queue");
        setItems(result.items || []);
      } catch {
        // API may not be available
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  };

  async function bulkAction(action: string) {
    try {
      await api("/api/admin/queue/bulk", {
        method: "POST",
        body: { ids: [...selected], action },
      });
      setItems((prev) => prev.filter((i) => !selected.has(i.id)));
      setSelected(new Set());
    } catch {
      // handle error
    }
  }

  const columns: Column<QueueItem>[] = [
    {
      key: "_select",
      header: "",
      render: (row) => (
        <input
          type="checkbox"
          checked={selected.has(row.id)}
          onChange={() => toggleSelect(row.id)}
          className="rounded border-white/20 bg-black/30 text-accent focus:ring-accent/20"
        />
      ),
    },
    {
      key: "filename",
      header: "Artifact",
      sortable: true,
      render: (row) => (
        <Link
          to="/admin/artifact/$artifactId"
          params={{ artifactId: row.id }}
          className="text-zinc-200 hover:text-accent transition-colors font-medium"
        >
          {row.filename}
        </Link>
      ),
    },
    {
      key: "uploadDate",
      header: "Uploaded",
      sortable: true,
      render: (row) => (
        <span className="text-zinc-400">
          {new Date(row.uploadDate).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "severity",
      header: "Severity",
      sortable: true,
      render: (row) => (
        <SeverityBadge severity={row.severity}>
          {row.autoVerdict}
        </SeverityBadge>
      ),
    },
    {
      key: "confidence",
      header: "Confidence",
      sortable: true,
      render: (row) => <span className="text-zinc-400">{row.confidence}%</span>,
    },
    {
      key: "findingCount",
      header: "Findings",
      sortable: true,
      render: (row) => (
        <span className="text-zinc-400">{row.findingCount}</span>
      ),
    },
    {
      key: "assignedTo",
      header: "Reviewer",
      render: (row) => (
        <span className="text-zinc-500">
          {row.assignedTo || "Unassigned"}
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-2xl font-bold text-zinc-100">
            Review Queue
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {items.length} artifacts pending review
          </p>
        </div>
      </div>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div className="glass rounded-xl p-3 mb-4 flex items-center gap-3">
          <span className="text-sm text-zinc-400">
            {selected.size} selected
          </span>
          <button
            onClick={() => bulkAction("approve")}
            className="px-3 py-1.5 text-xs font-medium bg-severity-safe/10 text-severity-safe rounded-lg hover:bg-severity-safe/20 transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => bulkAction("blacklist")}
            className="px-3 py-1.5 text-xs font-medium bg-severity-critical/10 text-severity-critical rounded-lg hover:bg-severity-critical/20 transition-colors"
          >
            Blacklist
          </button>
          <button
            onClick={() => bulkAction("escalate")}
            className="px-3 py-1.5 text-xs font-medium bg-severity-medium/10 text-severity-medium rounded-lg hover:bg-severity-medium/20 transition-colors"
          >
            Escalate
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={items}
        pageSize={20}
        emptyMessage="No items in the review queue"
        onRowClick={(row) =>
          navigate({
            to: "/admin/artifact/$artifactId",
            params: { artifactId: row.id },
          })
        }
        filterFn={(row, query) =>
          row.filename.toLowerCase().includes(query.toLowerCase()) ||
          row.autoVerdict.toLowerCase().includes(query.toLowerCase())
        }
      />
    </div>
  );
}
