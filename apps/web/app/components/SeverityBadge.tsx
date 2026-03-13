import type { ReactNode } from "react";

type Severity = "critical" | "high" | "medium" | "low" | "info" | "safe";

const severityConfig: Record<
  Severity,
  { bg: string; text: string; label: string }
> = {
  critical: {
    bg: "bg-severity-critical/20",
    text: "text-severity-critical",
    label: "Critical",
  },
  high: {
    bg: "bg-severity-high/20",
    text: "text-severity-high",
    label: "High",
  },
  medium: {
    bg: "bg-severity-medium/20",
    text: "text-severity-medium",
    label: "Medium",
  },
  low: {
    bg: "bg-severity-low/20",
    text: "text-severity-low",
    label: "Low",
  },
  info: {
    bg: "bg-severity-info/20",
    text: "text-severity-info",
    label: "Info",
  },
  safe: {
    bg: "bg-severity-safe/20",
    text: "text-severity-safe",
    label: "Safe",
  },
};

interface SeverityBadgeProps {
  severity: Severity | string;
  children?: ReactNode;
}

export function SeverityBadge({ severity, children }: SeverityBadgeProps) {
  const config = severityConfig[severity as Severity] || severityConfig.info;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.bg} ${config.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.text} bg-current`} />
      {children || config.label}
    </span>
  );
}
