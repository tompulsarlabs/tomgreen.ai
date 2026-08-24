export function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-3xl font-semibold tracking-tight">{value}</span>
      <span className="text-sm text-ink-secondary">{label}</span>
    </div>
  );
}
