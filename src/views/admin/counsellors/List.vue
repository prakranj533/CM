<template>
  <div class="home">
    <div class="text-h5 text-center">Manage Counsellor</div>
    <v-row>
      <v-col class="text-right">
        <v-btn color="primary" to="/admin/counsellor/add" depressed>+ New Counsellor</v-btn>
      </v-col>
    </v-row>
    <v-text-field v-model="search" append-icon="mdi-magnify" label="Search" single-line hide-details></v-text-field>
    <v-data-table
      :headers="headers"
      :items="counsellors"
      :search="search"
      item-key="_id"
      class="elevation-1"
      :items-per-page="50"
      :footer-props="{
        'items-per-page-options': [10, 20, 50, 100, -1],
      }"
    >
      <template slot="item.first_name" slot-scope="props">
        {{ props.item.first_name + " " + props.item.last_name }}
      </template>
      <template slot="item.createdAt" slot-scope="props">
        {{ formatDate(props.item.createdAt) }}
      </template>
      <template slot="item._id" slot-scope="props">
        <div class="action-links">
          <router-link :to="{ name: 'counsellor-add', params: { id: props.item._id } }">Edit</router-link>
          <a @click="deleteCounsellor(props.item)">Delete</a>
          <router-link :to="{ name: 'counsellor-allocate', params: { id: props.item._id } }">Allocate</router-link>
        </div>
      </template>
    </v-data-table>
  </div>
</template>

<script>
import { adminApi } from "../../../utils/api";
import moment from "moment";
// import User from '../../../server/models/User';
export default {
  name: "Counsellors-List",
  components: {},
  data: () => ({
    headers: [
      { text: "Name", value: "first_name" },
      { text: "Last Name", value: "last_name", align: " d-none" },
      { text: "Gender", value: "gender" },
      { text: "DOB", value: "dob" },
      { text: "Email", value: "email" },
      { text: "Phone No.", value: "phone_number" },
      { text: "Created At", value: "createdAt" },
      { text: "", value: "_id", width: "40px" },
    ],
    search: "",
    counsellors: [],
  }),
  computed: {},
  created() {
    this.getCounsellors();
  },
  methods: {
    async getCounsellors() {
      try {
        const res = await adminApi.get("/api/counsellor", {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access-token"),
          },
        });
        if (res.data.success) {
          this.counsellors = res.data.data;
          this.$store.dispatch("setCounsellors", res.data.data);
        }
      } catch (err) {
        console.log("err", err);
      }
    },
    formatDate(date) {
      return moment(date).format("MM/DD/YYYY");
    },
    async deleteCounsellor(counsellor) {
      if (confirm("Are you sure you want to delete this item?")) {
        try {
          const res = await adminApi.delete(`/api/counsellor/${counsellor._id}`, {
            headers: {
              Authorization: "Bearer " + localStorage.getItem("access-token"),
            },
          });
          if (res.data.success) {
            const index = this.counsellors.indexOf(counsellor);
            this.counsellors.splice(index, 1);
          }
        } catch (err) {
          console.log("err", err);
        }
      }
    },
  },
  allocateCounsellor() {},
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
</style>