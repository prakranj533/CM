<template>
  <div class="graph">
    <div class="svg-container">
      <svg id="graph-svg" width="620" height="540"></svg>
    </div>
  </div>
</template>

<script>
import * as d3 from "d3v4";

export default {
  name: "Graph",
  props: {
    nodeMap: Object,
    width: Number,
    height: Number,
    highlighPath: Array,
  },
  data: () => ({
    idsToHighlight: [],
  }),
  watch: {
    highlighPath() {
      this.handlePathHighlighting();
    },
    nodeMap() {
      this.drawGraph();
    }
  },
  mounted() {
    this.drawGraph();
  },
  methods: {
    formatData() {
      const nodes = [];
      const links = [];
      Object.keys(this.nodeMap).forEach((nodeId) => {
        const node = this.nodeMap[nodeId];
        nodes.push({ id: node.id, name: node.name });
        node.paths
          .map(({ to, duration }) => ({
            source: node.id,
            target: this.nodeMap[to].id,
            duration,
          }))
          .forEach((e) => links.push(e));
      });
      return { nodes, links };
    },
    drawGraph() {
      d3.selectAll("#graph-svg > *").remove();
      const data = this.formatData();
      const svgContainer = d3.select(".svg-container").node();
      const width = this.width || svgContainer.offsetWidth;
      const height = this.height || svgContainer.offsetHeight;
      const svg = d3.select("#graph-svg");
      svg.attr("width", width);
      svg.attr("height", height);
      svg.on("click", () => d3.event.target.tagName !== "circle" && (this.idsToHighlight = []));
      const color = d3.scaleOrdinal(d3.schemeCategory10);

      /* prettier-ignore */
      const links = svg
        .append("g")
        .attr("class", "links")
        .selectAll("g")
        .data(data.links)
        .enter()
        .append("g");

      links.append("line");
      links.append("text").text((d) => `(${d.duration} years)`);

      /* prettier-ignore */
      const nodes = svg
        .append("g")
        .attr("class", "nodes")
        .selectAll("g")
        .data(data.nodes)
        .enter()
        .append("g");

      nodes
        .append("circle")
        .attr("fill", (d) => color(d.id))
        .attr("r", 6);

      nodes.append("text").text((d) => d.name);

      const forceSimulation = this.getForceSimulation(width, height, data, links, nodes);

      nodes.on("click", (d) => this.$emit("nodeClicked", d.id));
      this.handleHover(links, nodes);
      this.handleNodeDrag(nodes, forceSimulation);
      this.handlePathHighlighting();
    },
    handleNodeDrag(nodes, forceSimulation) {
      const drag = d3
        .drag()
        .on("start", (d) => {
          if (!d3.event.active) forceSimulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
          // setActiveNode(d);
        })
        .on("drag", (d) => {
          d.fx = d3.event.x;
          d.fy = d3.event.y;
        })
        .on("end", (d) => {
          if (!d3.event.active) forceSimulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        });
      nodes.call(drag);
    },
    handleHover(links, nodes) {
      nodes
        .select("circle")
        .attr("onmouseover", "evt.target.setAttribute('r', 8)")
        .attr("onmouseout", "evt.target.setAttribute('r', 6)")
        .on("mouseover", (d) => {
          this.idsToHighlight = [d.id, ...this.nodeMap[d.id].paths.map((e) => e.to)];
          nodes
            .classed("blur", true)
            .filter((d) => this.idsToHighlight.includes(d.id))
            .classed("highlight", true)
            .classed("blur", false);
          links
            .classed("blur", true)
            .classed("path-link", false)
            .filter(
              (d) =>
                this.idsToHighlight.length &&
                this.idsToHighlight[0] === d.source.id &&
                this.idsToHighlight.includes(d.target.id)
            )
            .classed("highlight", true)
            .classed("blur", false);
        })
        .on("mouseout", () => {
          this.idsToHighlight = [];
          nodes /* prettier-ignore */
            .classed("highlight", false)
            .classed("blur", false);
          links /* prettier-ignore */
            .classed("highlight", false)
            .classed("blur", false);
          this.handlePathHighlighting();
        });
    },
    handlePathHighlighting() {
      const svg = d3.select("#graph-svg");
      const links = svg.select(".links").selectAll("g");
      links
        .classed("path-link", false)
        .filter((d) => this.highlighPath.find((e) => e.source === d.source.id && e.target === d.target.id))
        .classed("path-link", true);
    },
    getForceSimulation(width, height, data, links, nodes) {
      const density = 0.08680792891319207;
      const nodeDistance = d3.scaleLinear().domain([0, 0.1]).range([25, 500]).clamp(true);
      /* prettier-ignore */
      const forceSimulation = d3.forceSimulation()
        .force("charge", d3.forceManyBody().distanceMax(nodeDistance(density)))
        .force("link", d3.forceLink().distance(() => 100).id((d) => d.id))
        .force("center", d3.forceCenter(width / 2, height / 2));
      forceSimulation
        .nodes(data.nodes)
        .on("tick", this.tickUpdate(width, height, links, nodes))
        .force("link")
        .links(data.links);
      return forceSimulation;
    },
    tickUpdate(width, height, links, nodes) {
      return () => {
        links
          .select("line")
          .attr("x1", (d) => d.source.x)
          .attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x)
          .attr("y2", (d) => d.target.y);
        links
          .select("text")
          .attr("x", (d) => (d.source.x + d.target.x) / 2 - ("x years".length * 9) / 4)
          .attr("y", (d) => (d.source.y + d.target.y) / 2);

        const NODE_RADIUS = 9;
        const scale = { factor: 1, init: 1, dx: 0, dy: 0 };

        const getX = (d) => {
          const xMin = (NODE_RADIUS - scale.dx) / scale.factor;
          const xMax = (width - NODE_RADIUS - scale.dx) / scale.factor;
          return (d.x = Math.max(xMin, Math.min(xMax, d.x)));
        };
        const getY = (d) => {
          var yMin = (NODE_RADIUS - scale.dy) / scale.factor;
          const yMax = (height - NODE_RADIUS - scale.dy) / scale.factor;
          return (d.y = Math.max(yMin, Math.min(yMax, d.y)));
        };

        nodes
          .select("circle")
          .attr("cx", (d) => getX(d))
          .attr("cy", (d) => getY(d));

        nodes
          .select("text")
          .attr("x", (d) => getX(d) - (d.name.length * 14) / 4)
          .attr("y", (d) => getY(d) - 8);

        // const highlight = (d) => this.idsToHighlight.includes(d.id);
        // if (this.idsToHighlight.length) {
        //   // circle.attr("r", (d) => (highlight(d) ? 9 : 6));
        //   // circle.attr("class", (d) => (highlight(d) ? "highlight" : "blur"));
        //   // circleText.attr("class", (d) => (highlight(d) ? "highlight" : "blur"));
        // }
      };
    },
  },
  beforeDestroy() {
    d3.selectAll("#graph-svg > *").remove();
  },
};
</script>

