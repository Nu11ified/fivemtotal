import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { VerdictCard } from "../../../components/VerdictCard";
import { FileTree } from "../../../components/FileTree";
import { FindingCard } from "../../../components/FindingCard";
import { SeverityBadge } from "../../../components/SeverityBadge";
import { CodeViewer } from "../../../components/CodeViewer";
import { api } from "../../../lib/api";

export const Route = createFileRoute("/dashboard/scan/$scanId")({
  component: ScanDetailPage,
});

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

interface FileNode {
  name: string;
  path: string;
  severity?: string;
  children?: FileNode[];
  raw?: string;
  normalized?: string;
}

interface ScanDetail {
  id: string;
  originalFilename: string;
  status: string;
  verdict: string;
  severity: string;
  confidence: number;
  family?: string;
  createdAt: string;
  findings: Finding[];
  files: FileNode[];
  urls: string[];
  matchedRules: string[];
}

function ScanDetailPage() {
  const { scanId } = Route.useParams();
  const [scan, setScan] = useState<ScanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const result = await api<ScanDetail>(`/api/scans/${scanId}`);
        setScan(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load scan");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [scanId]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-zinc-800 rounded w-48" />
          <div className="h-4 bg-zinc-800 rounded w-96" />
          <div className="grid lg:grid-cols-3 gap-4 mt-8">
            <div className="h-48 bg-zinc-800 rounded-xl" />
            <div className="h-48 bg-zinc-800 rounded-xl lg:col-span-2" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !scan) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-severity-critical">{error || "Scan not found"}</p>
          <Link
            to="/dashboard/history"
            className="inline-block mt-4 text-sm text-accent hover:text-accent-hover"
          >
            Back to history
          </Link>
        </div>
      </div>
    );
  }

  const selectedFileData = scan.files?.find((f) => f.path === selectedFile);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold text-zinc-100">
              {scan.originalFilename}
            </h1>
            <SeverityBadge severity={scan.severity}>
              {scan.verdict}
            </SeverityBadge>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Scanned {new Date(scan.createdAt).toLocaleString()}
          </p>
        </div>
        <Link
          to="/dashboard/history"
          className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Back to history
        </Link>
      </div>

      {/* Verdict + File Tree row */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <VerdictCard
          verdict={scan.verdict}
          severity={scan.severity}
          confidence={scan.confidence}
          family={scan.family}
        />

        <div className="lg:col-span-2">
          {scan.files && scan.files.length > 0 ? (
            <FileTree
              files={scan.files}
              onFileSelect={setSelectedFile}
              selectedPath={selectedFile || undefined}
            />
          ) : (
            <div className="glass rounded-xl p-6 flex items-center justify-center h-full">
              <p className="text-sm text-zinc-500">No file tree data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Selected file code viewer */}
      {selectedFileData && (selectedFileData.raw || selectedFileData.normalized) && (
        <div className="mb-6">
          <CodeViewer
            raw={selectedFileData.raw || ""}
            normalized={selectedFileData.normalized}
            filename={selectedFileData.path}
          />
        </div>
      )}

      {/* Findings */}
      {scan.findings && scan.findings.length > 0 && (
        <div className="mb-6">
          <h2 className="font-heading text-lg font-semibold text-zinc-200 mb-4">
            Findings ({scan.findings.length})
          </h2>
          <div className="space-y-3">
            {scan.findings.map((finding) => (
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

      {/* Extracted URLs */}
      {scan.urls && scan.urls.length > 0 && (
        <div className="mb-6">
          <h2 className="font-heading text-lg font-semibold text-zinc-200 mb-4">
            Extracted URLs/Domains
          </h2>
          <div className="glass rounded-xl p-4">
            <ul className="space-y-2">
              {scan.urls.map((url, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-severity-critical" />
                  <code className="font-mono text-zinc-300">{url}</code>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Matched Rules */}
      {scan.matchedRules && scan.matchedRules.length > 0 && (
        <div className="mb-6">
          <h2 className="font-heading text-lg font-semibold text-zinc-200 mb-4">
            Matched Rules
          </h2>
          <div className="flex flex-wrap gap-2">
            {scan.matchedRules.map((rule, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-lg bg-accent/10 border border-accent/20 text-xs font-medium text-accent"
              >
                {rule}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
