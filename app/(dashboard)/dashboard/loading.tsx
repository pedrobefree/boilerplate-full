export default function DashboardLoading() {
    return (
        <div className="space-y-8 lg:space-y-12 animate-pulse">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-2 border-b border-gray-100">
                <div className="space-y-2">
                    <div className="h-3 w-32 bg-gray-200 rounded" />
                    <div className="h-8 w-64 bg-gray-200 rounded" />
                    <div className="h-4 w-48 bg-gray-200 rounded" />
                </div>
                <div className="flex gap-3">
                    <div className="h-9 w-24 bg-gray-200 rounded-lg" />
                    <div className="h-9 w-32 bg-gray-200 rounded-lg" />
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
                        <div className="h-3.5 w-28 bg-gray-200 rounded" />
                        <div className="h-10 w-20 bg-gray-200 rounded" />
                        <div className="h-6 w-36 bg-gray-200 rounded-full" />
                    </div>
                ))}
            </div>

            {/* Charts row */}
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white h-80" />
                <div className="rounded-xl border border-gray-200 bg-white h-80" />
            </div>

            {/* Widgets row */}
            <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
                <div className="rounded-xl border border-gray-200 bg-white h-64" />
                <div className="rounded-xl border border-gray-200 bg-white h-64" />
            </div>
        </div>
    );
}
