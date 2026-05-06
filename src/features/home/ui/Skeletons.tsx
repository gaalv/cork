export function HomeSkeletons() {
  return (
    <div role="status" aria-label="Loading home" className="space-y-6">
      <SkeletonBlock className="h-40 rounded-3xl" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <SkeletonBlock key={index} className="h-36 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse bg-[var(--color-noxe-panel-2)] ${className}`} />;
}