<style lang="scss">
#graph-svg {
  .links {
    g {
      line {
        stroke: lightgray;
        stroke-opacity: 1;
        stroke-width: 1px;
      }
      text {
        font-size: 9px;
        /*** unselectable ****/
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        -khtml-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
      }
      &.highlight {
        line {
          stroke: rgb(10, 3, 3);
          stroke-opacity: 1;
        }
        text {
          opacity: 1;
          font-size: 10px;
          font-weight: bold;
        }
      }
      &.blur {
        line {
          stroke-opacity: 0.1;
        }
        text {
          opacity: 0.1;
          font-size: 10px;
          font-weight: normal;
        }
      }
      &.path-link {
        line {
          stroke: #669df6;
          stroke-opacity: 0.5;
          stroke-width: 4px;
        }
      }
    }
  }
  .nodes {
    g {
      circle {
        &:hover {
          cursor: pointer;
        }
      }
      text {
        font-size: 12px;
        /*** unselectable ****/
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        -khtml-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
      }
      &.highlight {
        circle {
          opacity: 1;
        }
        text {
          font-size: 12px;
          font-weight: bold;
          opacity: 1;
        }
      }
      &.blur {
        circle {
          opacity: 0.1;
        }
        text {
          font-size: 9px;
          font-weight: normal;
          opacity: 0.1;
        }
      }
    }
  }
}
</style>