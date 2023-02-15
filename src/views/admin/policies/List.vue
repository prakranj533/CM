<template>
  <div class="home">
    <Snackbar :snackbar="snackbar" />
    <div class="text-h5 text-center">Manage Policies</div>
    <v-row>
      <v-col class="text-right">
        <v-btn color="primary" to="/admin/policy/add" depressed>+ New Policy</v-btn>
      </v-col>
    </v-row>
    <v-text-field v-model="search" append-icon="mdi-magnify" label="Search" single-line hide-details></v-text-field>
    <v-data-table
      :headers="headers"
      :items="policies"
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
          <router-link :to="{ name: 'policy-add', params: { id: props.item._id } }">Edit</router-link>
          <a @click="deletePolicy(props.item)">Delete</a>
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
  name: "Policies-List",
  components: {
    Snackbar,
  },
  mixins: [snackbarMixin],
  data: () => ({
    headers: [
      { text: "Policy Name", value: "name" },
      { text: "Amount", value: "amount" },
      { text: "Description", value: "description" },
      { text: "Created At", value: "createdAt" },
      { text: "", value: "_id", width: "40px" },
    ],
    search: "",
    policies: [],
    snackbar: {
      show: false,
      status: "",
      message: "",
    },
  }),
  computed: {},
  created() {
    this.getPolicies();
  },
  methods: {
    async getPolicies() {
      try {
        const res = await adminApi.get("/api/policy", {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access-token"),
          },
        });
        if (res.data.success) {
          this.policies = res.data.data;
          this.$store.dispatch("setPolicies", res.data.data);
        }
      } catch (err) {
        console.log("err", err);
      }
    },
    formatDate(date) {
      return moment(date).format("MM/DD/YYYY");
    },
    deletePolicy(policy) {
      if (confirm("Are you sure you want to delete this item?")) {
        adminApi
          .delete(`/api/policy/${policy._id}`, {
            headers: {
              Authorization: "Bearer " + localStorage.getItem("access-token"),
            },
          })
          .then((res) => {
            if (res.data.success) {
              const index = this.policies.indexOf(policy);
              this.policies.splice(index, 1);
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