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
    <div
      style={{
        borderRadius: "0.5rem",
        boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        border: "1px solid #E5E7EB",
        padding: "1rem",
        width: 220,
        background: "white",
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-3">
        {data.icon && <Icon icon={data.icon} size={20} className="text-gray-500" />}
        <div>
          <div className="text-sm font-bold text-gray-800">{data.label}</div>
          {data.subtitle && (
            <div className="text-xs text-gray-500">{data.subtitle}</div>
          )}
        </div>
      </div>
      {data.details && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600 space-y-1">
            {data.details.map((detail: Detail, i: number) => (
                <div key={i} className="flex justify-between">
                    <span className="font-semibold">{detail.label}:</span>
                    <span className="text-gray-800">{detail.value}</span>
                </div>
            ))}
        </div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export default CustomNode;
