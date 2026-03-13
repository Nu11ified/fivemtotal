import { SeverityBadge } from "./SeverityBadge";

interface FindingCardProps {
  title: string;
  description: string;
  severity: string;
  evidence?: string;
  decodedContent?: string;
  ruleName?: string;
  filePath?: string;
}

export function FindingCard({
  title,
  description,
  severity,
  evidence,
  decodedContent,
  ruleName,
  filePath,
}: FindingCardProps) {
  return (
    <div className="glass rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-zinc-100">{title}</h4>
          <p className="text-xs text-zinc-400 mt-0.5">{description}</p>
        </div>
        <SeverityBadge severity={severity} />
      </div>

      {filePath && (
        <div className="text-xs text-zinc-500">
          <span className="font-mono">{filePath}</span>
        </div>
      )}

      {ruleName && (
        <div className="text-xs text-zinc-500">
          Rule: <span className="text-zinc-300">{ruleName}</span>
        </div>
      )}

      {evidence && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-zinc-400">Evidence</span>
          <pre className="bg-black/50 rounded-lg p-3 text-xs text-zinc-300 font-mono overflow-x-auto border border-white/5">
            {evidence}
          </pre>
        </div>
      )}

      {decodedContent && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-zinc-400">
            Decoded Content
          </span>
          <pre className="bg-black/50 rounded-lg p-3 text-xs text-severity-critical/80 font-mono overflow-x-auto border border-white/5">
            {decodedContent}
          </pre>
        </div>
      )}
    </div>
  );
}
