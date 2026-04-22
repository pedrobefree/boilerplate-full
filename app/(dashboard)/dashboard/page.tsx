import { getDashboardData, type DashboardPeriod } from "@/app/actions/dashboard";
import { DashboardPage } from "@/components/features/dashboard/DashboardPage";

type PageProps = {
    searchParams: Promise<{ period?: string }>;
};

const VALID_PERIODS = ["7d", "30d", "90d"] as const;

function parsePeriod(raw: string | undefined): DashboardPeriod {
    return VALID_PERIODS.includes(raw as DashboardPeriod) ? (raw as DashboardPeriod) : "30d";
}

export default async function Page({ searchParams }: PageProps) {
    const { period: rawPeriod } = await searchParams;
    const period = parsePeriod(rawPeriod);

    const result = await getDashboardData(period);
    const dashboardData = result.success ? result.data : null;

    return <DashboardPage dashboardData={dashboardData} period={period} />;
}
