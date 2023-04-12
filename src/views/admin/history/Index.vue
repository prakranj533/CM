<template>
  <div class="home">
    <Snackbar :snackbar="snackbar" />
    <div class="text-h5 text-center">Transaction History</div>
    <v-text-field v-model="search" append-icon="mdi-magnify" label="Search" single-line hide-details></v-text-field>
    <v-data-table
      :headers="headers"
      :items="historyData"
      :search="search"
      item-key="_id"
      class="elevation-1"
      :item-class="itemRowBackground"
      :items-per-page="50"
      :footer-props="{
        'items-per-page-options': [10, 20, 50, 100, -1],
      }"
    >
      <template slot="item.createdAt" slot-scope="props">
        {{ formatDate(props.item.createdAt) }}
      </template>
      <template slot="item.first_name" slot-scope="props">
        {{ `${props.item.first_name || ""} ${props.item.last_name || ""}` }}
      </template>
      <template slot="item.data" slot-scope="props">
        {{
          `${
            props.item.type == "PLAN_ACTIVATED" || props.item.type == "PLAN_APPLIED_NOT_ACTIVATED"
              ? props.item.data.plan_name
              : ""
          }`
        }}
      </template>
      <template slot="item._id" slot-scope="props">
        <div class="action-links">
          <a v-if="props.item.type == 'PLAN_APPLIED_NOT_ACTIVATED'" @click="activatePlan(props.item)">Activate</a>
          <router-link v-else :to="{ name: 'invoice-data', params: { id: props.item._id } }">Invoice</router-link>
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
  name: "Students-List",
  components: {
    Snackbar,
  },
  mixins: [snackbarMixin],
  data: () => ({
    headers: [
      { text: "Date", value: "createdAt" },
      { text: "Name", value: "user_name", align: "ws" },
      { text: "Phone No.", value: "phone_no" },
      { text: "Email.", value: "email" },
      { text: "Type", value: "type", align: " d-none" },
      { text: "", value: "data" },
      { text: "", value: "_id", width: "40px" },
    ],
    search: "",
    historyData: [],
    snackbar: {
      show: false,
      status: "",
      message: "",
    },
  }),
  computed: {},
  created() {
    this.getHistory();
  },
  methods: {
    itemRowBackground: function (item) {
      return `query-status-${item.status}`;
    },
    titleize(v) {
      return v.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    },
    async getHistory() {
      try {
        const res = await adminApi.get("/api/account/history", {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access-token"),
          },
        });
        if (res.data.success) {
          this.historyData = res.data.data;
          this.$store.dispatch("setHistoryData", res.data.data);
        }
      } catch (err) {
        console.log("err", err);
      }
    },
    async activatePlan(history) {
      const res = await adminApi.post("/api/payment/activate/" + history.data.payment_id, {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("access-token"),
        },
      });
      if (res.data.success) {
        await this.getHistory();
      }
    },
    formatDate(date) {
      return moment(date).format("MM/DD/YYYY hh:mm A");
    },
  },
};
</script>
  
  <style>
.container {
  max-width: 100%;
}
.counsellor-name {
  font-size: 12px;
  color: #000;
  font-weight: bold;
  text-transform: uppercase;
}
.query-status-open {
  background-color: rgb(239, 255, 229);
}
.query-status-closed {
  background-color: rgb(255, 238, 212);
}
.query-status-cancelled {
  background-color: rgb(255, 255, 212);
}
.text-ws {
  white-space: nowrap;
}
</style>