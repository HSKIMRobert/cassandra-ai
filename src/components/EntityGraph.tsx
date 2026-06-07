"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import cytoscape from "cytoscape";
import type { GraphData } from "@/lib/graph-queries";
import { X, Building2, User, Landmark, AlertTriangle, TrendingDown, ShieldAlert, Loader2, ExternalLink } from "lucide-react";

interface Props {
  data: GraphData;
  onNodeSelect?: (node: NodeDetail | null) => void;
}

export interface NodeDetail {
  type: "person" | "fund";
  label: string;
  flags: string[];
  uid?: string;
  name: string;
  corpRelations: Array<{ role: string; description?: string; corp: { companyName: string; corpCode: string; isAdmin: boolean; delistedAt: string | null } }>;
  fundRelations?: Array<{ role: string; fund?: { name: string; fundUid: string; fundType: string; flags: string[] }; person?: { name: string; personUid: string; flags: string[] } }>;
  personRelations?: Array<{ role: string; fund?: { name: string; fundUid: string; fundType: string; flags: string[] }; person?: { name: string; personUid: string; flags: string[] } }>;
  totalConnections: number;
  suspiciousCorps: number;
}

export default function EntityGraph({ data, onNodeSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [detailPanel, setDetailPanel] = useState<{ node: NodeDetail; pos: { x: number; y: number } } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchDetail = useCallback(async (type: string, name: string, uid?: string) => {
    setLoadingDetail(true);
    try {
      const params = new URLSearchParams({ type, name });
      if (uid) params.set("uid", uid);
      const res = await fetch(`/api/detail?${params}`);
      const data = await res.json();
      if (!data.error) return data as NodeDetail;
    } catch {}
    setLoadingDetail(false);
    return null;
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      style: [
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
            width: 40,
            height: 40,
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
          style: { "border-width": 3, "border-color": "#60efff", "overlay-opacity": 0.2, "overlay-color": "#60efff" },
        },
        {
          selector: "edge",
          style: {
            width: 1.5, "line-color": "#444466", "target-arrow-color": "#444466",
            "target-arrow-shape": "triangle", "curve-style": "bezier",
            label: "data(label)", "font-size": "8px", "font-family": "Inter, sans-serif",
            color: "#8888a0", "text-outline-color": "#0a0a0f", "text-outline-width": 1.5,
          },
        },
        {
          selector: 'edge[type="fund_person"]',
          style: { "line-style": "dashed", "line-color": "#f39c12", "target-arrow-color": "#f39c12" },
        },
      ],
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

    cy.on("tap", "node", async (evt) => {
      const node = evt.target;
      const nd = node.data();

      // 회사 노드: 새 탭 열기
      if (nd.type === "corp") {
        window.open(`/corp/${nd.label}`, "_blank");
        return;
      }

      // 인물/법인 노드: 상세 패널
      if (nd.type === "person" || nd.type === "fund") {
        const detail = await fetchDetail(nd.type, nd.label, nd.uid);
        if (detail) {
          const pos = node.renderedPosition();
          setDetailPanel({ node: detail, pos: { x: pos.x, y: pos.y } });
        }
        setLoadingDetail(false);
      }
    });

    cy.on("tap", (evt) => {
      if (evt.target === cy) setDetailPanel(null);
    });

    cyRef.current = cy;
    return () => { cy.destroy(); };
  }, [data, fetchDetail]);

  return (
    <div className="relative w-full h-[550px] bg-[var(--bg)]" ref={containerRef}>
      {/* 로딩 오버레이 */}
      {loadingDetail && (
        <div className="absolute top-4 right-4 z-10 px-3 py-2 rounded-lg bg-[var(--surface)]/90 border border-[var(--border)] flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Loader2 className="w-4 h-4 animate-spin" /> 불러오는 중...
        </div>
      )}

      {/* 상세 패널 */}
      {detailPanel && (
        <div
          className="absolute z-20 w-80 max-h-[480px] overflow-y-auto rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl"
          style={{
            left: Math.min(detailPanel.pos.x + 20, (containerRef.current?.clientWidth || 600) - 340),
            top: Math.min(detailPanel.pos.y - 20, 50),
          }}
        >
          <DetailPanelContent node={detailPanel.node} onClose={() => setDetailPanel(null)} />
        </div>
      )}
    </div>
  );
}

