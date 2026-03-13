import { SeverityBadge } from "./SeverityBadge";

interface VerdictCardProps {
  verdict: string;
  severity: string;
  confidence: number;
  family?: string | null;
}

export function VerdictCard({
  verdict,
  severity,
  confidence,
  family,
}: VerdictCardProps) {
  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-heading font-semibold text-zinc-200">
          Verdict
        </h3>
        <SeverityBadge severity={severity} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400">Status</span>
          <span className="text-sm font-medium capitalize text-zinc-100">
            {verdict}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400">Confidence</span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${confidence}%` }}
              />
            </div>
            <span className="text-sm font-medium text-zinc-100">
              {confidence}%
            </span>
          </div>
        </div>

        {family && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">Malware Family</span>
            <span className="text-sm font-medium text-accent">{family}</span>
          </div>
        )}
      </div>
    </div>
  );
}
