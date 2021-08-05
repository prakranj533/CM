<template>
  <div class="graph">
    <div class="svg-container">
        <v-progress-circular
            style="display: block;"
            class="show-loader"
            v-if="showLoader"
            indeterminate
            color="primary"
            :size="70"
            :width="7"
        ></v-progress-circular>
      <svg id="graph-svg"></svg>
    </div>
  </div>
</template>

<script>
import * as d3 from "d3v4";
import api from "./../utils/api";

export default {
    name: "Graph",
    data: () => ({
        nodeMap: null,
        width: 1000,
        height: 1000,
        texts: null,
        idsToHighlight: [],
        nodeMapObj: Object,
        currentZoom : Number,
        showLoader: true
    }),
    watch: {
    },
    mounted() {
        this.getJsonData(); 
        setTimeout(() => {
            this.showLoader = false;
            this.drawGraph();
        }, 2000);       
    },
    methods: {
        getJsonData(){
            api.get('/get-json-data').then(res => {
                this.nodeMap = res.data.jsonData;
            })       
        },
        drawGraph() {
            d3.selectAll("#graph-svg > *").remove();
            const data = this.nodeMap;
            const svgContainer = d3.select(".svg-container").node();
            const width = this.width || svgContainer.offsetWidth;
            const height = this.height || svgContainer.offsetHeight;
            const svg = d3.select("#graph-svg");
            svg.attr("viewBox", [0, 0, width, height]);
            svg.attr("pointer-events", "all")
            svg.on("click", () => d3.event.target.tagName !== "circle");
            var group = svg.append("g");
            svg.style("transform-origin", "50% 50% 0");
            svg.call(d3.zoom()
                .scaleExtent([1, 8])
                .translateExtent([[0,0],[width,height]])
                .on("zoom", function() {
                    group.attr("transform", d3.event.transform)
                })
            );

            const color = d3.scaleOrdinal(d3.schemeCategory10);
            
            const links = group
                .selectAll(".link")
                .data(data.links)
                .enter().append("line")
                .classed("links", true);

            const nodes = group
                .attr("class", "nodes")
                .selectAll("g")
                .data(data.nodes)
                .enter().append("circle")
                .attr("fill",(d) => color(d.id))
                .attr("r",6);

            const simulation = d3
                .forceSimulation()
                .nodes(data.nodes)
                .force("charge", d3.forceManyBody().strength(-100))
                .force("x",d3.forceX())
                .force("y",d3.forceY())
                .force("center", d3.forceCenter(width / 2, height / 2))
                .force("link", d3.forceLink().distance(70).id(function(d) { return d.id; }))
                .on("tick", this.tickUpdate(links,nodes));

            simulation
                .nodes(data.nodes)
                .on("tick", this.tickUpdate(links,nodes))
                .alphaDecay(0);

            simulation.force("link")
                .links(data.links);
            
            nodes.on("click", function() {
                d3.select(this).attr("r", 15);
                simulation.alpha(1).restart();
            });

            nodes.call(d3.drag()
                .on("start",function(){
                })
                .on("drag",() => {
                    nodes.fx = this.clamp(event.x, 0, width);
                    nodes.fy = this.clamp(event.y, 0, height);
                    simulation.alpha(1).restart();
                })
                .on("end", function(d)  {
                    d.fx = d3.event.x;
                    d.fy = d3.event.y;
                    d3.select(this).attr("class", "dragNodeStyle");
                    d3.select(this).attr("r",15)
                    simulation.alphaTarget(0);
                })
            );
            this.texts = group.selectAll("text.label")
                .data(data.nodes)
                .enter().append("text")
                .attr("class", "label")
                .text(function(d) {  return d.id;  });
            
        },
        clamp(x, lo, hi) {
            return x < lo ? lo : x > hi ? hi : x;
        },
        tickUpdate(links,nodes){
            return () => {
                links
                    .attr("x1", (d) => d.source.x)
                    .attr("y1", (d) => d.source.y)
                    .attr("x2", (d) => d.target.x)
                    .attr("y2", (d) => d.target.y);
                    
                nodes
                    .attr("cx", d => d.x)
                    .attr("cy", d => d.y);

                this.texts.attr("transform", function(d) {
                    return "translate(" + d.x + "," + d.y + ")";
                });
            }
        }
    },
    beforeDestroy() {
        d3.selectAll("#graph-svg > *").remove();
    }
};
</script>

<style lang="scss">
.dragNodeStyle {
    stroke: lightgray;
    stroke-width: 3px;
}
.links {
  stroke: lightgray;
  stroke-opacity: 1;
  stroke-width: 1px;
}
.nodes {
  cursor: pointer;
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
.svg-container{
    border: 1px solid red;
    height: 100%;
    width: 100%
}
.show-loader{
    display: block;
    width: 100px;
    margin: 30% auto
}
</style>