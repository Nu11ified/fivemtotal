import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { StatCard } from "../../components/StatCard";
import { SeverityBadge } from "../../components/SeverityBadge";
import { api } from "../../lib/api";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardOverview,
});

interface DashboardStats {
  totalScans: number;
  maliciousFound: number;
  activeRules: number;
  connectedServers: number;
}

interface RecentScan {
  id: string;
  originalFilename: string;
  createdAt: string;
  verdict: string;
  severity: string;
  confidence: number;
}

function DashboardOverview() {
  const [stats, setStats] = useState<DashboardStats>({
    totalScans: 0,
    maliciousFound: 0,
    activeRules: 0,
    connectedServers: 0,
  });
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [scansRes] = await Promise.all([
          api<{ scans: RecentScan[]; total: number }>("/api/scans?limit=5"),
        ]);
        setRecentScans(scansRes.scans || []);
        setStats({
          totalScans: scansRes.total || 0,
          maliciousFound: (scansRes.scans || []).filter(
            (s) => s.verdict === "malicious",
          ).length,
          activeRules: 0,
          connectedServers: 0,
        });
      } catch {
        // API may not be available
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold text-zinc-100">
          Dashboard
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Overview of your scanning activity
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          }
          value={loading ? "..." : stats.totalScans}
          label="Total Scans"
        />
        <StatCard
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          }
          value={loading ? "..." : stats.maliciousFound}
          label="Malicious Found"
          changeType="negative"
        />
        <StatCard
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
          }
          value={loading ? "..." : stats.activeRules}
          label="Active Rules"
        />
        <StatCard
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
            </svg>
          }
          value={loading ? "..." : stats.connectedServers}
          label="Connected Servers"
        />
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 mb-8">
        <Link
          to="/dashboard/scan/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          New Scan
        </Link>
        <Link
          to="/dashboard/keys"
          className="inline-flex items-center gap-2 px-4 py-2 border border-white/10 text-zinc-300 text-sm font-medium rounded-lg hover:bg-white/5 transition-colors"
        >
          API Keys
        </Link>
        <Link
          to="/dashboard/history"
          className="inline-flex items-center gap-2 px-4 py-2 border border-white/10 text-zinc-300 text-sm font-medium rounded-lg hover:bg-white/5 transition-colors"
        >
          View History
        </Link>
      </div>

      {/* Recent Scans */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h2 className="font-heading font-semibold text-zinc-200">
            Recent Scans
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  File
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Verdict
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Confidence
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-zinc-500">
                    Loading...
                  </td>
                </tr>
              ) : recentScans.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-zinc-500">
                    No scans yet.{" "}
                    <Link to="/dashboard/scan/" className="text-accent hover:text-accent-hover">
                      Upload your first resource
                    </Link>
                  </td>
                </tr>
              ) : (
                recentScans.map((scan) => (
                  <tr key={scan.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <Link
                        to="/dashboard/scan/$scanId"
                        params={{ scanId: scan.id }}
                        className="text-zinc-200 hover:text-accent transition-colors"
                      >
                        {scan.originalFilename}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-zinc-400">
                      {new Date(scan.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <SeverityBadge severity={scan.severity || "info"}>
                        {scan.verdict}
                      </SeverityBadge>
                    </td>
                    <td className="px-5 py-3 text-zinc-400">
                      {scan.confidence}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
