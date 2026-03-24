import {
  Card,
  NonIdealState,
  Section,
  SectionCard,
  Spinner,
  Tag,
  Text,
  Intent,
} from "@blueprintjs/core";
import { useProjectUsage } from "../../hooks/queries";
import TimeAgo from "react-timeago";

type UsageSummaryProps = {
  projectId: string;
};

export function UsageSummary({ projectId }: UsageSummaryProps) {
  const { data: usage, isLoading } = useProjectUsage(projectId);

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <Spinner size={40} />
      </div>
    );
  }

  if (!usage) {
    return (
      <NonIdealState
        icon="chart"
        title="No Usage Data"
        description="Start running discovery tasks to see cost tracking."
      />
    );
  }

  const formatCost = (cost: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
    }).format(cost);
  };

  return (
    <div className="space-y-6">
      <Section
        title="Cost Tracking"
        subtitle="Overview of your project's search and discovery expenditure."
        icon="dollar"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
          <Card elevation={0} className="bg-gray-50 dark:bg-bp-dark-surface border border-gray-100 dark:border-bp-dark-border flex flex-col items-center justify-center p-6">
            <Text className="text-[10px] font-black uppercase text-gray-500 mb-1 tracking-widest">Total Spend</Text>
            <div className="text-2xl font-black text-gray-900 dark:text-white">
              {formatCost(usage.total_cost)}
            </div>
          </Card>

          {Object.entries(usage.by_type).map(([type, cost]) => (
            <Card key={type} elevation={0} className="bg-white dark:bg-bp-dark-bg border border-gray-100 dark:border-bp-dark-border flex flex-col items-center justify-center p-6">
              <Text className="text-[10px] font-black uppercase text-blue-500 mb-1 tracking-widest">{type} Search</Text>
              <div className="text-xl font-bold text-gray-800 dark:text-gray-100">
                {formatCost(cost)}
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        title="Recent Discovery Logs"
        subtitle="Detailed history of individual discovery runs."
        icon="history"
      >
        <SectionCard className="p-0!">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-bp-dark-header border-b border-gray-100 dark:border-bp-dark-border">
                  <th className="px-4 py-3 text-[10px] font-black uppercase text-gray-400">Date</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase text-gray-400">Type</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase text-gray-400">Query / Source</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase text-gray-400">Articles</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase text-gray-400 text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-bp-dark-border">
                {usage.recent_logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400 italic text-sm">
                      No recent logs found.
                    </td>
                  </tr>
                ) : (
                  usage.recent_logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-bp-dark-surface/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        <TimeAgo date={log.created_at} />
                      </td>
                      <td className="px-4 py-3">
                        <Tag 
                          minimal 
                          round 
                          intent={log.type === "exa" ? Intent.PRIMARY : log.type === "brave" ? Intent.WARNING : Intent.NONE}
                          className="text-[9px] font-bold uppercase"
                        >
                          {log.type}
                        </Tag>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-gray-800 dark:text-gray-200 truncate max-w-xs" title={log.query}>
                        {log.query}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                        {log.article_count} found
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-gray-900 dark:text-white text-right font-mono">
                        {formatCost(log.cost)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </Section>
    </div>
  );
}
