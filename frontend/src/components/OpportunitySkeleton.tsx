export function OpportunitySkeleton() {
  return (
    <div className="ticket-container flex flex-col sm:flex-row w-full animate-pulse">
      {/* Left Panel Skeleton */}
      <div className="flex-1 p-5 sm:p-6 space-y-4">
        <div className="flex justify-between items-start">
          <div className="h-6 bg-[var(--border)] rounded w-1/3" />
          <div className="h-5 bg-[var(--border)] rounded-full w-20" />
        </div>
        <div className="h-4 bg-[var(--border)] rounded w-1/2" />
        <div className="flex gap-2">
          <div className="h-6 bg-[var(--border)] rounded w-24" />
          <div className="h-6 bg-[var(--border)] rounded w-24" />
        </div>
        <div className="h-8 bg-[var(--border)] rounded w-28" />
      </div>

      {/* Perforation Divider */}
      <div className="relative hidden sm:block w-px my-2">
        <div className="perforation-line opacity-30" />
      </div>

      {/* Right Stub Skeleton */}
      <div className="w-full sm:w-44 bg-[var(--background)]/40 p-5 flex flex-col justify-between items-center space-y-4">
        <div className="h-4 bg-[var(--border)] rounded w-20" />
        <div className="h-8 bg-[var(--border)] rounded w-24" />
      </div>
    </div>
  );
}
