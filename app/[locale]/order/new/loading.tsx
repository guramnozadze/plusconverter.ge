export default function Loading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-5 w-2/3 rounded bg-black/10 dark:bg-white/10" />
      <div className="h-48 rounded-xl border border-black/10 dark:border-white/15" />
      <div className="h-12 rounded-lg bg-black/10 dark:bg-white/10" />
    </div>
  );
}
