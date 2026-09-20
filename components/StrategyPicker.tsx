import Link from "next/link";

type Strategy = {
  name: string;
  description: string;
  liveHref?: string;
  historyHref?: string;
  comingSoon?: boolean;
};

const STRATEGIES: Strategy[] = [
  {
    name: "Short Trading",
    description: "Short at the open, add on every $5 drop, always close by end of day.",
    liveHref: "/strategy",
    historyHref: "/history",
  },
  {
    name: "End of Day",
    description: "Short a % of your holding at the open, cover it back at the close.",
    historyHref: "/history/end-of-day",
  },
  {
    name: "Covered Call",
    description: "Sell monthly calls 15–20% out of the money against your holding.",
    historyHref: "/history/covered-call",
  },
];

export default function StrategyPicker() {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
          Strategies
        </p>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-3">
        {STRATEGIES.map((s) => (
          <div
            key={s.name}
            className={`flex flex-col justify-between gap-3 rounded-md border p-4 ${
              s.comingSoon
                ? "border-dashed border-zinc-300 opacity-60 dark:border-zinc-700"
                : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <div>
              <p className="font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                {s.name}
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{s.description}</p>
            </div>
            {s.comingSoon ? (
              <span className="self-start rounded-full border border-zinc-300 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                Coming soon
              </span>
            ) : (
              <div className="flex gap-3 text-xs font-medium">
                {s.liveHref && (
                  <Link href={s.liveHref} className="text-sky-600 dark:text-sky-400">
                    Today →
                  </Link>
                )}
                {s.historyHref && (
                  <Link href={s.historyHref} className="text-sky-600 dark:text-sky-400">
                    History →
                  </Link>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
