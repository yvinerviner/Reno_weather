export default function StatTile({
  label,
  value,
  valueClassName = "text-zinc-800 dark:text-zinc-100",
  sub,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-center dark:border-zinc-800 dark:bg-zinc-900/60">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
        {label}
      </p>
      <p className={`mt-0.5 font-mono text-sm font-semibold tabular-nums ${valueClassName}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">{sub}</p>}
    </div>
  );
}
