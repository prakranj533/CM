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
      <Graph ref="graph" :nodeMap="sourceToDestinationNodeMap" :highlighPath="currPath" :height="300" />
    </div>
    <div class="paths-container" v-if="paths.length">
      <div class="timeline-container">
        <v-tabs v-model="pathModel">
          <v-tab v-for="(path, index) in paths" :key="index">Path {{ index + 1 }}/{{ paths.length }}</v-tab>
        </v-tabs>
        <v-tabs-items v-model="pathModel">
          <v-tab-item v-for="(path, index) in paths" :key="index">
            <div class="mt-4 text-body-1 font-weight-bold">
              Total Duration: {{ parseFloat(path.filter(e => e.duration).reduce((t, e) => t + parseFloat(e.duration), 0).toFixed(2)).toString() }} years
            </div>
            <v-timeline align-top dense>
              <v-timeline-item v-for="(entry, index) in path" :key="index" small fill-dot>
                <div class="text-body-1 font-weight-medium">{{ entry.name }}</div>
                <div class="caption">{{ index == 0 ? "Start" : entry.duration + " years" }}</div>
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
import PathFinder from "../utils/PathFinder";
import Graph from "../components/Graph";
import api from "../utils/api";

export default {
  name: "Home",
  components: { Graph },
  data: () => ({
    nodeMap: {},
    sourceNodeId: null,
    destinationNodeId: null,
    pathModel: 0,
  }),
  created(){
    this.getNodeMapJsonData();
  },
  computed: {
    allSourceNodes() {
      return Object.values(this.nodeMap).map(({ id, name }) => ({ id, name }));
    },
    allDestinationNodes() {
      return this.allSourceNodes.filter((e) => e.id !== this.sourceNodeId);
    },
    paths() {
      const pathFinder = new PathFinder(this.nodeMap);
      return this.sourceNodeId && this.destinationNodeId
        ? pathFinder.getAllPaths(this.sourceNodeId, this.destinationNodeId)
        : [];
    },
    currPath() {
      return this.paths.length
        ? this.paths[this.pathModel]
            .map((e) => e.id)
            .reduce((t, e, i, a) => {
              if (i < a.length - 1) t.push({ source: e, target: a[i + 1] });
              return t;
            }, [])
        : [];
    },
    totalDuration() {
      return this.paths[this.pathModel].map(e => e.duration);
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
  },
  methods: {
    getNodeMapJsonData(){
      api.get('/get-json-old-format', {
        // TODO: this needs to be improved
        // Since default localstorage of axios was taking old value of token
        // so had to add the auth header in the direct request
        headers: {
          "Authorization": "Bearer " + localStorage.getItem('token')
        }
      }).then(res => {
        this.nodeMap = JSON.parse(localStorage.getItem("nodeMap")) || res.data.jsonData;
      }).catch(err => {
        console.log('err', err)
      })
    },
  }
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