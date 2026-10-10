export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream" role="status" aria-label="Loading">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-forest border-t-mustard" />
    </div>
  );
}
