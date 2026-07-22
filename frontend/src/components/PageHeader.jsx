export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
      <div className="min-w-0">
        <h1 className="font-display text-2xl sm:text-3xl tracking-wide text-[#ffcc00]">{title}</h1>
        {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
      </div>
      {action && <div className="page-header-actions shrink-0 w-full sm:w-auto">{action}</div>}
    </div>
  );
}
