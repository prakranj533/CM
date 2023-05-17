<template>
  <div class="home">
    <Snackbar :snackbar="snackbar" />
    <div class="text-h5 text-center">Manage Devices</div>
    <v-row>
      <v-col class="text-right">
        <v-btn color="primary" to="/admin/device/add" depressed>+ New Device</v-btn>
      </v-col>
    </v-row>
    <v-text-field v-model="search" append-icon="mdi-magnify" label="Search" single-line hide-details></v-text-field>
    <v-data-table
      :headers="headers"
      :items="devices"
      :search="search"
      item-key="_id"
      class="elevation-1"
      :items-per-page="50"
      :footer-props="{
        'items-per-page-options': [10, 20, 50, 100, -1],
      }"
    >
      <template slot="item.createdAt" slot-scope="props">
        {{ formatDate(props.item.createdAt) }}
      </template>
      <template slot="item._id" slot-scope="props">
        <div class="action-links">
          <router-link :to="{ name: 'device-add', params: { id: props.item._id } }">Edit</router-link>
          <a @click="deleteDevice(props.item)">Delete</a>
        </div>
      </template>
    </v-data-table>
  </div>
</template>

<script>
import Snackbar from "../../../components/Snackbar.vue";
import snackbarMixin from "../../../mixins/snackbar";
import { adminApi } from "../../../utils/api";
import moment from "moment";
// import User from '../../../server/models/User';
export default {
  name: "Devices-List",
  components: {
    Snackbar,
  },
  mixins: [snackbarMixin],
  data: () => ({
    headers: [
      { text: "Device Name", value: "name" },
      { text: "Description", value: "description" },
      { text: "Created At", value: "createdAt" },
      { text: "", value: "_id", width: "40px" },
    ],
    search: "",
    devices: [],
    snackbar: {
      show: false,
      status: "",
      message: "",
    },
  }),
  computed: {},
  created() {
    this.getDevices();
  },
  methods: {
    async getDevices() {
      try {
        const res = await adminApi.get("/api/device", {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access-token"),
          },
        });
        if (res.data.success) {
          this.devices = res.data.data;
          this.$store.dispatch("setDevices", res.data.data);
        }
      } catch (err) {
        console.log("err", err);
      }
    },
    formatDate(date) {
      return moment(date).format("DD/MM/YYYY");
    },
    deleteDevice(device) {
      if (confirm("Are you sure you want to delete this item?")) {
        adminApi
          .delete(`/api/device/${device._id}`, {
            headers: {
              Authorization: "Bearer " + localStorage.getItem("access-token"),
            },
          })
          .then((res) => {
            if (res.data.success) {
              const index = this.devices.indexOf(device);
              this.devices.splice(index, 1);
            } else {
              this.callError(res.data.message);
            }
          })
          .catch((err) => {
            console.log("err", err);
          });
      }
    },
  },
};
</script>

<style>
.container {
  max-width: 100%;
}
.action-links {
  text-align: center;
  padding: 0 !important;
  white-space: nowrap;
}
.action-links a {
  margin: 5px 10px;
  display: inline-block;
  text-decoration: underline;
}
[role="columnheader"],
.text-ws {
  white-space: nowrap;
}
</style>