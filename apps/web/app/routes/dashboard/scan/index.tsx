import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { UploadZone } from "../../../components/UploadZone";
import { api } from "../../../lib/api";

export const Route = createFileRoute("/dashboard/scan/")({
  component: ScanUploadPage,
});

type ScanStatus = "idle" | "uploading" | "queued" | "processing" | "completed" | "failed";

interface ScanResult {
  id: string;
  status: string;
  verdict?: string;
  severity?: string;
  confidence?: number;
}

function ScanUploadPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");

  const pollScanStatus = useCallback(
    async (scanId: string) => {
      const maxAttempts = 60;
      let attempts = 0;

      const poll = async () => {
        try {
          const result = await api<ScanResult>(`/api/scans/${scanId}`);
          setScanResult(result);

          if (result.status === "completed" || result.status === "failed") {
            setStatus(result.status as ScanStatus);
            return;
          }

          setStatus(result.status as ScanStatus);
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(poll, 2000);
          }
        } catch {
          setError("Failed to check scan status");
          setStatus("failed");
        }
      };

      poll();
    },
    [],
  );

  const handleUpload = useCallback(
    async (file: File) => {
      setError("");
      setStatus("uploading");
      setProgress(0);

      try {
        // Simulate upload progress
        const progressInterval = setInterval(() => {
          setProgress((p) => {
            if (p >= 90) {
              clearInterval(progressInterval);
              return 90;
            }
            return p + 10;
          });
        }, 200);

        const formData = new FormData();
        formData.append("file", file);

        const result = await api<ScanResult>("/api/scans/upload", {
          method: "POST",
          body: formData,
        });

        clearInterval(progressInterval);
        setProgress(100);
        setScanResult(result);
        setStatus("queued");

        // Start polling
        pollScanStatus(result.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        setStatus("failed");
      }
    },
    [pollScanStatus],
  );

  const statusLabels: Record<ScanStatus, string> = {
    idle: "",
    uploading: "Uploading file...",
    queued: "Queued for scanning...",
    processing: "Analyzing resource...",
    completed: "Scan complete!",
    failed: "Scan failed",
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold text-zinc-100">
          Scan Resource
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Upload a FiveM resource archive to scan for malware
        </p>
      </div>

      {status === "idle" || status === "failed" ? (
        <>
          <UploadZone onUpload={handleUpload} />

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-severity-critical/10 border border-severity-critical/20 text-sm text-severity-critical">
              {error}
            </div>
          )}
        </>
      ) : (
        <div className="glass rounded-xl p-8 text-center space-y-6">
          {/* Status indicator */}
          <div className="space-y-4">
            {status === "uploading" && (
              <div className="mx-auto w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-accent animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
            )}

            {(status === "queued" || status === "processing") && (
              <div className="mx-auto w-16 h-16 rounded-2xl bg-severity-medium/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-severity-medium animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            )}

            {status === "completed" && (
              <div className="mx-auto w-16 h-16 rounded-2xl bg-severity-safe/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-severity-safe" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-zinc-200">
                {statusLabels[status]}
              </p>
              {status === "uploading" && (
                <div className="mt-3 w-48 mx-auto h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Status steps */}
          <div className="flex items-center justify-center gap-2 text-xs">
            <StatusStep label="Upload" active={status === "uploading"} completed={status !== "uploading"} />
            <StatusDivider />
            <StatusStep label="Queued" active={status === "queued"} completed={status === "processing" || status === "completed"} />
            <StatusDivider />
            <StatusStep label="Processing" active={status === "processing"} completed={status === "completed"} />
            <StatusDivider />
            <StatusStep label="Complete" active={status === "completed"} completed={false} />
          </div>

          {/* Result link */}
          {status === "completed" && scanResult && (
            <Link
              to="/dashboard/scan/$scanId"
              params={{ scanId: scanResult.id }}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
            >
              View Results
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function StatusStep({
  label,
  active,
  completed,
}: {
  label: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <span
      className={`px-2 py-1 rounded ${
        active
          ? "text-accent font-medium"
          : completed
            ? "text-zinc-400"
            : "text-zinc-600"
      }`}
    >
      {completed && !active && (
        <svg className="w-3 h-3 inline mr-1 text-severity-safe" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      )}
      {label}
    </span>
  );
}

function StatusDivider() {
  return <span className="text-zinc-700">/</span>;
}
