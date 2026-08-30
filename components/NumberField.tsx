export default function NumberField({
  label,
  value,
  onChange,
  min = 0.01,
  step,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
      {label}
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || min)}
        className="w-24 rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-sm tabular-nums text-zinc-800 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500"
      />
    </label>
  );
}
