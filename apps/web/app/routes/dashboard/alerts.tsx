import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SeverityBadge } from "../../components/SeverityBadge";
import { ProGate } from "../../components/ProGate";
import { useSession } from "../../lib/auth-client";
import { api } from "../../lib/api";

export const Route = createFileRoute("/dashboard/alerts")({
  component: AlertsPage,
});

interface Alert {
  id: string;
  family: string;
  severity: string;
  title: string;
  description: string;
  createdAt: string;
}

function AlertsPage() {
  const { data: session } = useSession();
  const subscription =
    (session?.user as { subscription?: string } | undefined)?.subscription ||
    "free";
  const isPro = subscription === "pro";
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [familyFilter, setFamilyFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const params = new URLSearchParams();
        if (familyFilter) params.set("family", familyFilter);
        if (severityFilter) params.set("severity", severityFilter);
        const result = await api<{ alerts: Alert[] }>(
          `/api/alerts?${params.toString()}`,
        );
        setAlerts(result.alerts || []);
      } catch {
        // API may not be available
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [familyFilter, severityFilter]);

  const alertContent = (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={familyFilter}
          onChange={(e) => setFamilyFilter(e.target.value)}
          className="px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent/50"
        >
          <option value="">All families</option>
          <option value="backdoor">Backdoor</option>
          <option value="stealer">Stealer</option>
          <option value="miner">Miner</option>
          <option value="rat">RAT</option>
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent/50"
        >
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Alert Feed */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-zinc-500">No alerts matching your filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div key={alert.id} className="glass rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <SeverityBadge severity={alert.severity} />
                    <span className="text-xs text-zinc-500">
                      {new Date(alert.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-200">
                    {alert.title}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    {alert.description}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded bg-accent/10 text-xs text-accent font-medium">
                  {alert.family}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold text-zinc-100">
          Malware Alerts
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Threat intelligence feed for detected malware families
        </p>
      </div>

      <ProGate isPro={isPro} feature="Malware Alerts">
        {alertContent}
      </ProGate>
    </div>
  );
}
