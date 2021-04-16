<template>
  <div class="home">
    <div class="text-h5 text-center">Probabilistic Career Maps</div>
    <Graph ref="graph" :nodeMap="nodeMap" :height="900" />
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
    <div style="display: flex; justify-content: center" class="mt-12">
      <v-btn color="primary" elevation="5" large @click="goToCareerPathFinder">Career Path Finder</v-btn>
    </div>
    <v-list-item-title class="my-8 text-center text-body-2">Feedback: lifelonglearning.in@gmail.com</v-list-item-title>
  </div>
</template>

<script>
import nodeMap from "../data/nodeMap.json";
import Graph from "../components/Graph";
import nGraphGraphCreateGraph from "ngraph.graph";
import nGraphCentrality from "ngraph.centrality";

const lllDefaultNode = "ad2ec013-a9d6-42ee-9401-aa09b0a69c5f";

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
        traverse(lllDefaultNode);
        // ref - https://github.com/anvaka/ngraph.centrality#betweenness-centrality
        const g = nGraphGraphCreateGraph();
        nodes.forEach((e) => g.addLink(e.source, e.destination));
        const result = nGraphCentrality.betweenness(g);
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