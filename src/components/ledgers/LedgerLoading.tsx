export function LedgerLoading() {
  return (
    <div role="status" aria-label="正在加载台账" className="flex flex-col gap-3 rounded-xl border bg-card p-6">
      <p className="text-xs text-muted-foreground">正在加载台账…</p>
      {Array.from({ length: 10 }, (_, i) => <div key={i} className="h-8 animate-pulse rounded bg-muted motion-reduce:animate-none" />)}
    </div>
  );
}
