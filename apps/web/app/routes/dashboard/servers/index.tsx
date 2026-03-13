import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ProGate } from "../../../components/ProGate";
import { useSession } from "../../../lib/auth-client";
import { api } from "../../../lib/api";

export const Route = createFileRoute("/dashboard/servers/")({
  component: ServersListPage,
});

interface Server {
  id: string;
  name: string;
  lastPolicyFetch: string | null;
  violationCount: number;
  active: boolean;
}

function ServersListPage() {
  const { data: session } = useSession();
  const subscription =
    (session?.user as { subscription?: string } | undefined)?.subscription ||
    "free";
  const isPro = subscription === "pro";
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await api<{ servers: Server[] }>("/api/servers");
        setServers(result.servers || []);
      } catch {
        // API may not be available
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const serversContent = (
    <div className="glass rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Server Name
            </th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Last Policy Fetch
            </th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Violations
            </th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Status
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
          ) : servers.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-5 py-8 text-center text-zinc-500">
                No connected servers. Create an API key and configure your server to connect.
              </td>
            </tr>
          ) : (
            servers.map((server) => (
              <tr key={server.id} className="hover:bg-white/[0.02]">
                <td className="px-5 py-3">
                  <Link
                    to="/dashboard/servers/$serverId"
                    params={{ serverId: server.id }}
                    className="font-medium text-zinc-200 hover:text-accent transition-colors"
                  >
                    {server.name}
                  </Link>
                </td>
                <td className="px-5 py-3 text-zinc-400">
                  {server.lastPolicyFetch
                    ? new Date(server.lastPolicyFetch).toLocaleString()
                    : "Never"}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`font-medium ${
                      server.violationCount > 0
                        ? "text-severity-critical"
                        : "text-zinc-400"
                    }`}
                  >
                    {server.violationCount}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                      server.active ? "text-severity-safe" : "text-zinc-500"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        server.active ? "bg-severity-safe" : "bg-zinc-600"
                      }`}
                    />
                    {server.active ? "Online" : "Offline"}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold text-zinc-100">
          Connected Servers
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Monitor your FiveM servers with Runtime Guard
        </p>
      </div>

      <ProGate isPro={isPro} feature="Server monitoring">
        {serversContent}
      </ProGate>
    </div>
  );
}
