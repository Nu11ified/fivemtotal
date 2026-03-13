import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { VerdictCard } from "../../../components/VerdictCard";
import { FindingCard } from "../../../components/FindingCard";
import { SeverityBadge } from "../../../components/SeverityBadge";
import { CodeViewer } from "../../../components/CodeViewer";
import { api } from "../../../lib/api";

export const Route = createFileRoute("/admin/artifact/$artifactId")({
  component: ArtifactDetailPage,
});

interface VerdictHistory {
  verdict: string;
  severity: string;
  confidence: number;
  reviewer: string;
  timestamp: string;
  notes?: string;
}

interface Finding {
  id: string;
  title: string;
  description: string;
  severity: string;
  evidence?: string;
  decodedContent?: string;
  ruleName?: string;
  filePath?: string;
}

interface RelatedArtifact {
  id: string;
  filename: string;
  verdict: string;
  severity: string;
}

interface ArtifactDetail {
  id: string;
  filename: string;
  sha256: string;
  status: string;
  verdict: string;
  severity: string;
  confidence: number;
  family?: string;
  createdAt: string;
  findings: Finding[];
  verdictHistory: VerdictHistory[];
  relatedArtifacts: RelatedArtifact[];
  iocCrossRefs: string[];
  rawCode?: string;
  normalizedCode?: string;
  analystNotes?: string;
}

