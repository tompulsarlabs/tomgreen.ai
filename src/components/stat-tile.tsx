import { CountUp } from "./count-up";

export function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <CountUp value={value} className="text-3xl font-semibold tracking-tight" />
      <span className="text-sm text-ink-secondary">{label}</span>
    </div>
  );
}
