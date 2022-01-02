<template>
  <div class="manage-nodes">
    <Navbar />
    <v-list-item>
      <v-spacer></v-spacer>
      <v-btn text @click="downloadNodeMap">Download Node Map</v-btn>
      <v-btn text @click="openCsvDialog">Upload CSV</v-btn>
    </v-list-item>
    <UploadCSVDialog :config="createCsvDialogConfig"></UploadCSVDialog>
    <Graph ref="graph" :nodeMap="nodeMap" @nodeClicked="nodeClicked" :height="900" />
    <ManageNodeDialog :nodeMap="nodeMap" :config="createNodeDialogConfig" @updated="nodeMapUpdated" />
  </div>
</template>

<script>
import ManageNodeDialog from "../components/manage-nodes/ManageNodeDialog";
import Graph from "../components/Graph";
import UploadCSVDialog from "../components/UploadCsvDialog";
import api from "../utils/api";
import Navbar from "../components/Navbar.vue";

export default {
  name: "ManageNodes",
  components: {
    ManageNodeDialog,
    Graph,
    UploadCSVDialog,
    Navbar
  },
  data: () => ({
    nodeMap : {},
    createNodeDialogConfig: {
      model: false,
      nodeName: "",
      nodeId: "",
    },
    createCsvDialogConfig: {
      model: false
    }
  }),
  created(){
    this.getNodeMapJsonData();
  },
  methods: {
    getNodeMapJsonData(){
      api.get('/get-json-old-format', {
        // TODO: this needs to be improved
        // Since default localstorage of axios was taking old value of token
        // so had to add the auth header in the direct request
        headers: {
          "Authorization": "Bearer " + localStorage.getItem('access-token')
        }
      }).then(res => {
        this.nodeMap = JSON.parse(localStorage.getItem("nodeMap")) || res.data.jsonData;
      }).catch(err => {
        console.log('err', err)
      })
    },
    nodeClicked(nodeId) {
      const node = this.nodeMap[nodeId];
      this.createNodeDialogConfig.model = true;
      this.createNodeDialogConfig.nodeName = node.name;
      this.createNodeDialogConfig.nodeId = nodeId;
    },
    nodeMapUpdated() {
      this.$refs.graph.drawGraph();
    },
    downloadNodeMap() {
      const downloadAnchorNode = document.createElement("a");
      downloadAnchorNode.setAttribute(
        "href",
        `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(this.nodeMap))}`
      );
      downloadAnchorNode.setAttribute("download", "nodes.json");
      document.body.appendChild(downloadAnchorNode); // required for firefox
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    },
    openCsvDialog(){
      this.createCsvDialogConfig = {
        model: true
      }
    }
  },
};
</script>