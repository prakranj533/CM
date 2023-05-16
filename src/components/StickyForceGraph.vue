<template>
  <div class="graph">
    <div class="svg-container">
      <div v-if="showLoader" style="display: flex;height: 100%;justify-content: center;align-items: center;">
        <v-progress-circular
          style="display: block"
          class="show-loader"
          v-if="showLoader"
          indeterminate
          color="primary"
          :size="70"
          :width="7"
        ></v-progress-circular>
      </div>
      <!-- <svg id="graph-svg"></svg> -->
      <div id="graph" style="height: 450px"></div>
    </div>
  </div>
</template>

<script>
import ForceGraph from "force-graph";
import { adminApi } from "../utils/api";
// import dataJson from "./data.json";
let linkedByIndex = {};
export default {
  name: "Graph",
  data: () => ({
    processed: {},
    nodeMap: null,
    width: 3000,
    height: 1000,
    texts: null,
    idsToHighlight: [],
    nodeMapObj: Object,
    currentZoom: Number,
    showLoader: true,
    linkedByIndexV1: {},
    thisOpacity: null,
    color: null,
    nodesById: {},
    data: {},
  }),
  watch: {},
  mounted() {
    this.getJsonData();
    setTimeout(() => {
      this.showLoader = false;
      this.drawGraph();
    }, 2000);
  },
  methods: {
    getJsonData() {
      adminApi
        .get("/api/index/get-json-data", {
          // TODO: this needs to be improved
          // Since default localstorage of axios was taking old value of token
          // so had to add the auth header in the direct request
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access-token"),
          },
        })
        .then((res) => {
          this.nodeMap = res.data.jsonData;
          // const rootId = 0;
          // const data = {
          //   nodes: dataJson.nodes.map((i) => ({
          //     id: i.id,
          //     group: i.group,
          //     collapsed: i.group !== rootId,
          //     childLinks: [],
          //   })),
          //   links: dataJson.links,
          // };
          // this.nodesById = Object.fromEntries(data.nodes.map((node) => [node.id, node]));
          // data.links.forEach((link) => {
          //   if (this.nodesById[link.source].childLinks.filter((x) => x.target === link.target).length === 0) {
          //     this.nodesById[link.source].childLinks.push(link);
          //   }
          // });
          // this.data = data;
        });
    },
    // setChildren(nodeId) {
    //   if (!this.processed[nodeId]) {
    //     this.processed[nodeId] = 1;
    //     const children = this.nodeMap.links.filter((x) => x.source == nodeId);
    //     if (children.length > 0) {
    //       return children.map((x) => {
    //         const obj = { name: x.target };
    //         const children2 = this.setChildren(x.target);
    //         if (children2 && children2.length > 0) {
    //           obj.children = children2;
    //           //obj.value = children2.length;
    //         } else {
    //           obj.value = 1;
    //         }
    //         return obj;
    //       });
    //     } else {
    //       return [];
    //     }
    //   }
    // },
    // formatData() {
    //   const ssData = { name: "careermap", children: [] };
    //   const skips = ["12th (H.S.C.)", "8th", "10th (S.S.C.)", "Photo Editing", "Photoshop Master (2 months)"];
    //   Object.keys(this.nodeMap.nodes).forEach((nodeId) => {
    //     const node = this.nodeMap.nodes[nodeId];
    //     if (skips.indexOf(node.id) == -1) {
    //       const dNode = { name: node.id, children: [] };
    //       dNode.children = (this.setChildren(node.id) || []).filter((x) => x.children && x.children.length > 0);
    //       // dNode.value = dNode.children.length;
    //       if (dNode.children.length > 0) {
    //         ssData.children.push(dNode);
    //       } else {
    //         dNode.value = 1;
    //       }
    //     }
    //   });
    //   console.log(ssData);
    //   return ssData;
    // },

    getPrunedTree() {
      const visibleNodes = [];
      const visibleLinks = [];
      const _nodesById = this.nodesById;
      (function traverseTree(node = _nodesById["MotherInnocent"]) {
        visibleNodes.push(node);
        if (node.collapsed) return;
        visibleLinks.push(...node.childLinks);
        node.childLinks
          .map((link) => (typeof link.target === "object" ? link.target : _nodesById[link.target])) // get child node
          .forEach(traverseTree);
      }).bind(this)(); // IIFE

      return { nodes: visibleNodes, links: visibleLinks };
    },
    getPrunedTreeStart(data) {
      const visibleNodes = [];
      const visibleLinks = [];
      const _nodesById = this.nodesById;
      function traverseTree(node) {
        visibleNodes.push(node);
        if (node.collapsed) return;
        visibleLinks.push(...node.childLinks);
        node.childLinks
          .map((link) => (typeof link.target === "object" ? link.target : _nodesById[link.target])) // get child node
          .forEach(traverseTree);
      }
      data.nodes.filter((x) => x.group === 0).forEach(traverseTree);
      return { nodes: visibleNodes, links: visibleLinks };
    },
    drawGraph() {
      const rootId = 0;

      // Random tree
      //const N = 300;
      //   const gData = {
      //     nodes: [...Array(N).keys()].map((i) => ({ id: i, collapsed: i !== rootId, childLinks: [] })),
      //     links: [...Array(N).keys()]
      //       .filter((id) => id)
      //       .map((id) => ({
      //         source: Math.round(Math.random() * (id - 1)),
      //         target: id,
      //       })),
      //   };
      // const zero = dataJson.nodes.filter((x) => x.group === 0);
      const skips = ["12th (H.S.C.)", "8th", "10th (S.S.C.)", "Photo Editing", "Photoshop Master (2 months)"];
      const zero = this.nodeMap.nodes.filter((x) => skips.indexOf(x.id) !== -1);
      const zeroLinks = zero.map((x) => ({ source: "Root", target: x.id, value: 1, group: 0 }));
      // const gData = {
      //   nodes: dataJson.nodes.map((i) => ({ id: i.id, group: i.group, collapsed: i.group !== rootId, childLinks: [] })),
      //   links: dataJson.links.concat(zeroLinks),
      // };
      const gData = {
        nodes: this.nodeMap.nodes.map((i) => ({
          id: i.id,
          group: i.group,
          collapsed: i.group !== rootId,
          childLinks: [],
        })),
        links: this.nodeMap.links.concat(zeroLinks),
      };
      // link parent/children
      const nodesById = Object.fromEntries(gData.nodes.map((node) => [node.id, node]));
      nodesById["Root"] = { id: "Root", collapsed: false, childLinks: [], group: 0 };
      gData.links.forEach((link) => {
        nodesById[typeof link.source === "object" ? link.source.id : link.source].childLinks.push(link);
      });

      const getPrunedTree = () => {
        const visibleNodes = [];
        const visibleLinks = [];

        (function traverseTree(node = nodesById["Root"]) {
          visibleNodes.push(node);
          if (node.collapsed) return;
          visibleLinks.push(...node.childLinks);
          node.childLinks
            .map((link) => (typeof link.target === "object" ? link.target : nodesById[link.target])) // get child node
            .forEach(traverseTree);
        })(); // IIFE

        return { nodes: visibleNodes, links: visibleLinks };
      };
      // var colorArray = [
      //   "#FF6633",
      //   "#FFB399",
      //   "#FF33FF",
      //   "#FFFF99",
      //   "#00B3E6",
      //   "#E6B333",
      //   "#3366E6",
      //   "#999966",
      //   "#99FF99",
      //   "#B34D4D",
      //   "#80B300",
      //   "#809900",
      //   "#E6B3B3",
      //   "#6680B3",
      //   "#66991A",
      //   "#FF99E6",
      //   "#CCFF1A",
      //   "#FF1A66",
      //   "#E6331A",
      //   "#33FFCC",
      //   "#66994D",
      //   "#B366CC",
      //   "#4D8000",
      //   "#B33300",
      //   "#CC80CC",
      //   "#66664D",
      //   "#991AFF",
      //   "#E666FF",
      //   "#4DB3FF",
      //   "#1AB399",
      //   "#E666B3",
      //   "#33991A",
      //   "#CC9999",
      //   "#B3B31A",
      //   "#00E680",
      //   "#4D8066",
      //   "#809980",
      //   "#E6FF80",
      //   "#1AFF33",
      //   "#999933",
      //   "#FF3380",
      //   "#CCCC00",
      //   "#66E64D",
      //   "#4D80CC",
      //   "#9900B3",
      //   "#E64D66",
      //   "#4DB380",
      //   "#FF4D4D",
      //   "#99E6E6",
      //   "#6666FF",
      // ];

      const elem = document.getElementById("graph");
      const width = Math.min(this.width, elem.offsetWidth);
      const height = Math.min(this.height, elem.offsetHeight);
      let hoverNode = null;
      let clickedNode = null;
      const Graph = ForceGraph()(elem)
        .width(width)
        .height(height)
        .graphData(getPrunedTree())
        .linkDirectionalArrowLength(8)
        .onNodeHover((node) => {
          elem.style.cursor = node && node.childLinks.length ? "pointer" : null;
          if (node && node.childLinks.length) {
            hoverNode = node;
          }
        })
        .onNodeClick((node) => {
          if (node.childLinks.length) {
            node.collapsed = !node.collapsed; // toggle collapse state
            Graph.graphData(getPrunedTree());
            clickedNode = node;
          }
          Graph.centerAt(node.x, node.y, 1000);

          // Graph.zoom(8, 2000);
          Graph.zoomToFit(1000);
        })
        //.linkDirectionalParticles(1)
        //.nodeAutoColorBy("group")
        //.linkDirectionalParticleWidth(2.5)
        // .nodeColor((node) => (!node.childLinks.length ? "green" : node.collapsed ? "red" : "yellow"))
        //   //   const data = {
        //   //     //nodes: this.nodeMap.map(i => ({ id: i, collapsed: i !== rootId, childLinks: [] })),
        //   //     nodes: this.formatData().children,
        //   //     links: this.nodeMap.links,
        //   //   };

        //   const elem = document.getElementById("graph");
        //   const Graph = ForceGraph()(elem)
        //     .graphData(this.getPrunedTreeStart(this.data))
        //     //.nodeId("id")
        //     .nodeColor((node) => (!node.childLinks.length ? "green" : node.collapsed ? "red" : "yellow"))
        //     //.nodeAutoColorBy("group")
        //     .onNodeHover((node) => (elem.style.cursor = node && node.childLinks.length ? "pointer" : null))
        //     .onNodeClick((node) => {
        //       if (node.childLinks.length) {
        //         node.collapsed = !node.collapsed; // toggle collapse state
        //         Graph.graphData(this.getPrunedTree());
        //       }
        //     })
        //     .linkDirectionalParticles(1)
        //     .linkDirectionalParticleWidth(2.5);
        .nodeCanvasObject((node, ctx, globalScale) => {
          const label = node.id;
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;
          const textWidth = ctx.measureText(label).width;
          const bckgDimensions = [textWidth, fontSize].map((n) => n + fontSize * 0.2); // some padding

          ctx.fillStyle = "rgba(255, 255, 255, 0)";
          ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, ...bckgDimensions);

          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "black"; //!node.childLinks.length ? "green" : node.collapsed ? "red" : "yellow"; // node.color || colorArray[node.group];
          ctx.fillText(label, node.x, node.y - (node === clickedNode ? 20 : 10));
          ctx.beginPath();
          ctx.arc(node.x, node.y, node === hoverNode || node === clickedNode ? 10 : 5, 0, 2 * Math.PI);
          ctx.fillStyle = !node.childLinks.length ? "green" : node.collapsed ? "red" : "yellow"; // node.color || colorArray[node.group];
          ctx.fill();
          node.__bckgDimensions = bckgDimensions; // to re-use in nodePointerAreaPaint
        })
        .nodePointerAreaPaint((node, color, ctx) => {
          ctx.fillStyle = color;
          const bckgDimensions = node.__bckgDimensions;
          bckgDimensions &&
            ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, ...bckgDimensions);
        });

      Graph.d3Force("center", null);
      Graph.enableNodeDrag(false);
      // fit to canvas when engine stops
      // Graph.onEngineStop(() => Graph.zoomToFit(400));
    },
    clamp(x, lo, hi) {
      return x < lo ? lo : x > hi ? hi : x;
    },
    tickUpdate(links, nodes) {
      return () => {
        links
          .attr("x1", (d) => d.source.x)
          .attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x)
          .attr("y2", (d) => d.target.y);
        nodes.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
        this.texts.attr("transform", function (d) {
          return "translate(" + d.x + "," + d.y + ")";
        });
      };
    },
    isConnected(a, b) {
      return linkedByIndex[`${a.index},${b.index}`] || linkedByIndex[`${b.index},${a.index}`] || a.index === b.index;
    },
  },
  beforeDestroy() {
    // d3.selectAll("#graph-svg > *").remove();
  },
};
</script>

<style lang="scss">
.blur-text {
  opacity: 0.1;
}
.dragNodeStyle {
  stroke: lightgray;
  stroke-width: 3px;
}
.links {
  stroke: lightgray;
  //   stroke-opacity: 1;
  stroke-width: 1.5px;
}
.nodes {
  cursor: pointer;
  stroke-width: 1px;
  stroke-opacity: 1;
}
.label {
  font-size: 9px;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -khtml-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
.svg-container {
  border: 1px solid red;
  height: 500px;
  width: 100%;
}
.mobileView .svg-container {
  height: auto;
}
.show-loader {
  display: block;
  width: 100px;
  margin: 30% auto;
}
#end {
  fill: #555;
  fill-opacity: 0.3;
}
#end-active {
  fill: #555;
  fill-opacity: 0;
}
</style>