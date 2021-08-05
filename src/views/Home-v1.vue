<template>
  <div class="home">
    <div class="text-h5 text-center">Probabilistic Career Maps</div>
    <Graph ref="graph" :nodeMap="nodeMap" :height="900" />
     <div style="display: flex; justify-content: center" class="mt-12">
      <v-btn color="primary" elevation="5" large @click="goToCareerPathFinder">Career Path Finder</v-btn>
    </div>
    <v-simple-table class="centrality-table mt-6">
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
            <td>{{ parseFloat(row.centrality.toFixed(3)) }}</td>
          </tr>
        </tbody>
      </template>
    </v-simple-table>

    <v-list-item-title class="my-8 text-center text-body-2">Feedback: lifelonglearning.in@gmail.com</v-list-item-title>
  </div>
</template>

<script>
import nodeMap from "../data/nodeMap.json";
import Graph from "../components/Graph";
import nGraphGraphCreateGraph from "ngraph.graph";
import nGraphCentrality from "ngraph.centrality";

export default {
  name: "Home",
  components: { Graph },
  data: () => ({
    nodeMap,
  }),
  computed: {
    centralityTable() {
      const map = this.nodeMap;
      const nodes = [];
      const traverse = (id) => {
        const node = map[id];
        node.paths.forEach(({ to }) => {
          nodes.push({ source: id, destination: to });
          traverse(to);
        });
      };
      if (Object.keys(map).length) {
        // const nodeIdOf8th = Object.values(map).find(e => "10th (S.S.C.)" === e.name).id;
        // console.log('nodeIdOf8th', nodeIdOf8th)
        let nodeIdOf8th
        Object.values(map).find(function(value,index){
          if(index == 0){
            nodeIdOf8th = value.id
            return nodeIdOf8th
          }
        })
        traverse(nodeIdOf8th);
        // ref - https://github.com/anvaka/ngraph.centrality#betweenness-centrality
        const g = nGraphGraphCreateGraph();
        nodes.forEach((e) => g.addLink(e.source, e.destination));
        let result = nGraphCentrality.betweenness(g);
        return Object.keys(result).reduce((finalResult, e) => {
          const node = map[e];
          finalResult.push({ id: node.id, name: node.name, centrality: result[e] });
          return finalResult;
        }, []);
      }
      return nodes;
    },
  },
  methods: {
    goToCareerPathFinder() {
      this.$router.push("/career-path-finder");
    },
  },
};
</script>

<style>
.centrality-table {
  max-height: 440px !important;
  overflow: auto;
}
</style>