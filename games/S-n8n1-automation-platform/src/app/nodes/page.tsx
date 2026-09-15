"use client";

import { useEffect, useMemo, useState } from "react";
import type { CatalogEntry } from "@/lib/workflow/types";

export default function NodesCatalogPage() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [search, setSearch] = useState("");
  const [onlyExecutable, setOnlyExecutable] = useState(false);

  useEffect(() => {
    fetch("/api/nodes").then((r) => r.json()).then((d) => setCatalog(d.catalog || []));
  }, []);

  const filtered = useMemo(
    () =>
      catalog.filter(
        (c) =>
          (!onlyExecutable || c.executable) &&
          (c.name.toLowerCase().includes(search.toLowerCase()) || c.category.toLowerCase().includes(search.toLowerCase())),
      ),
    [catalog, search, onlyExecutable],
  );

  const executableCount = catalog.filter((c) => c.executable).length;

  const grouped = useMemo(() => {
    const map = new Map<string, CatalogEntry[]>();
    for (const c of filtered) {
      if (!map.has(c.category)) map.set(c.category, []);
      map.get(c.category)!.push(c);
    }
    return map;
  }, [filtered]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-white">کاتالوگ نودها</h1>
      <p className="mb-6 text-sm text-slate-400">
        {catalog.length} نود در کاتالوگ · {executableCount} مورد دارای اجرای واقعی (Executable) و بقیه به‌عنوان قالب آماده برای پیکربندی سریع با HTTP Request.
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="جست‌وجو..."
          className="w-72 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        />
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={onlyExecutable} onChange={(e) => setOnlyExecutable(e.target.checked)} />
          فقط نودهای اجراپذیر واقعی
        </label>
      </div>

      <div className="space-y-8">
        {Array.from(grouped.entries()).map(([category, items]) => (
          <div key={category}>
            <h2 className="mb-3 text-lg font-bold text-slate-200">{category}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <div key={item.type} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="font-semibold text-slate-100">{item.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.executable ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700/40 text-slate-400"}`}>
                      {item.executable ? "اجراپذیر" : "قالب آماده"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
