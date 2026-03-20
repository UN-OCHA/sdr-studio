import { Handle, Position } from "reactflow";
import { Icon } from "@blueprintjs/core";
import type { IconName } from "@blueprintjs/core";

interface Detail {
  label: string;
  value: string | number;
}

interface CustomNodeData {
  label: string;
  subtitle?: string;
  icon?: IconName;
  details?: Detail[];
}

function CustomNode({ data }: { data: CustomNodeData }) {
  return (
    <div className="rounded-lg shadow-sm border border-gray-200 dark:border-bp-dark-border p-4 w-[220px] bg-white dark:bg-bp-dark-surface relative group">
      <Handle 
        type="target" 
        position={Position.Left} 
        style={{ background: '#5C7080', border: 'none', width: 8, height: 8 }}
      />
      
      <div className="flex items-center gap-3">
        {data.icon && (
          <div className="p-2 rounded bg-gray-50 dark:bg-bp-dark-bg text-gray-500 dark:text-gray-400">
            <Icon icon={data.icon} size={16} />
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{data.label}</div>
          {data.subtitle && (
            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-tighter truncate">
              {data.subtitle}
            </div>
          )}
        </div>
      </div>

      {data.details && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-bp-dark-bg/50 space-y-1">
          {data.details.map((detail: Detail, i: number) => (
            <div key={i} className="flex justify-between items-center text-[10px]">
              <span className="text-gray-500 dark:text-gray-400 font-medium">{detail.label}:</span>
              <span className="text-gray-700 dark:text-gray-200 font-bold">{detail.value}</span>
            </div>
          ))}
        </div>
      )}

      <Handle 
        type="source" 
        position={Position.Right}
        style={{ background: '#5C7080', border: 'none', width: 8, height: 8 }}
      />
    </div>
  );
}

export default CustomNode;
