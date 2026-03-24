import { useMemo } from "react";
import type { Edge, Node } from "reactflow";
import ReactFlow, { Background, Position } from "reactflow";
import "reactflow/dist/style.css";
import type { Project, Source } from "../types";
import CustomNode from "./CustomNode";

const nodeTypes = {
  custom: CustomNode,
};

type IntelligencePipelineProps = {
  project: Project;
  sources: Source[];
};

const nodeDefaults = {
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  type: "custom",
};

const SOURCE_ICONS: Record<string, string> = {
  rss: "feed",
  exa: "search",
  brave: "search",
  manual: "upload",
};

export function IntelligencePipeline({
  project,
  sources,
}: IntelligencePipelineProps) {
  const { nodes, edges } = useMemo(() => {
    const allNodes: Node[] = [];
    const allEdges: Edge[] = [];
    const config = project.extraction_config || {};
    const cleaningConfig = config.cleaning || {};
    const xSpacing = 300;

    // --- Sources Nodes ---
    const allSources = [
      { id: "manual", name: "Manual Import", type: "manual" },
      ...sources,
    ];
    const ySpacing = 100;
    const sourceStartY = -((allSources.length - 1) / 2) * ySpacing;

    allSources.forEach((source, i) => {
      const sourceId = `source-${source.id}`;
      allNodes.push({
        id: sourceId,
        data: {
          label: source.name,
          subtitle: source.type,
          icon: SOURCE_ICONS[source.type] || "inbox",
        },
        position: { x: 0, y: sourceStartY + i * ySpacing },
        ...nodeDefaults,
      });
      allEdges.push({
        id: `e-${sourceId}-fetch`,
        source: sourceId,
        target: "fetch-clean",
        animated: true,
      });
    });

    // --- Processing Nodes ---
    allNodes.push({
      id: "fetch-clean",
      data: {
        label: "Fetch & Clean",
        subtitle: "Download & Normalize",
        icon: "download",
        details: [
          {
            label: "Start Detection",
            value: cleaningConfig.use_local_model ? "Local Model" : "Simple",
          },
        ],
      },
      position: { x: xSpacing, y: 0 },
      ...nodeDefaults,
    });

    let lastId = "fetch-clean";
    let xOffset = xSpacing * 2;

    if (config.translation?.enabled) {
      const transId = "translate";
      allNodes.push({
        id: transId,
        data: {
          label: "Translation",
          subtitle: "Google T5",
          icon: "translate",
          details: [
            {
              label: "Model",
              value: config.translation.model_id?.split("/").pop() || "t5-small",
            },
          ],
        },
        position: { x: xOffset, y: 0 },
        ...nodeDefaults,
      });
      allEdges.push({
        id: `e-${lastId}-${transId}`,
        source: lastId,
        target: transId,
        animated: true,
      });
      lastId = transId;
      xOffset += xSpacing;
    }

    allNodes.push({
      id: "summarize",
      data: {
        label: "Summarize",
        subtitle: "Generate description",
        icon: "align-left",
        details: [
          {
            label: "Model",
            value: config.summary_model_id?.split("/").pop() || "distilbart",
          },
        ],
      },
      position: { x: xOffset, y: 0 },
      ...nodeDefaults,
    });
    allEdges.push({
      id: `e-${lastId}-summarize`,
      source: lastId,
      target: "summarize",
      animated: true,
    });
    lastId = "summarize";
    xOffset += xSpacing;

    allNodes.push({
      id: "extraction",
      data: {
        label: "Extraction",
        subtitle: "GLiNER Processing",
        icon: "predictive-analysis",
        details: [
          {
            label: "Model",
            value: config.model_id?.split("/").pop() || "GLiNER",
          },
          {
            label: "Adapter",
            value: config.active_adapter_path ? "Yes" : "No",
          },
          { label: "Threshold", value: config.threshold || 0.3 },
        ],
      },
      position: { x: xOffset, y: 0 },
      ...nodeDefaults,
    });
    allEdges.push({
      id: `e-${lastId}-extract`,
      source: lastId,
      target: "extraction",
      animated: true,
    });
    lastId = "extraction";
    xOffset += xSpacing;

    // --- Output Nodes ---
    const outputX = xOffset;
    const outputNodes: Node[] = [];

    if (config.entities && Object.keys(config.entities).length > 0) {
      outputNodes.push({
        id: "output-entities",
        data: {
          label: "Entities",
          subtitle: `${Object.keys(config.entities).length} labels`,
          icon: "tag",
        },
        position: { x: 0, y: 0 },
        ...nodeDefaults,
      });
    }
    if (config.relations && Object.keys(config.relations).length > 0) {
      outputNodes.push({
        id: "output-relations",
        data: {
          label: "Relations",
          subtitle: `${Object.keys(config.relations).length} types`,
          icon: "link",
        },
        position: { x: 0, y: 0 },
        ...nodeDefaults,
      });
    }
    if (
      config.classifications &&
      Object.keys(config.classifications).length > 0
    ) {
      outputNodes.push({
        id: "output-classifications",
        data: {
          label: "Classifications",
          subtitle: `${Object.keys(config.classifications).length} types`,
          icon: "list-columns",
        },
        position: { x: 0, y: 0 },
        ...nodeDefaults,
      });
    }
    if (config.structures && Object.keys(config.structures).length > 0) {
      outputNodes.push({
        id: "output-structures",
        data: {
          label: "Structured Objects",
          subtitle: `${Object.keys(config.structures).length} objects`,
          icon: "layout-grid",
        },
        position: { x: 0, y: 0 },
        ...nodeDefaults,
      });
    }

    const outputStartY = -(outputNodes.length / 2 - 0.5) * ySpacing;
    outputNodes.forEach((node, i) => {
      node.position = { x: outputX, y: outputStartY + i * ySpacing };
      allNodes.push(node);
      
      // Add edge from extraction to each output node
      allEdges.push({
        id: `e-extraction-${node.id}`,
        source: "extraction",
        target: node.id,
        animated: true,
      });
    });

    return { nodes: allNodes, edges: allEdges };
  }, [project, sources]);

  return (
    <div style={{ height: "250px" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
      </ReactFlow>
    </div>
  );
}
