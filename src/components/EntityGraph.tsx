"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import cytoscape from "cytoscape";
import type { GraphData } from "@/lib/graph-queries";
import { ZoomIn, ZoomOut, Maximize2, GitBranch } from "lucide-react";

export interface NodeDetail {
  type: "person" | "fund" | "auditor";
  label: string; flags: string[]; uid?: string; name: string;
  corpRelations: any[]; fundRelations?: any[]; personRelations?: any[];
  totalConnections: number; suspiciousCorps: number;
}

interface Props {
  data: GraphData; onNodeSelect?: (node: NodeDetail | null) => void;
  onDepthChange?: (depth: number) => void; currentDepth?: number; maxDepth?: number;
}

function hopOpacity(hop: number | undefined): number {
  if (hop === undefined || hop === 0) return 1;
  if (hop === 1) return 0.8;
  return 0.55;
}

export default function EntityGraph({ data, onNodeSelect, onDepthChange, currentDepth = 1, maxDepth = 3 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = useCallback(() => { const cy = cyRef.current; if (!cy) return; cy.zoom(cy.zoom() * 1.3); cy.center(); }, []);
  const handleZoomOut = useCallback(() => { const cy = cyRef.current; if (!cy) return; cy.zoom(cy.zoom() * 0.7); cy.center(); }, []);
  const handleFit = useCallback(() => { const cy = cyRef.current; if (!cy) return; cy.fit(undefined, 40); }, []);

  const showTooltip = useCallback((content: string, x: number, y: number) => {
    const tip = tooltipRef.current; if (!tip) return;
    tip.textContent = content; tip.style.left = `${x + 12}px`; tip.style.top = `${y - 8}px`; tip.style.display = "block";
  }, []);
  const hideTooltip = useCallback(() => { const tip = tooltipRef.current; if (tip) tip.style.display = "none"; }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const hopStyles = [0, 1, 2].map(hop => ({ selector: `node[hop = ${hop}]`, style: { opacity: hopOpacity(hop) } }));

    const cy = cytoscape({
      container: containerRef.current,
      style: ([] as any).concat([
        { selector: "node", style: { label: "data(label)", "text-valign": "bottom", "text-halign": "center", "font-size": "10px", "font-family": "Inter, sans-serif", color: "#e4e4f0", "text-outline-color": "#0a0a0f", "text-outline-width": 2, "border-width": 2, width: 40, height: 40, cursor: "pointer" } },
        { selector: 'node[type="corp"]', style: { "background-color": "#6c5ce7", "border-color": "#a29bfe", shape: "rectangle", width: 55, height: 30 } },
        { selector: 'node[type="person"]', style: { "background-color": "#00b894", "border-color": "#55efc4", shape: "ellipse" } },
        { selector: 'node[type="fund"]', style: { "background-color": "#f39c12", "border-color": "#fdcb6e", shape: "diamond", width: 35, height: 35 } },
        { selector: 'node[type="auditor"]', style: { "background-color": "#636e72", "border-color": "#b2bec3", shape: "pentagon", width: 38, height: 38 } },
        { selector: 'node[flags]', style: { "border-width": 3, "border-color": "#e74c3c" } },
        { selector: 'node:selected', style: { "border-width": 3, "border-color": "#60efff", "overlay-opacity": 0.15, "overlay-color": "#60efff" } },
        { selector: "edge", style: { width: 1.5, "line-color": "#444466", "target-arrow-color": "#444466", "target-arrow-shape": "triangle", "curve-style": "bezier", label: "data(label)", "font-size": "8px", color: "#8888a0", "text-outline-color": "#0a0a0f", "text-outline-width": 1.5 } },
        { selector: 'edge[type="fund_person"]', style: { "line-style": "dashed", "line-color": "#f39c12", "target-arrow-color": "#f39c12" } },
        { selector: 'edge[type="audit_corp"]', style: { "line-style": "dotted", "line-color": "#636e72", "target-arrow-color": "#636e72", width: 1 } },
      ], hopStyles),
      layout: { name: "cose", animate: true, animationDuration: 800, idealEdgeLength: () => 130, nodeOverlap: 25, padding: 40, randomize: false, componentSpacing: 80, nodeRepulsion: () => 8000, edgeElasticity: () => 100, nestingFactor: 1.2, gravity: 0.25 },
      elements: [...data.nodes.map((n) => ({ group: "nodes" as const, data: n.data })), ...data.edges.map((e) => ({ group: "edges" as const, data: e.data }))],
    });

    cy.on("tap", "node", (evt) => {
      const nd = evt.target.data();
      if (nd.type === "corp") { window.open(`/corp/${encodeURIComponent(nd.label)}`, "_blank"); return; }
      onNodeSelect?.({ type: nd.type, label: nd.label, name: nd.label, flags: nd.flags || [], uid: nd.uid, corpRelations: [], totalConnections: 0, suspiciousCorps: 0 });
    });

    cy.on("mouseover", "edge", (evt) => {
      const ed = evt.target.data(); const parts: string[] = [ed.label];
      if (ed.since) parts.push(`from ${ed.since}`); if (ed.until) parts.push(`~${ed.until}`);
      if (ed.amount) parts.push(`${(ed.amount / 100000000).toFixed(1)}억`); if (ed.pct) parts.push(`${ed.pct.toFixed(1)}%`);
      const pos = evt.renderedPosition;
      showTooltip(parts.join(" · "), pos.x, pos.y);
    });
    cy.on("mouseout", "edge", hideTooltip);
    cy.on("tap", (evt) => { if (evt.target === cy) onNodeSelect?.(null); });
    cyRef.current = cy;
    return () => { cy.destroy(); cyRef.current = null; hideTooltip(); };
  }, [data, onNodeSelect, showTooltip, hideTooltip]);

  const stats = data.stats;

  return (
    <div className="relative w-full bg-[var(--bg)]">
      {onDepthChange && (
        <div className="flex items-center gap-3 px-3 py-2 border-b border-[var(--border)] bg-[var(--surface)]/60">
          <GitBranch className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span className="text-xs text-[var(--text-muted)]">탐색 깊이</span>
          <div className="flex gap-1">
            {Array.from({ length: maxDepth }, (_, i) => i + 1).map((d) => (
              <button key={d} onClick={() => onDepthChange(d)}
                className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors ${currentDepth === d ? "bg-[#6c5ce7] text-white" : "bg-[var(--border)]/40 text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
                {d}hop
              </button>
            ))}
          </div>
          {stats && (
            <div className="ml-auto flex gap-3 text-xs text-[var(--text-muted)]">
              <span>노드 {stats.totalNodes}</span><span>엣지 {stats.totalEdges}</span>
              {stats.auditorCount > 0 && <span>감사인 {stats.auditorCount}</span>}
            </div>
          )}
        </div>
      )}

      <div className="relative h-[450px]">
        <div ref={containerRef} className="w-full h-full" />
        <div ref={tooltipRef} className="pointer-events-none absolute z-20 hidden rounded bg-[var(--surface)] border border-[var(--border)] px-2 py-1 text-xs text-[var(--text)] shadow-lg" />

        <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1 rounded-lg bg-[var(--surface)]/90 border border-[var(--border)] px-3 py-2">
          {[{ color: "#6c5ce7", label: "회사", shape: "■" }, { color: "#00b894", label: "인물", shape: "●" }, { color: "#f39c12", label: "법인/조합", shape: "◆" }, { color: "#636e72", label: "감사인", shape: "⬠" }].map(({ color, label, shape }) => (
            <div key={label} className="flex items-center gap-2 text-xs text-[var(--text-muted)]"><span style={{ color }}>{shape}</span><span>{label}</span></div>
          ))}
          <div className="mt-1 pt-1 border-t border-[var(--border)] text-[10px] text-[var(--text-muted)] opacity-70">흐림 = 원거리 노드</div>
        </div>

        <div className="absolute top-3 right-3 flex flex-col gap-1 z-10">
          {[{ icon: <ZoomIn className="w-4 h-4" />, handler: handleZoomIn, title: "확대" }, { icon: <Maximize2 className="w-4 h-4" />, handler: handleFit, title: "맞춤" }, { icon: <ZoomOut className="w-4 h-4" />, handler: handleZoomOut, title: "축소" }].map(({ icon, handler, title }) => (
            <button key={title} onClick={handler} className="p-2 rounded-lg bg-[var(--surface)]/90 border border-[var(--border)] hover:bg-[var(--border)]/50 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors" title={title}>{icon}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
