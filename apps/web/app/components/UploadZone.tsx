import { useState, useRef, useCallback, type DragEvent } from "react";

interface UploadZoneProps {
  onUpload: (file: File) => void;
  accept?: string;
  isUploading?: boolean;
  progress?: number;
}

export function UploadZone({
  onUpload,
  accept = ".zip,.tar,.7z,.tar.gz",
  isUploading = false,
  progress = 0,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        onUpload(files[0]);
      }
    },
    [onUpload],
  );

  return (
    <div
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative glass rounded-xl p-12 text-center cursor-pointer transition-all duration-200 ${
        isDragging
          ? "border-accent bg-accent/5 scale-[1.01]"
          : "hover:bg-white/5"
      } ${isUploading ? "pointer-events-none" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
        }}
        className="hidden"
      />

      <div className="space-y-4">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-accent"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
        </div>

        {isUploading ? (
          <div className="space-y-2">
            <p className="text-sm text-zinc-300">Uploading...</p>
            <div className="w-48 mx-auto h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-zinc-500">{progress}%</p>
          </div>
        ) : (
          <>
            <div>
              <p className="text-sm font-medium text-zinc-200">
                Drop your resource archive here
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Supports .zip, .tar, .tar.gz, .7z
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
            >
              Browse Files
            </button>
          </>
        )}
      </div>
    </div>
  );
}