function DetailPanelContent({ node, onClose }: { node: NodeDetail; onClose: () => void }) {
  const isPerson = node.type === "person";
  const isBlacklisted = node.flags?.includes("blacklist");

  return (
    <div>
      {/* 헤더 */}
      <div className="sticky top-0 z-10 flex items-center justify-between p-3 bg-[var(--surface)] border-b border-[var(--border)] rounded-t-xl">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isPerson ? "bg-[var(--person-color)]" : "bg-[var(--fund-color)]"}`} />
          <span className="font-bold text-sm truncate">{node.label}</span>
          {isBlacklisted && <AlertTriangle className="w-3.5 h-3.5 text-[var(--danger-glow)] shrink-0" />}
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-[var(--border)] shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* 플래그 + 연관도 */}
        <div className="flex flex-wrap gap-2">
          {node.flags?.map((f) => (
            <span key={f} className={`px-2 py-0.5 rounded text-[10px] font-medium ${
              f === "blacklist" ? "bg-[var(--danger)]/20 text-[var(--danger-glow)]" :
              f === "manipulation_suspect" ? "bg-[var(--warning)]/20 text-[var(--warning)]" :
              "bg-[var(--border)] text-[var(--text-muted)]"
            }`}>{f}</span>
          ))}
          <span className="px-2 py-0.5 rounded text-[10px] bg-[var(--accent)]/10 text-[var(--accent-glow)]">
            연관도 {node.totalConnections}건
          </span>
          {node.suspiciousCorps > 0 && (
            <span className="px-2 py-0.5 rounded text-[10px] bg-[var(--danger)]/10 text-[var(--danger-glow)]">
              ⚠ 문제기업 {node.suspiciousCorps}건
            </span>
          )}
        </div>

        {/* 참여 기업 목록 */}
        {node.corpRelations?.length > 0 && (
          <div>
            <h5 className="text-[10px] font-semibold text-[var(--text-muted)] uppercase mb-1.5 flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              {isPerson ? "등기·관여 기업" : "투자·인수 기업"}
            </h5>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {node.corpRelations.map((rel, i) => (
                <a
                  key={i}
                  href={`/corp/${rel.corp.corpCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg)] hover:bg-[var(--border)]/30 transition-colors group"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-medium truncate">{rel.corp.companyName}</span>
                    {rel.corp.isAdmin && <ShieldAlert className="w-3 h-3 text-[var(--danger-glow)] shrink-0" />}
                    {rel.corp.delistedAt && <TrendingDown className="w-3 h-3 text-[var(--danger)] shrink-0" />}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-[var(--border)]">
                      {rel.role}
                    </span>
                    <ExternalLink className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* 실소유 법인 (인물인 경우) */}
        {isPerson && (node.fundRelations ?? node.personRelations)?.length > 0 && (
          <div>
            <h5 className="text-[10px] font-semibold text-[var(--text-muted)] uppercase mb-1.5 flex items-center gap-1">
              <Landmark className="w-3 h-3" /> 실소유·대표 법인
            </h5>
            <div className="space-y-1">
              {((node.fundRelations ?? node.personRelations)!).map((rel: any, i: number) => {
                const fund = rel.fund;
                if (!fund) return null;
                return (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg)]">
                    <span className="text-xs">{fund.name}</span>
                    <span className="text-[10px] text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-[var(--border)]">{rel.role}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 실소유자 (법인인 경우) */}
        {!isPerson && (node.personRelations ?? node.fundRelations)?.length > 0 && (
          <div>
            <h5 className="text-[10px] font-semibold text-[var(--text-muted)] uppercase mb-1.5 flex items-center gap-1">
              <User className="w-3 h-3" /> 실소유·대표
            </h5>
            <div className="space-y-1">
              {((node.personRelations ?? node.fundRelations)!).map((rel: any, i: number) => {
                const person = rel.person;
                if (!person) return null;
                return (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg)]">
                    <span className="text-xs">{person.name}</span>
                    <span className="text-[10px] text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-[var(--border)]">{rel.role}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
