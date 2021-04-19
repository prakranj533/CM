<template>
  <v-dialog v-model="config.model" max-width="700">
    <v-card>
      <v-card-title>
        Manage Node -
        <span class="ml-1">{{ config.nodeName }}</span>
        <v-spacer></v-spacer>
        <v-btn text @click="config.model = false">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>
      <v-card-text>
        <v-tabs v-model="tabModel">
          <v-tab>Edit Node Name</v-tab>
          <v-tab>Add Child Node</v-tab>
          <v-tab>Update Path</v-tab>
        </v-tabs>
        <v-tabs-items v-model="tabModel">
          <v-tab-item>
            <v-text-field
              class="mt-4"
              label="Node Name"
              v-model="editedNodeName"
              dense
              :error-messages="
                config.nodeName === editedNodeName
                  ? ''
                  : isEditedNodeNameAlreadyExists
                  ? 'Node name already exists'
                  : ''
              "
              isEditedNodeNameAlreadyExists
              outlined
            />
            <v-btn
              class="mt-4"
              text
              @click="saveEditedNodeName"
              :disabled="config.nodeName === editedNodeName || !editedNodeName"
            >
              Save
            </v-btn>
          </v-tab-item>
          <v-tab-item>
            <v-radio-group v-model="radioGroupModel" class="mt-0">
              <v-radio value="new">
                <template #label>
                  <v-text-field
                    dense
                    v-model="childNodeName"
                    label="New Node Name"
                    outlined
                    clearable
                    class="mt-4"
                    :error-messages="
                      isChildNodeNameAlreadyExists ? 'Node already present, select from existing nodes!' : ''
                    "
                    :disabled="radioGroupModel != 'new'"
                  />
                </template>
              </v-radio>
              <v-radio value="existing">
                <template #label>
                  <v-autocomplete
                    :items="possibleChildNodes"
                    item-text="name"
                    item-value="id"
                    v-model="childNodeId"
                    outlined
                    label="Existing Node"
                    dense
                    hint="Existing Nodes, excluding already connected nodes"
                    persistent-hint
                    :disabled="radioGroupModel != 'existing'"
                  />
                </template>
              </v-radio>
            </v-radio-group>
            <v-text-field
              prepend-icon="mdi-blank"
              label="Duration"
              v-model="duration"
              type="number"
              dense
              outlined
            />
            <v-text-field prepend-icon="mdi-blank" label="Skills" v-model="skills" dense outlined hide-details />
            <v-btn class="mt-4 ml-8" text @click="addChild" :disabled="isSaveButtonDisabled">Save</v-btn>
          </v-tab-item>
          <v-tab-item>
            <v-select
              label="Destination Node"
              v-model="destinationNodeId"
              :items="destinationNodeItems"
              item-value="id"
              item-text="name"
              dense
              outlined
              class="mt-4"
            />
            <v-text-field
              label="Duration"
              v-model="duration"
              type="number"
              dense
              outlined
              :disabled="!destinationNodeId"
            />
            <v-text-field label="Skills" v-model="skills" dense outlined hide-details :disabled="!destinationNodeId" />
            <v-btn class="mt-4" text @click="updatePath" :disabled="!destinationNodeId">Save</v-btn>
          </v-tab-item>
        </v-tabs-items>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script>
import { v4 as uuidv4 } from "uuid";

export default {
  name: "ManageNodeDialog",
  props: {
    config: Object,
    nodeMap: Object,
  },
  data() {
    return {
      tabModel: 0,
      radioGroupModel: "new",
      childNodeName: "",
      childNodeId: "",
      duration: "",
      skills: "",
      editedNodeName: "",
      destinationNodeId: "",
    };
  },
  watch: {
    "config.model": {
      handler(model) {
        if (model) {
          this.editedNodeName = this.config.nodeName;
          this.radioGroupModel = "new";
          this.childNodeName = "";
          this.childNodeId = "";
          this.duration = "";
          this.skills = "";
        }
      },
    },
    destinationNodeId(destinationNodeId) {
      if (this.config.nodeId) {
        const node = this.nodeMap[this.config.nodeId];
        const path = node.paths.find((e) => e.to === destinationNodeId);
        this.duration = path.duration;
      }
    },
  },
  computed: {
    destinationNodeItems() {
      if (this.config.nodeId)
        return this.nodeMap[this.config.nodeId].paths.map((path) => {
          const node = this.nodeMap[path.to];
          return { id: node.id, name: node.name };
        });
      return [];
    },
    isEditedNodeNameAlreadyExists() {
      return this.isNodeNameAlreadyExists(this.editedNodeName);
    },
    isChildNodeNameAlreadyExists() {
      return this.isNodeNameAlreadyExists(this.childNodeName);
    },
    possibleChildNodes() {
      const { id, paths } = this.nodeMap[this.config.nodeId];
      const ids = [id, ...paths.map((e) => e.to)];
      return Object.keys(this.nodeMap)
        .filter((id) => !ids.includes(id))
        .reduce((allNodes, id) => {
          allNodes.push(this.nodeMap[id]);
          return allNodes;
        }, []);
    },
    isSaveButtonDisabled() {
      return (!this.childNodeName && !this.childNodeId) || this.isChildNodeNameAlreadyExists;
    },
  },
  methods: {
    addChild() {
      let childNodeId = this.childNodeId;
      if (!childNodeId) {
        childNodeId = uuidv4();
        const newNode = {
          id: childNodeId,
          name: this.childNodeName,
          paths: [],
        };
        this.$set(this.nodeMap, childNodeId, newNode);
      }
      const parentNode = this.nodeMap[this.config.nodeId];
      parentNode.paths.push({
        to: childNodeId,
        duration: this.duration,
        skills: this.skills,
      });
      this.notify();
    },
    isNodeNameAlreadyExists(name) {
      return Object.values(this.nodeMap).some((e) => e.name == name);
    },
    saveEditedNodeName() {
      const node = this.nodeMap[this.config.nodeId];
      node.name = this.editedNodeName;
      this.notify();
    },
    updatePath() {
      const node = this.nodeMap[this.config.nodeId];
      const path = node.paths.find((e) => e.to === this.destinationNodeId);
      path.duration = this.duration;
      path.skills = this.skills;
      this.notify();
    },
    notify() {
      localStorage.setItem("nodeMap", JSON.stringify(this.nodeMap));
      this.config.model = false;
      this.$emit("updated");
    },
  },
};
</script>

<style>
</style>