<template>
  <div ref="container" class="career-graph" :class="{ 'has-focus': focusIds !== null }">
    <svg ref="svgEl" :height="height" role="img" aria-label="Career pathway map" />
    <div class="graph-hint">
      <span class="legend-dot legend-dot--active" />has live openings
      <span class="legend-dot legend-dot--idle ms-2" />no openings yet
      <span class="ms-3">Scroll to zoom · drag to pan · hover to focus · click to open</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as d3 from "d3";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { GraphEdge, GraphNode } from "@/api/types";
import { brand } from "@/plugins/vuetify";

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  height?: number;
  /** Edges to draw as a highlighted route, e.g. the selected career path. */
  highlightPath?: Array<{ from: string; to: string }>;
  selectedId?: string | null;
  /** Show every label regardless of size (sensible for small subgraphs). */
  labelAll?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  height: 620,
  highlightPath: () => [],
  selectedId: null,
  labelAll: false,
});

const emit = defineEmits<{ select: [slug: string] }>();

/** d3 mutates its data, so the simulation works on copies of the props. */
interface SimNode extends d3.SimulationNodeDatum, GraphNode {
  showLabel: boolean;
}
interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  source: SimNode | string;
  target: SimNode | string;
  durationYears: number;
}

const container = ref<HTMLElement | null>(null);
const svgEl = ref<SVGSVGElement | null>(null);
const focusIds = ref<Set<string> | null>(null);

let simulation: d3.Simulation<SimNode, SimLink> | null = null;
let resizeObserver: ResizeObserver | null = null;