function ArtifactDetailPage() {
  const { artifactId } = Route.useParams();
  const [artifact, setArtifact] = useState<ArtifactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const result = await api<ArtifactDetail>(
          `/api/admin/artifacts/${artifactId}`,
        );
        setArtifact(result);
        setNotes(result.analystNotes || "");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load artifact",
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [artifactId]);

  async function saveNotes() {
    setSavingNotes(true);
    try {
      await api(`/api/admin/artifacts/${artifactId}/notes`, {
        method: "PUT",
        body: { notes },
      });
    } catch {
      // handle error
    } finally {
      setSavingNotes(false);
    }
  }

  async function performAction(action: string) {
    setActionLoading(action);
    try {
      await api(`/api/admin/artifacts/${artifactId}/action`, {
        method: "POST",
        body: { action },
      });
      // Reload artifact
      const result = await api<ArtifactDetail>(
        `/api/admin/artifacts/${artifactId}`,
      );
      setArtifact(result);
    } catch {
      // handle error
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-zinc-800 rounded w-48" />
          <div className="grid lg:grid-cols-3 gap-4 mt-8">
            <div className="h-48 bg-zinc-800 rounded-xl" />
            <div className="h-48 bg-zinc-800 rounded-xl lg:col-span-2" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !artifact) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-severity-critical">
            {error || "Artifact not found"}
          </p>
          <Link
            to="/admin/queue"
            className="inline-block mt-4 text-sm text-accent hover:text-accent-hover"
          >
            Back to queue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold text-zinc-100">
              {artifact.filename}
            </h1>
            <SeverityBadge severity={artifact.severity}>
              {artifact.verdict}
            </SeverityBadge>
          </div>
          <p className="text-xs text-zinc-500 font-mono mt-1">
            SHA256: {artifact.sha256}
          </p>
        </div>
        <Link
          to="/admin/queue"
          className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Back to queue
        </Link>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        {["blacklist", "warning", "safe", "release", "escalate"].map(
          (action) => (
            <button
              key={action}
              onClick={() => performAction(action)}
              disabled={actionLoading !== null}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                action === "blacklist"
                  ? "bg-severity-critical/10 text-severity-critical hover:bg-severity-critical/20 border border-severity-critical/20"
                  : action === "warning"
                    ? "bg-severity-medium/10 text-severity-medium hover:bg-severity-medium/20 border border-severity-medium/20"
                    : action === "safe"
                      ? "bg-severity-safe/10 text-severity-safe hover:bg-severity-safe/20 border border-severity-safe/20"
                      : "bg-white/5 text-zinc-400 hover:bg-white/10 border border-white/10"
              }`}
            >
              {actionLoading === action ? "..." : action.charAt(0).toUpperCase() + action.slice(1)}
            </button>
          ),
        )}
      </div>

      {/* Verdict + Findings layout */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <VerdictCard
          verdict={artifact.verdict}
          severity={artifact.severity}
          confidence={artifact.confidence}
          family={artifact.family}
        />

        {/* Verdict History */}
        <div className="lg:col-span-2 glass rounded-xl p-5">
          <h3 className="font-heading font-semibold text-zinc-200 mb-3">
            Verdict History
          </h3>
          {artifact.verdictHistory && artifact.verdictHistory.length > 0 ? (
            <div className="space-y-3">
              {artifact.verdictHistory.map((h, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 bg-black/20 rounded-lg"
                >
                  <SeverityBadge severity={h.severity}>{h.verdict}</SeverityBadge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <span>{h.reviewer}</span>
                      <span>&middot;</span>
                      <span>{new Date(h.timestamp).toLocaleString()}</span>
                    </div>
                    {h.notes && (
                      <p className="text-xs text-zinc-400 mt-1">{h.notes}</p>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500">{h.confidence}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No verdict history</p>
          )}
        </div>
      </div>

      {/* Code Viewer */}
      {(artifact.rawCode || artifact.normalizedCode) && (
        <div className="mb-6">
          <h2 className="font-heading text-lg font-semibold text-zinc-200 mb-4">
            Code Viewer
          </h2>
          <CodeViewer
            raw={artifact.rawCode || ""}
            normalized={artifact.normalizedCode}
            filename={artifact.filename}
          />
        </div>
      )}

      {/* Findings */}
      {artifact.findings && artifact.findings.length > 0 && (
        <div className="mb-6">
          <h2 className="font-heading text-lg font-semibold text-zinc-200 mb-4">
            Findings ({artifact.findings.length})
          </h2>
          <div className="space-y-3">
            {artifact.findings.map((finding) => (
              <FindingCard
                key={finding.id}
                title={finding.title}
                description={finding.description}
                severity={finding.severity}
                evidence={finding.evidence}
                decodedContent={finding.decodedContent}
                ruleName={finding.ruleName}
                filePath={finding.filePath}
              />
            ))}
          </div>
        </div>
      )}

      {/* Related Artifacts */}
      {artifact.relatedArtifacts && artifact.relatedArtifacts.length > 0 && (
        <div className="mb-6">
          <h2 className="font-heading text-lg font-semibold text-zinc-200 mb-4">
            Related Artifacts
          </h2>
          <div className="glass rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-white/5">
                {artifact.relatedArtifacts.map((rel) => (
                  <tr key={rel.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <Link
                        to="/admin/artifact/$artifactId"
                        params={{ artifactId: rel.id }}
                        className="text-zinc-200 hover:text-accent"
                      >
                        {rel.filename}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <SeverityBadge severity={rel.severity}>
                        {rel.verdict}
                      </SeverityBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* IOC Cross-References */}
      {artifact.iocCrossRefs && artifact.iocCrossRefs.length > 0 && (
        <div className="mb-6">
          <h2 className="font-heading text-lg font-semibold text-zinc-200 mb-4">
            IOC Cross-References
          </h2>
          <div className="flex flex-wrap gap-2">
            {artifact.iocCrossRefs.map((ioc, i) => (
              <code
                key={i}
                className="px-2 py-1 bg-black/30 rounded text-xs text-zinc-400 font-mono border border-white/5"
              >
                {ioc}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Analyst Notes */}
      <div className="glass rounded-xl p-5">
        <h3 className="font-heading font-semibold text-zinc-200 mb-3">
          Analyst Notes
        </h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-accent/50 resize-y"
          placeholder="Add analysis notes here..."
        />
        <button
          onClick={saveNotes}
          disabled={savingNotes}
          className="mt-3 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {savingNotes ? "Saving..." : "Save Notes"}
        </button>
      </div>
    </div>
  );
}
