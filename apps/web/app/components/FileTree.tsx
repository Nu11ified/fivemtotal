import { useState } from "react";
import { SeverityBadge } from "./SeverityBadge";

interface FileNode {
  name: string;
  path: string;
  severity?: string;
  children?: FileNode[];
}

interface FileTreeProps {
  files: FileNode[];
  onFileSelect?: (path: string) => void;
  selectedPath?: string;
}

function FileTreeNode({
  node,
  depth,
  onFileSelect,
  selectedPath,
}: {
  node: FileNode;
  depth: number;
  onFileSelect?: (path: string) => void;
  selectedPath?: string;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedPath === node.path;

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) {
            setExpanded(!expanded);
          }
          onFileSelect?.(node.path);
        }}
        className={`flex items-center gap-2 w-full px-2 py-1 text-sm rounded-md hover:bg-white/5 transition-colors ${
          isSelected ? "bg-white/10 text-zinc-100" : "text-zinc-400"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <span className="text-zinc-500 w-4 text-center">
            {expanded ? "\u25BE" : "\u25B8"}
          </span>
        ) : (
          <span className="w-4 text-center text-zinc-600">\u2022</span>
        )}
        <span className="truncate flex-1 text-left">{node.name}</span>
        {node.severity && <SeverityBadge severity={node.severity} />}
      </button>

      {hasChildren && expanded && (
        <div>
          {node.children!.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onFileSelect={onFileSelect}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({ files, onFileSelect, selectedPath }: FileTreeProps) {
  return (
    <div className="glass rounded-xl p-3 overflow-auto max-h-96">
      <h4 className="text-sm font-semibold text-zinc-300 px-2 mb-2">
        File Tree
      </h4>
      {files.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          depth={0}
          onFileSelect={onFileSelect}
          selectedPath={selectedPath}
        />
      ))}
    </div>
  );
}
