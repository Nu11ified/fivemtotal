import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SeverityBadge } from "../../../components/SeverityBadge";
import { api } from "../../../lib/api";

export const Route = createFileRoute("/dashboard/servers/$serverId")({
  component: ServerDetailPage,
});

interface Violation {
  id: string;
  resourceName: string;
  type: string;
  severity: string;
  detail: string;
  createdAt: string;
}

interface ServerPolicy {
  id: string;
  resourceName: string;
  allowHttp: boolean;
  allowLoadstring: boolean;
  allowFileOps: boolean;
}

interface ServerDetail {
  id: string;
  name: string;
  lastPolicyFetch: string | null;
  violationCount: number;
  active: boolean;
  violations: Violation[];
  policies: ServerPolicy[];
}

function ServerDetailPage() {
  const { serverId } = Route.useParams();
  const [server, setServer] = useState<ServerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const result = await api<ServerDetail>(`/api/servers/${serverId}`);
        setServer(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load server");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [serverId]);

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

  if (error || !server) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-severity-critical">{error || "Server not found"}</p>
          <Link
            to="/dashboard/servers/"
            className="inline-block mt-4 text-sm text-accent hover:text-accent-hover"
          >
            Back to servers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-heading text-2xl font-bold text-zinc-100">
            {server.name}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Last policy fetch:{" "}
            {server.lastPolicyFetch
              ? new Date(server.lastPolicyFetch).toLocaleString()
              : "Never"}
          </p>
        </div>
        <Link
          to="/dashboard/servers/"
          className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Back to servers
        </Link>
      </div>

      {/* Policy Config */}
      <div className="mb-8">
        <h2 className="font-heading text-lg font-semibold text-zinc-200 mb-4">
          Resource Policies
        </h2>
        {server.policies && server.policies.length > 0 ? (
          <div className="glass rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Resource
                  </th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    HTTP
                  </th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Loadstring
                  </th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    File Ops
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {server.policies.map((policy) => (
                  <tr key={policy.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3 font-medium text-zinc-200">
                      {policy.resourceName}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <PolicyToggle enabled={policy.allowHttp} />
                    </td>
                    <td className="px-5 py-3 text-center">
                      <PolicyToggle enabled={policy.allowLoadstring} />
                    </td>
                    <td className="px-5 py-3 text-center">
                      <PolicyToggle enabled={policy.allowFileOps} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="glass rounded-xl p-6 text-center text-zinc-500">
            No policies configured yet.
          </div>
        )}
      </div>

      {/* Violation Timeline */}
      <div>
        <h2 className="font-heading text-lg font-semibold text-zinc-200 mb-4">
          Violation Timeline
        </h2>
        {server.violations && server.violations.length > 0 ? (
          <div className="space-y-3">
            {server.violations.map((violation) => (
              <div key={violation.id} className="glass rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <SeverityBadge severity={violation.severity} />
                      <span className="text-xs text-zinc-500">
                        {new Date(violation.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-300">
                      <span className="font-medium text-zinc-200">
                        {violation.resourceName}
                      </span>{" "}
                      - {violation.type}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {violation.detail}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass rounded-xl p-6 text-center text-zinc-500">
            No violations recorded.
          </div>
        )}
      </div>
    </div>
  );
}

function PolicyToggle({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded ${
        enabled
          ? "bg-severity-safe/10 text-severity-safe"
          : "bg-severity-critical/10 text-severity-critical"
      }`}
    >
      {enabled ? (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
    </span>
  );
}
