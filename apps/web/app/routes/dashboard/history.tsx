import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DataTable, type Column } from "../../components/DataTable";
import { SeverityBadge } from "../../components/SeverityBadge";
import { api } from "../../lib/api";

export const Route = createFileRoute("/dashboard/history")({
  component: ScanHistoryPage,
});

interface ScanRecord {
  id: string;
  originalFilename: string;
  createdAt: string;
  verdict: string;
  severity: string;
  confidence: number;
  [key: string]: unknown;
}

function ScanHistoryPage() {
  const navigate = useNavigate();
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await api<{ scans: ScanRecord[] }>(
          "/api/scans?limit=100",
        );
        setScans(result.scans || []);
      } catch {
        // API may not be available
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const columns: Column<ScanRecord>[] = [
    {
      key: "originalFilename",
      header: "Filename",
      sortable: true,
      render: (row) => (
        <Link
          to="/dashboard/scan/$scanId"
          params={{ scanId: row.id }}
          className="text-zinc-200 hover:text-accent transition-colors font-medium"
        >
          {row.originalFilename}
        </Link>
      ),
    },
    {
      key: "createdAt",
      header: "Date",
      sortable: true,
      render: (row) => (
        <span className="text-zinc-400">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "verdict",
      header: "Verdict",
      sortable: true,
      render: (row) => (
        <SeverityBadge severity={row.severity || "info"}>
          {row.verdict}
        </SeverityBadge>
      ),
    },
    {
      key: "severity",
      header: "Severity",
      sortable: true,
      render: (row) => (
        <span className="capitalize text-zinc-300">{row.severity}</span>
      ),
    },
    {
      key: "confidence",
      header: "Confidence",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${row.confidence}%` }}
            />
          </div>
          <span className="text-xs text-zinc-400">{row.confidence}%</span>
        </div>
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
            Scan History
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            All your previous scans
          </p>
        </div>
        <Link
          to="/dashboard/scan/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
        >
          New Scan
        </Link>
      </div>

      <DataTable
        columns={columns}
        data={scans}
        pageSize={15}
        emptyMessage="No scans yet. Upload a resource to get started."
        onRowClick={(row) =>
          navigate({
            to: "/dashboard/scan/$scanId",
            params: { scanId: row.id },
          })
        }
        filterFn={(row, query) =>
          row.originalFilename.toLowerCase().includes(query.toLowerCase()) ||
          row.verdict.toLowerCase().includes(query.toLowerCase()) ||
          row.severity.toLowerCase().includes(query.toLowerCase())
        }
      />
    </div>
  );
}
