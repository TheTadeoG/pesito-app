export default function DashboardLoading() {
  return (
    <div
      aria-hidden
      className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-primary/15"
    >
      <div className="h-full w-1/3 animate-[loading-bar_1.1s_ease-in-out_infinite] rounded-full bg-primary" />
    </div>
  );
}
