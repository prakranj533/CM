<template>
  <div class="home-container">
    <div class="input-container">
      <v-autocomplete
        outlined
        dense
        label="Starting Point"
        :items="allSourceNodes"
        item-text="name"
        item-value="id"
        v-model="sourceNodeId"
      />
      <v-autocomplete
        outlined
        dense
        label="Destination Point"
        :items="allDestinationNodes"
        item-text="name"
        item-value="id"
        v-model="destinationNodeId"
        :disabled="!sourceNodeId"
      />
    </div>
    <div class="mt-4 text-h4" v-if="sourceNodeId && destinationNodeId && paths.length == 0">Oops! No Path Found!</div>
    <div class="graph-container mt-8" v-if="paths.length">
      <v-row>
        <v-col cols="6">
          <Graph ref="graph" :nodeMap="sourceToDestinationNodeMap" :height="300" @nodeClicked="graphNodeClicked" />
        </v-col>
        <v-col cols="6">
          <v-simple-table>
            <template v-slot:default>
              <thead>
                <tr>
                  <th class="text-left">Name</th>
                  <th class="text-left">Centrality</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in centralityTable" :key="row.id">
                  <td>{{ row.name }}</td>
                  <td>{{ row.centrality }}</td>
                </tr>
              </tbody>
            </template>
          </v-simple-table>
        </v-col>
      </v-row>
    </div>
    <div class="paths-container" v-if="paths.length">
      <div class="timeline-container">
        <v-tabs v-model="pathModel">
          <v-tab v-for="(path, index) in paths" :key="index">Path {{ index }}/{{ paths.length }}</v-tab>
        </v-tabs>
        <v-tabs-items v-model="pathModel">
          <v-tab-item v-for="(path, index) in paths" :key="index">
            <div class="mt-4 text-body-1 font-weight-bold">
              Total Duration: {{ path.reduce((t, e) => t + e.duration, 0) }} years
            </div>
            <v-timeline align-top dense>
              <v-timeline-item v-for="(entry, index) in path" :key="index" small fill-dot>
                <div class="text-body-1 font-weight-medium">{{ entry.name }}</div>
                <div class="caption">{{ index == 0 ? "Start" : `${entry.duration} year` }}</div>
                <div class="caption" v-if="entry.skills.length">Skills - {{ entry.skills.join(", ") }}</div>
              </v-timeline-item>
            </v-timeline>
            <v-divider></v-divider>
            <div class="step-up-container mt-0">
              <table>
                <tr v-for="rowIndex in path.length" :key="rowIndex">
                  <td
                    v-for="colIndex in path.length"
                    :key="colIndex"
                    :class="{
                      step: rowIndex + colIndex == path.length + 1,
                      skills: rowIndex + colIndex == path.length + 2,
                      firstRow: rowIndex == 1,
                    }"
                  >
                    <span v-if="rowIndex + colIndex == path.length + 1">
                      {{ path[colIndex - 1].name }}
                    </span>
                    <span v-if="rowIndex + colIndex == path.length + 2">
                      {{ path[colIndex - 1].skills.join(", ") }}
                    </span>
                  </td>
                </tr>
              </table>
            </div>
          </v-tab-item>
        </v-tabs-items>
      </div>
    </div>
  </div>
</template>

<script>
import nodeMap from "../data/nodeMap.json";
import PathFinder from "../utils/PathFinder";
import Graph from "../components/Graph";
import nGraphGraphCreateGraph from "ngraph.graph";
import nGraphCentrality from "ngraph.centrality";

export default {
  name: "Home",
  components: { Graph },
  data: () => ({
    nodeMap,
    sourceNodeId: null,
    destinationNodeId: null,
    pathFinder: new PathFinder(nodeMap),
    pathModel: 0,
  }),
  computed: {
    allSourceNodes() {
      return Object.values(this.nodeMap).map(({ id, name }) => ({ id, name }));
    },
    allDestinationNodes() {
      return this.allSourceNodes.filter((e) => e.id !== this.sourceNodeId);
    },
    paths() {
      if (this.sourceNodeId && this.destinationNodeId) {
        this.$el.click();
        return this.pathFinder.getAllPaths(this.sourceNodeId, this.destinationNodeId);
      }
      return [];
    },
    sourceToDestinationNodeMap() {
      if (this.paths.length) {
        const sourceToDestinationNodeMap = {};
        this.paths.forEach((path) => {
          path.forEach((entry, index) => {
            const node = this.nodeMap[entry.id];
            let newNode = sourceToDestinationNodeMap[entry.id];
            if (!newNode) {
              newNode = {
                id: node.id,
                name: node.name,
                paths: [],
              };
              sourceToDestinationNodeMap[entry.id] = newNode;
            }
            // add child path
            if (index + 1 < path.length) {
              const childPath = node.paths.find((e) => e.to == path[index + 1].id);
              newNode.paths.push(childPath);
            }
          });
        });
        return sourceToDestinationNodeMap;
      }
      return {};
    },
    centralityTable() {
      const map = this.sourceToDestinationNodeMap;
      const nodes = [];
      const traverse = (id) => {
        const node = map[id];
        node.paths.forEach(({ to }) => {
          nodes.push({ source: id, destination: to });
          traverse(to);
        });
      };
      if (Object.keys(map).length) {
        traverse(this.sourceNodeId);
        // ref - https://github.com/anvaka/ngraph.centrality#closeness-centrality
        const g = nGraphGraphCreateGraph();
        nodes.forEach((e) => g.addLink(e.source, e.destination));
        const result = nGraphCentrality.closeness(g);
        return Object.keys(result).reduce((finalResult, e) => {
          const node = map[e];
          finalResult.push({ id: node.id, name: node.name, centrality: result[e] });
          return finalResult;
        }, []);
      }
      return nodes;
    },
  },
  watch: {
    sourceToDestinationNodeMap() {
      this.$refs.graph && this.$refs.graph.drawGraph();
    },
  },
  methods: {
    graphNodeClicked(nodeId) {
      console.log(nodeId);
    },
  },
};
</script>

<style lang="scss">
.timeline-container {
  overflow: auto;
}
.step-up-container {
  overflow: auto;
  table,
  td {
    border-collapse: collapse;
  }
  table {
    text-align: center;
    .step {
      width: 150px;
      padding: 12px;
      border-bottom: 1px solid black;
      border-right: 1px solid black;
      &.firstRow {
        border-right: 1px solid white;
      }
    }
    .skills {
      padding: 8px;
    }
  }
}
</style>