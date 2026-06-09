"use client";

import { useEffect, useRef, useCallback } from "react";
import cytoscape from "cytoscape";
import type { GraphData } from "@/lib/graph-queries";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

export interface NodeDetail {
  type: "person" | "fund";
  label: string;
  flags: string[];
  uid?: string;
  name: string;
  corpRelations: any[];
  fundRelations?: any[];
  personRelations?: any[];
  totalConnections: number;
  suspiciousCorps: number;
}

interface Props {
  data: GraphData;
  onNodeSelect?: (node: NodeDetail | null) => void;
}

export default function EntityGraph({ data, onNodeSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const handleZoomIn = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.zoom(cy.zoom() * 1.3);
    cy.center();
  }, []);

  const handleZoomOut = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.zoom(cy.zoom() * 0.7);
    cy.center();
  }, []);

  const handleFit = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.fit(undefined, 40);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      style: ([] as any).concat([
        {
          selector: "node",
          style: {
            label: "data(label)",
            "text-valign": "bottom",
            "text-halign": "center",
            "font-size": "10px",
            "font-family": "Inter, sans-serif",
            color: "#e4e4f0",
            "text-outline-color": "#0a0a0f",
            "text-outline-width": 2,
            "border-width": 2,
            width: 40, height: 40,
            cursor: "pointer",
          },
        },
        {
          selector: 'node[type="corp"]',
          style: { "background-color": "#6c5ce7", "border-color": "#a29bfe", shape: "rectangle", width: 55, height: 30 },
        },
        {
          selector: 'node[type="person"]',
          style: { "background-color": "#00b894", "border-color": "#55efc4", shape: "ellipse" },
        },
        {
          selector: 'node[type="fund"]',
          style: { "background-color": "#f39c12", "border-color": "#fdcb6e", shape: "diamond", width: 35, height: 35 },
        },
        {
          selector: 'node[flags]',
          style: { "border-width": 3, "border-color": "#e74c3c" },
        },
        {
          selector: 'node:selected',
          style: { "border-width": 3, "border-color": "#60efff", "overlay-opacity": 0.15, "overlay-color": "#60efff" },
        },
        {
          selector: "edge",
          style: {
            width: 1.5, "line-color": "#444466", "target-arrow-color": "#444466",
            "target-arrow-shape": "triangle", "curve-style": "bezier",
            label: "data(label)", "font-size": "8px", color: "#8888a0",
            "text-outline-color": "#0a0a0f", "text-outline-width": 1.5,
          },
        },
        {
          selector: 'edge[type="fund_person"]',
          style: { "line-style": "dashed", "line-color": "#f39c12", "target-arrow-color": "#f39c12" },
        },
      ]),
      layout: {
        name: "cose",
        animate: true,
        animationDuration: 800,
        idealEdgeLength: 120,
        nodeOverlap: 20,
        padding: 40,
      },
      elements: [
        ...data.nodes.map((n) => ({ group: "nodes" as const, data: n.data })),
        ...data.edges.map((e) => ({ group: "edges" as const, data: e.data })),
      ],
    });

    cy.on("tap", "node", (evt) => {
      const nd = evt.target.data();
      if (nd.type === "corp") {
        window.open(`/corp/${encodeURIComponent(nd.label)}`, "_blank");
        return;
      }
      if (nd.type === "person" || nd.type === "fund") {
        onNodeSelect?.({
          type: nd.type,
          label: nd.label,
          name: nd.label,
          flags: nd.flags || [],
          uid: nd.uid,
          corpRelations: [],
          totalConnections: 0,
          suspiciousCorps: 0,
        });
      }
    });

    cy.on("tap", (evt) => {
      if (evt.target === cy) onNodeSelect?.(null);
    });

    cyRef.current = cy;

    return () => { cy.destroy(); cyRef.current = null; };
  }, [data, onNodeSelect]);

  return (
    <div className="relative w-full h-[450px] bg-[var(--bg)]">
      <div ref={containerRef} className="w-full h-full" />

      {/* 확대/축소 컨트롤 */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 z-10">
        <button
          onClick={handleZoomIn}
          className="p-2 rounded-lg bg-[var(--surface)]/90 border border-[var(--border)] hover:bg-[var(--border)]/50 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          title="확대"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleFit}
          className="p-2 rounded-lg bg-[var(--surface)]/90 border border-[var(--border)] hover:bg-[var(--border)]/50 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          title="원래 크기로"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 rounded-lg bg-[var(--surface)]/90 border border-[var(--border)] hover:bg-[var(--border)]/50 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          title="축소"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
