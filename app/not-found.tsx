import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-card">
      <h1 className="text-xl font-bold">Job Not Found</h1>
      <p className="mt-2 text-sm text-zinc-600">The job may have been removed or merged during deduplication.</p>
      <Link href="/jobs" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
        Back to Jobs
      </Link>
    </div>
  );
}
