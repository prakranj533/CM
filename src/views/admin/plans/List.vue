<template>
  <div class="home">
    <Snackbar :snackbar="snackbar" />
    <div class="text-h5 text-center">Manage Plans</div>
    <v-row>
      <v-col class="text-right">
        <v-btn color="primary" to="/admin/plan/add" depressed>+ New Plan</v-btn>
      </v-col>
    </v-row>
    <v-text-field v-model="search" append-icon="mdi-magnify" label="Search" single-line hide-details></v-text-field>
    <v-data-table
      :headers="headers"
      :items="plans"
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
      <template slot="item.amount" slot-scope="props">
        {{ `₹ ${props.item.amount}/-` }}
      </template>
      <template slot="item._id" slot-scope="props">
        <div class="action-links">
          <router-link :to="{ name: 'plan-add', params: { id: props.item._id } }">Edit</router-link>
          <a @click="deletePlan(props.item)">Delete</a>
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
  name: "Plans-List",
  components: {
    Snackbar,
  },
  mixins: [snackbarMixin],
  data: () => ({
    headers: [
      { text: "Plan Name", value: "name" },
      { text: "Duration", value: "duration_text" },
      { text: "Amount", value: "amount" },
      { text: "Description", value: "description" },
      { text: "Created At", value: "createdAt" },
      { text: "", value: "_id", width: "40px" },
    ],
    search: "",
    plans: [],
    snackbar: {
      show: false,
      status: "",
      message: "",
    },
  }),
  computed: {},
  created() {
    this.getPlans();
  },
  methods: {
    async getPlans() {
      try {
        const res = await adminApi.get("/api/plan", {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access-token"),
          },
        });
        if (res.data.success) {
          this.plans = res.data.data;
          this.$store.dispatch("setPlans", res.data.data);
        }
      } catch (err) {
        console.log("err", err);
      }
    },
    formatDate(date) {
      return moment(date).format("MM/DD/YYYY");
    },
    deletePlan(plan) {
      if (confirm("Are you sure you want to delete this item?")) {
        adminApi
          .delete(`/api/plan/${plan._id}`, {
            headers: {
              Authorization: "Bearer " + localStorage.getItem("access-token"),
            },
          })
          .then((res) => {
            if (res.data.success) {
              const index = this.plans.indexOf(plan);
              this.plans.splice(index, 1);
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