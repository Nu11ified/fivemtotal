import type { ReactNode } from "react";

interface StatCardProps {
  icon: ReactNode;
  value: string | number;
  label: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
}

export function StatCard({
  icon,
  value,
  label,
  change,
  changeType = "neutral",
}: StatCardProps) {
  const changeColors = {
    positive: "text-severity-safe",
    negative: "text-severity-critical",
    neutral: "text-zinc-400",
  };

  return (
    <div className="glass rounded-xl p-5 group hover:bg-white/[0.07] transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className="p-2 rounded-lg bg-accent/10 text-accent">{icon}</div>
        {change && (
          <span className={`text-xs font-medium ${changeColors[changeType]}`}>
            {change}
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-heading font-bold text-zinc-100">
          {value}
        </p>
        <p className="text-sm text-zinc-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}
