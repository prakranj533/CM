<template>
  <div class="home">
    <v-list-item>
      <v-spacer></v-spacer>
      <v-btn text @click="goToCareerPathFinder">Career Path Finder</v-btn>
    </v-list-item>
    <Graph ref="graph" :nodeMap="nodeMap" />
  </div>
</template>

<script>
import nodeMap from "../data/nodeMap.json";
import Graph from "../components/Graph";

export default {
  name: "Home",
  components: { Graph },
  data: () => ({
    nodeMap,
  }),
  methods: {
    goToCareerPathFinder() {
      this.$router.push("/career-path-finder");
    },
  },
};
</script>

<style>
</style>