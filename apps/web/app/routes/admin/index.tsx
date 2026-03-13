import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { StatCard } from "../../components/StatCard";
import { SeverityBadge } from "../../components/SeverityBadge";
import { api } from "../../lib/api";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

interface AdminStats {
  pendingReview: number;
  totalArtifacts: number;
  totalUsers: number;
  scansToday: number;
}

interface RecentVerdict {
  id: string;
  filename: string;
  verdict: string;
  severity: string;
  confidence: number;
  createdAt: string;
}

function AdminOverview() {
  const [stats, setStats] = useState<AdminStats>({
    pendingReview: 0,
    totalArtifacts: 0,
    totalUsers: 0,
    scansToday: 0,
  });
  const [recentVerdicts, setRecentVerdicts] = useState<RecentVerdict[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, verdictsRes] = await Promise.all([
          api<AdminStats>("/api/admin/stats"),
          api<{ verdicts: RecentVerdict[] }>("/api/admin/verdicts?limit=10"),
        ]);
        setStats(statsRes);
        setRecentVerdicts(verdictsRes.verdicts || []);
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
          Admin Dashboard
        </h1>
        <p className="text-sm text-zinc-400 mt-1">System overview and management</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
            </svg>
          }
          value={loading ? "..." : stats.pendingReview}
          label="Pending Review"
        />
        <StatCard
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          }
          value={loading ? "..." : stats.totalArtifacts}
          label="Total Artifacts"
        />
        <StatCard
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          }
          value={loading ? "..." : stats.totalUsers}
          label="Total Users"
        />
        <StatCard
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          }
          value={loading ? "..." : stats.scansToday}
          label="Scans Today"
        />
      </div>

      {/* Quick Links */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <Link
          to="/admin/queue"
          className="glass rounded-xl p-5 hover:bg-white/[0.07] transition-all group"
        >
          <h3 className="font-heading font-semibold text-zinc-200 group-hover:text-accent transition-colors">
            Review Queue
          </h3>
          <p className="text-sm text-zinc-500 mt-1">
            Review pending artifact verdicts
          </p>
        </Link>
        <Link
          to="/admin/rules"
          className="glass rounded-xl p-5 hover:bg-white/[0.07] transition-all group"
        >
          <h3 className="font-heading font-semibold text-zinc-200 group-hover:text-accent transition-colors">
            Rules
          </h3>
          <p className="text-sm text-zinc-500 mt-1">
            Manage detection rules
          </p>
        </Link>
        <Link
          to="/admin/intelligence"
          className="glass rounded-xl p-5 hover:bg-white/[0.07] transition-all group"
        >
          <h3 className="font-heading font-semibold text-zinc-200 group-hover:text-accent transition-colors">
            Intelligence
          </h3>
          <p className="text-sm text-zinc-500 mt-1">
            Manage threat intelligence data
          </p>
        </Link>
      </div>

      {/* Recent Verdicts */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h2 className="font-heading font-semibold text-zinc-200">
            Recent Verdicts
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Artifact
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Verdict
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Confidence
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Date
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
              ) : recentVerdicts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-zinc-500">
                    No verdicts yet
                  </td>
                </tr>
              ) : (
                recentVerdicts.map((v) => (
                  <tr key={v.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <Link
                        to="/admin/artifact/$artifactId"
                        params={{ artifactId: v.id }}
                        className="text-zinc-200 hover:text-accent transition-colors"
                      >
                        {v.filename}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <SeverityBadge severity={v.severity}>
                        {v.verdict}
                      </SeverityBadge>
                    </td>
                    <td className="px-5 py-3 text-zinc-400">{v.confidence}%</td>
                    <td className="px-5 py-3 text-zinc-400">
                      {new Date(v.createdAt).toLocaleDateString()}
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
