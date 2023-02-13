<template>
  <div class="home">
    <Snackbar :snackbar="snackbar" />
    <div class="text-h5 text-center">Devices for School: {{ this.school.name }}</div>
    <v-data-table
      v-model="selected"
      :headers="headers"
      :items="devices"
      :single-select="singleSelect"
      item-key="_id"
      class="elevation-1"
      show-select
      :items-per-page="50"
      :footer-props="{
        'items-per-page-options': [10, 20, 50, 100, -1],
      }"
    ></v-data-table>
    <v-btn class="float-right" color="primary" @click="handleSaveDevices" depressed>Save</v-btn>
    <v-btn class="float-right mr-1" color="secondary" to="/admin/school/list" depressed>Cancel</v-btn>
  </div>
</template>

<script>
import Snackbar from "../../../components/Snackbar.vue";
import snackbarMixin from "../../../mixins/snackbar";
import { adminApi } from "../../../utils/api";
import moment from "moment";
// import User from '../../../server/models/User';
export default {
  name: "Schools-List",
  components: {
    Snackbar,
  },
  mixins: [snackbarMixin],
  props: ["id"],
  data: () => ({
    singleSelect: false,
    selected: [],
    headers: [
      { text: "Device", value: "name" },
      { text: "", value: "description" },
    ],
    search: "",
    devices: [],
    school: {},
    snackbar: {
      show: false,
      status: "",
      message: "",
    },
  }),
  computed: {},
  created() {
    this.getCoupons();
    this.getSchool();
  },
  methods: {
    async getCoupons() {
      try {
        const response = await adminApi.get(`/api/device`, {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access-token"),
          },
        });
        console.log(response.data.data);
        if (response.data.success) {
          this.devices = response.data.data;
        }
      } catch (err) {
        console.log("err", err);
      }
    },
    async getSchool() {
      if (this.id) {
        const response = await adminApi.get(`/api/school/${this.id}`, {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access-token"),
          },
        });
        if (response.data.success) {
          this.school = response.data.data[0];
          this.selected = this.school.devices;
        }
      }
    },
    async handleSaveDevices() {
      try {
        let formData = {
          devices: this.selected.map((x) => ({ _id: x._id, name: x.name })),
        };
        const response = await adminApi.post(`/api/school/devices/${this.id}`, formData, {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access-token"),
          },
        });
        if (response.data.success) {
          this.callSuccess(response.data.message);
          setTimeout(() => {
            this.$router.push("/admin/school/list");
          }, 1000);
        } else {
          this.callError(response.data.message);
        }
      } catch (e) {
        console.log(e);
        if (e?.response?.data.message === "Invalid data.") {
          this.callError(e?.response?.data.error.map((e) => Object.values(e).join(",")).join("<br/>"), true);
        } else {
          this.callError(e?.response?.data.message || e.message);
        }
      }
    },
    formatDate(date) {
      return moment(date).format("MM/DD/YYYY");
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