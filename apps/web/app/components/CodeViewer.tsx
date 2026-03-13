import { useState } from "react";

interface CodeViewerProps {
  raw: string;
  normalized?: string;
  filename?: string;
  language?: string;
}

export function CodeViewer({
  raw,
  normalized,
  filename,
}: CodeViewerProps) {
  const [view, setView] = useState<"raw" | "normalized">("raw");
  const hasBothViews = normalized !== undefined;

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
        {filename && (
          <span className="text-xs font-mono text-zinc-500">{filename}</span>
        )}
        {hasBothViews && (
          <div className="flex items-center gap-1 bg-black/30 rounded-lg p-0.5">
            <button
              onClick={() => setView("raw")}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                view === "raw"
                  ? "bg-white/10 text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Raw
            </button>
            <button
              onClick={() => setView("normalized")}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                view === "normalized"
                  ? "bg-white/10 text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Normalized
            </button>
          </div>
        )}
      </div>
      <pre className="p-4 text-xs font-mono text-zinc-300 overflow-auto max-h-96 leading-relaxed">
        <code>{view === "normalized" && normalized ? normalized : raw}</code>
      </pre>
    </div>
  );
}
