<template>
  <div class="home">
    <v-list-item>
      <v-list-item-title class="text-h5">Probabilistic Career Maps on top</v-list-item-title>
      <v-spacer></v-spacer>
      <v-btn text @click="goToCareerPathFinder">Career Path Finder</v-btn>
    </v-list-item>
    <Graph ref="graph" :nodeMap="nodeMap" />
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