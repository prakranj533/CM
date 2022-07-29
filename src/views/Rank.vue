<template>
  <div class="home">
    <Navbar v-if="user && caller != 'app'" />
    <v-progress-circular
      style="display: block"
      class="show-loader"
      v-if="showLoader"
      indeterminate
      color="primary"
      :size="70"
      :width="7"
    ></v-progress-circular>
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
  </div>
</template>

<script>
import jwt from "jsonwebtoken";
import nGraphGraphCreateGraph from "ngraph.graph";
import nGraphCentrality from "ngraph.centrality";
import Navbar from "../components/Navbar.vue";
import { adminApi } from "../utils/api";
export default {
  name: "Rank",
  components: {
    Navbar,
  },
  data: () => ({
    showLoader: true,
    activeTab: 0,
    nodeMap: {},
    caller: null,
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
        let nodeIdOf8th;
        Object.values(map).find(function (value, index) {
          if (index == 0) {
            nodeIdOf8th = value.id;
            return nodeIdOf8th;
          }
        });
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
    if (!this.$store.state.user) {
      const user = jwt.decode(localStorage.getItem("refresh-token"));
      this.$store.dispatch("updateAuthState", user);
    }
    let urlParams = new URLSearchParams(window.location.search);
    this.$set(this, "caller", urlParams.get("caller"));
    const refreshToken = urlParams.get("refresh-token");
    if (refreshToken) {
      localStorage.setItem("refresh-token", refreshToken);
    }
  },
  mounted() {
    this.getJsonOldFormatData();
  },
  methods: {
    getJsonOldFormatData() {
      adminApi.get("/api/index/get-json-old-format").then((res) => {
        this.$set(this, "nodeMap", res.data.jsonData);
        this.$set(this, "showLoader", false);
      });
    },
    goToCareerPathFinder() {
      this.$router.push("/career-path-finder");
    },
    setActiveTab(index) {
      this.$set(this, "activeTab", index);
    },
  },
};
</script>

<style>
.centrality-table {
  max-height: initial !important;
  overflow: auto;
}
.tabs .active {
  background-color: #1976d2 !important;
  color: white;
}
.tabs > div {
  display: inline-block;
  width: 50%;
  padding: 10px;
  text-transform: uppercase;
  text-align: center;
  font-weight: bold;
  border: solid 1px #ccc;
  cursor: pointer;
}
</style>