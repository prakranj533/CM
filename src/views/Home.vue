<template>
  <div class="home">
    <Navbar v-if="user" />
    <div class="text-h5 text-center">Probabilistic Career Maps</div>
    <h4 class="text-center subtitle-1">See your career – Search your path – Seek your guide</h4>
    <StickyForceLayout />
     <div style="display: flex; justify-content: center" class="mt-12">
      <v-btn color="primary" elevation="5" large @click="goToCareerPathFinder">Career Path Finder</v-btn>
    </div>
    <v-simple-table class="centrality-table mt-6">
      <template v-slot:default>
        <thead>
          <tr>
            <th class="text-left">Name</th>
            <th class="text-left">Rank</th>
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
    <v-list-item-title class="mt-3 mb-2 text-center text-body-2">
      Contact us to become a career guide and to earn money
    </v-list-item-title>
    <v-list-item-title class="my-3 text-center text-body-2">
      Feedback: lifelonglearning.in@gmail.com
    </v-list-item-title>
  </div>
</template>

<script>
import jwt from "jsonwebtoken";
import nodeMap from "../data/nodeMap.json";
import StickyForceLayout from "../components/StickyForceLayout";
import nGraphGraphCreateGraph from "ngraph.graph";
import nGraphCentrality from "ngraph.centrality";
import Navbar from "../components/Navbar.vue";

export default {
  name: "Home",
  components: {
    StickyForceLayout,
    Navbar
  },
  data: () => ({
    nodeMap,
  }),
  computed: {
    user() {
      return this.$store.state.user;
    },
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
        let nodeIdOf8th
        Object.values(map).find(function(value,index){
          if(index == 0){
            nodeIdOf8th = value.id
            return nodeIdOf8th
          }
        })
        traverse(nodeIdOf8th);
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
  created() {
    if(!this.$store.state.user) {
      const user = jwt.decode(localStorage.getItem('refresh-token'));
      this.$store.dispatch('updateAuthState', user);
    }
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