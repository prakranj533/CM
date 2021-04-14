<template>
  <div class="home">
    <div class="text-h5 text-center">Probabilistic Career Maps</div>
    <Graph ref="graph" :nodeMap="nodeMap" />
    <div style="display: flex; justify-content: center;">
      <v-btn text @click="goToCareerPathFinder">Career Path Finder</v-btn>
    </div>
    <v-list-item-title class="my-8 text-center text-body-2">Feedback: lifelonglearning.in@gmail.com</v-list-item-title>
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