import { useState, useMemo, type ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  pageSize?: number;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  filterFn?: (row: T, query: string) => boolean;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  pageSize = 10,
  emptyMessage = "No data found",
  onRowClick,
  filterFn,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [filterQuery, setFilterQuery] = useState("");

  const filteredData = useMemo(() => {
    if (!filterQuery || !filterFn) return data;
    return data.filter((row) => filterFn(row, filterQuery));
  }, [data, filterQuery, filterFn]);

  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null || bVal == null) return 0;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredData, sortKey, sortDir]);

  const totalPages = Math.ceil(sortedData.length / pageSize);
  const pageData = sortedData.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-3">
      {filterFn && (
        <input
          type="text"
          placeholder="Filter..."
          value={filterQuery}
          onChange={(e) => {
            setFilterQuery(e.target.value);
            setPage(0);
          }}
          className="w-full sm:w-64 px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-accent/50"
        />
      )}

      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable && handleSort(col.key)}
                    className={`px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider ${
                      col.sortable
                        ? "cursor-pointer hover:text-zinc-200 select-none"
                        : ""
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      {col.header}
                      {col.sortable && sortKey === col.key && (
                        <span>{sortDir === "asc" ? "\u2191" : "\u2193"}</span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {pageData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-8 text-center text-zinc-500"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                pageData.map((row, i) => (
                  <tr
                    key={i}
                    onClick={() => onRowClick?.(row)}
                    className={`transition-colors ${
                      onRowClick
                        ? "cursor-pointer hover:bg-white/5"
                        : "hover:bg-white/[0.02]"
                    }`}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className="px-4 py-3 text-zinc-300 whitespace-nowrap"
                      >
                        {col.render
                          ? col.render(row)
                          : String(row[col.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <span className="text-xs text-zinc-500">
              Showing {page * pageSize + 1}-
              {Math.min((page + 1) * pageSize, sortedData.length)} of{" "}
              {sortedData.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2 py-1 text-xs rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-2 py-1 text-xs rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
