"use client";
import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { NODE_CATALOG, getNodeDef as builtinDef, type NodeDef } from '@/lib/nodes/catalog';

const CatalogContext = createContext({ catalog: NODE_CATALOG, error: '', refresh: async () => {}, getNodeDef: builtinDef, defaultParams: (_type: string): Record<string, unknown> => ({}) });
export function NodeCatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<NodeDef[]>(NODE_CATALOG);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/nodes');
      if (!response.ok) throw new Error('کاتالوگ نودهای نصب‌شده بارگذاری نشد؛ schema دیتابیس را بررسی کنید');
      const result = await response.json();
      setCatalog(result.nodes); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'خطای کاتالوگ'); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const value = useMemo(() => {
    const map = new Map(catalog.map(d => [d.type, d]));
    const getNodeDef = (type: string) => map.get(type) ?? builtinDef(type);
    const defaultParams = (type: string) => Object.fromEntries(getNodeDef(type).params.filter(p => p.default !== undefined).map(p => [p.name, p.default]));
    return { catalog, error, refresh, getNodeDef, defaultParams };
  }, [catalog, error, refresh]);
  return <CatalogContext.Provider value={value}>{error && <div role="alert" className="bg-red-950 text-red-200 p-2 text-sm">{error}</div>}{children}</CatalogContext.Provider>;
}
export const useNodeCatalog = () => useContext(CatalogContext);
