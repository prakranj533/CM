<template>
  <div class="home">
    <Snackbar :snackbar="snackbar" />
    <div class="text-h5 text-center">Coupons for School: {{ this.school.name }}</div>
    <v-form ref="signUpForm" lazy-validation>
      <v-row class="pt-8">
        <v-col cols="12" sm="4" md="4" class="pb-0">
          <v-text-field
            v-model="count"
            :rules="countRules"
            type="number"
            max="10"
            maxlength="3"
            required
            label="No of Coupons to Generate"
            outlined
            dense
          />
        </v-col>
        <v-col cols="12" sm="4" md="4" class="pb-0">
          <v-select
            v-model="duration"
            :items="durations"
            item-title="state"
            item-value="abbr"
            label="Duration"
            persistent-hint
            return-object
            single-line
            outlined
            dense
          ></v-select>
        </v-col>
        <v-col cols="12" sm="4" md="4" class="pb-0">
          <v-btn color="primary" class="mr-1" @click="generateCoupons" depressed>Generate Coupons</v-btn>
          <v-btn color="primary" class="mr-1" @click="exportCoupons" depressed>Export Coupons</v-btn>
        </v-col>
      </v-row>
    </v-form>
    <v-text-field v-model="search" append-icon="mdi-magnify" label="Search" single-line hide-details></v-text-field>
    <v-data-table
      :headers="headers"
      :items="coupons"
      :search="search"
      item-key="_id"
      class="elevation-1"
      :items-per-page="50"
      :footer-props="{
        'items-per-page-options': [10, 20, 50, 100, -1],
      }"
    >
      <template slot="item.first_name" slot-scope="props">
        {{ props.item.name }}
      </template>
      <template slot="item.createdAt" slot-scope="props">
        {{ formatDate(props.item.createdAt) }}
      </template>
      <template slot="item.is_used" slot-scope="props">
        {{ props.item.is_used ? "Yes" : "No" }}
      </template>
      <template slot="item._id" slot-scope="props">
        <div class="action-links">
          <a @click="deleteCoupon(props.item)">Delete</a>
          <!-- <a @click="getResume(props.item)">Resume</a> -->
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
  name: "Schools-List",
  components: {
    Snackbar,
  },
  mixins: [snackbarMixin],
  props: ["id"],
  data: () => ({
    headers: [
      { text: "S No.", value: "serialNo" },
      { text: "Code", value: "code" },
      { text: "Duration", value: "duration_text" },
      { text: "Is Used", value: "is_used" },
      { text: "Used On", value: "used_on" },
      { text: "Created At", value: "createdAt" },
      { text: "", value: "_id", width: "40px" },
    ],
    countRules: [
      (v) => !!v || "No of Coupons to Generate is required",
      (v) => v <= 100 || "No of Coupons to Generate must be equal to or less then 100",
    ],
    durations: [
      { text: "7 days", value: 7 },
      { text: "15 days", value: 15 },
      { text: "1 month", value: 30 },
      { text: "2 months", value: 60 },
      { text: "3 months", value: 90 },
      { text: "6 months", value: 180 },
      { text: "9 months", value: 270 },
      { text: "1 year", value: 365 },
    ],
    search: "",
    count: 0,
    duration: { text: "7 days", value: 7 },
    coupons: [],
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
  },
  methods: {
    async getCoupons() {
      try {
        const response = await adminApi.get(`/api/coupon/school/${this.id}`, {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access-token"),
          },
        });
        console.log(response.data.data);
        if (response.data.success) {
          this.coupons = response.data.data.coupon;
          this.school = response.data.data.school;
          this.coupons.forEach((v, i) => {
            v.serialNo = i + 1;
          });
        }
      } catch (err) {
        console.log("err", err);
      }
    },
    deleteCoupon(coupon) {
      if (confirm("Are you sure you want to delete this item?")) {
        adminApi
          .delete(`/api/coupon/${coupon._id}`, {
            headers: {
              Authorization: "Bearer " + localStorage.getItem("access-token"),
            },
          })
          .then((res) => {
            if (res.data.success) {
              const index = this.coupons.indexOf(coupon);
              this.coupons.splice(index, 1);
            }
          })
          .catch((err) => {
            console.log("err", err);
          });
      }
    },
    generateCoupons() {
      if (!this.$refs.signUpForm.validate()) return;
      adminApi
        .post(
          `/api/coupon/school/${this.id}`,
          {
            count: this.count,
            duration_days: this.duration.value,
            duration_text: this.duration.text,
          },
          {
            headers: {
              Authorization: "Bearer " + localStorage.getItem("access-token"),
            },
          }
        )
        .then((res) => {
          if (res.data.success) {
            this.getCoupons();
            this.count = 0;
          }
        })
        .catch((err) => {
          console.log("err", err);
        });
    },
    async exportCoupons() {
      const res = await adminApi.get(`/api/coupon/export/${this.id}`, {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("access-token"),
        },
        responseType: "blob",
      });
      if (res && res.data && res.data instanceof Blob) {
        console.log(res.data);
        //let ext = res.headers["ext"];
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `coupons_${new Date().getTime()}.csv`); //or any other extension
        document.body.appendChild(link);
        link.click();
        // this.students = res.data.data;
        // this.$store.dispatch("setStudents", res.data.data);
      } else if (!res.data.status) {
        this.callError(res.data.message);
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