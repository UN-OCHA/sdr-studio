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

const getIconForSource = (type: string) => {
  switch (type) {
    case "rss":
      return "rss";
    case "exa":
      return "search";
    case "brave":
      return "search";
    case "manual":
      return "upload";
    default:
      return "inbox";
  }
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
          icon: getIconForSource(source.type),
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
      position: { x: xSpacing * 2, y: 0 },
      ...nodeDefaults,
    });

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
      position: { x: xSpacing * 3, y: 0 },
      ...nodeDefaults,
    });

    // --- Output Nodes ---
    const outputX = xSpacing * 4;
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
    });

    // --- Edges ---
    allEdges.push({
      id: "e-clean-summarize",
      source: "fetch-clean",
      target: "summarize",
      animated: true,
    });
    allEdges.push({
      id: "e-summarize-extract",
      source: "summarize",
      target: "extraction",
      animated: true,
    });

    outputNodes.forEach((node) => {
      allEdges.push({
        id: `e-extract-${node.id}`,
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