function render(): void {
  const svgNode = svgEl.value;
  const host = container.value;
  if (!svgNode || !host) return;

  const width = host.clientWidth || 900;
  const height = props.height;

  simulation?.stop();
  const svg = d3.select(svgNode);
  svg.selectAll("*").remove();
  svg.attr("viewBox", `0 0 ${width} ${height}`);

  // Bigger, better-connected stages read as more important.
  const maxCentrality = d3.max(props.nodes, (node) => node.centrality) ?? 1;
  const radius = d3.scaleSqrt().domain([0, Math.max(maxCentrality, 1)]).range([4.5, 13]).clamp(true);
  const labelCutoff = props.labelAll ? -1 : (d3.quantile(props.nodes.map((n) => n.centrality).sort(d3.ascending), 0.8) ?? 0);

  const nodes: SimNode[] = props.nodes.map((node) => ({
    ...node,
    showLabel: props.labelAll || node.centrality >= labelCutoff || node.centrality === maxCentrality,
  }));
  const byId = new Map(nodes.map((node) => [node.id, node]));

  // Drop edges pointing outside the supplied node set, which happens when a
  // caller passes a subgraph; d3.forceLink would otherwise throw.
  const links: SimLink[] = props.edges
    .filter((edge) => byId.has(edge.from) && byId.has(edge.to))
    .map((edge) => ({ source: edge.from, target: edge.to, durationYears: edge.durationYears }));

  const pathKeys = new Set(props.highlightPath.map((entry) => `${entry.from}->${entry.to}`));
  const zoomLayer = svg.append("g");

  // The explicit generic keeps the selection typed as SVGGElement; `join` alone
  // widens it to BaseType, which then rejects the typed drag behaviour below.
  const link = zoomLayer
    .append("g")
    .selectAll<SVGGElement, SimLink>("g")
    .data(links)
    .join<SVGGElement>("g")
    .attr("class", (d) => `link ${pathKeys.has(`${idOf(d.source)}->${idOf(d.target)}`) ? "is-path" : ""}`);

  link.append("line");
  link
    .append("text")
    .attr("text-anchor", "middle")
    .text((d) => (d.durationYears > 0 ? `${formatYears(d.durationYears)}y` : ""));

  const node = zoomLayer
    .append("g")
    .selectAll<SVGGElement, SimNode>("g")
    .data(nodes)
    .join<SVGGElement>("g")
    .attr("class", (d) => `node ${d.id === props.selectedId ? "is-path" : ""}`)
    .on("click", (_event, d) => emit("select", d.slug))
    .on("mouseenter", (_event, d) => {
      const neighbours = new Set<string>([d.id]);
      for (const edge of props.edges) {
        if (edge.from === d.id) neighbours.add(edge.to);
        if (edge.to === d.id) neighbours.add(edge.from);
      }
      focusIds.value = neighbours;
      applyFocus(neighbours);
    })
    .on("mouseleave", () => {
      focusIds.value = null;
      applyFocus(null);
    });

  // Brand green marks stages with live demand; muted green keeps the rest legible
  // without competing for attention.
  node
    .append("circle")
    .attr("r", (d) => radius(d.centrality))
    .attr("fill", (d) => (d.openings > 0 ? brand.green : brand.greenMuted));

  node
    .append("title")
    .text((d) => `${d.name}\n${d.outDegree} next step(s)${d.openings ? ` · ${d.openings} live posting(s)` : ""}`);

  node
    .append("text")
    .attr("text-anchor", "middle")
    .attr("dy", (d) => -radius(d.centrality) - 5)
    .attr("class", "node-label")
    .style("display", (d) => (d.showLabel ? null : "none"))
    .text((d) => truncate(d.name));

  function applyFocus(ids: Set<string> | null): void {
    node.classed("is-focus", (d) => (ids ? ids.has(d.id) : false));
    link.classed("is-focus", (d) => (ids ? ids.has(idOf(d.source)) && ids.has(idOf(d.target)) : false));
    // Reveal names within the focused neighbourhood even if normally hidden.
    node.select<SVGTextElement>("text.node-label").style("display", (d) => {
      if (ids?.has(d.id)) return null;
      return d.showLabel ? null : "none";
    });
  }

  simulation = d3
    .forceSimulation<SimNode, SimLink>(nodes)
    .force("link", d3.forceLink<SimNode, SimLink>(links).id((d) => d.id).distance(90).strength(0.4))
    .force("charge", d3.forceManyBody<SimNode>().strength(-260).distanceMax(420))
    .force("collide", d3.forceCollide<SimNode>((d) => radius(d.centrality) + 14))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .on("tick", () => {
      link
        .select("line")
        .attr("x1", (d) => (d.source as SimNode).x ?? 0)
        .attr("y1", (d) => (d.source as SimNode).y ?? 0)
        .attr("x2", (d) => (d.target as SimNode).x ?? 0)
        .attr("y2", (d) => (d.target as SimNode).y ?? 0);
      link
        .select("text")
        .attr("x", (d) => (((d.source as SimNode).x ?? 0) + ((d.target as SimNode).x ?? 0)) / 2)
        .attr("y", (d) => (((d.source as SimNode).y ?? 0) + ((d.target as SimNode).y ?? 0)) / 2 - 3);
      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

  node.call(
    d3
      .drag<SVGGElement, SimNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation?.alphaTarget(0.25).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation?.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }),
  );

  svg.call(
    d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => zoomLayer.attr("transform", event.transform.toString())),
  );
}

function idOf(endpoint: SimNode | string): string {
  return typeof endpoint === "string" ? endpoint : endpoint.id;
}

function truncate(value: string): string {
  return value.length > 26 ? `${value.slice(0, 25)}…` : value;
}

function formatYears(value: number): string {
  return Number.parseFloat(value.toFixed(2)).toString();
}

onMounted(() => {
  render();
  // Re-layout on container resize so the graph fills sidebars/mobile widths.
  if (typeof ResizeObserver !== "undefined" && container.value) {
    let last = container.value.clientWidth;
    resizeObserver = new ResizeObserver(() => {
      const width = container.value?.clientWidth ?? last;
      if (Math.abs(width - last) < 40) return;
      last = width;
      render();
    });
    resizeObserver.observe(container.value);
  }
});

watch(
  () => [props.nodes, props.edges, props.highlightPath, props.selectedId],
  () => render(),
  { deep: true },
);

onBeforeUnmount(() => {
  simulation?.stop();
  simulation = null;
  resizeObserver?.disconnect();
});
</script>
