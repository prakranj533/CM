<template>
  <div class="home">
    <Snackbar :snackbar="snackbar" />
    <v-sheet class="pa-4 mx-auto d-flex flex-column justify-center">
      <v-form ref="setVideoForm" lazy-validation>
        <v-card-title>Set Video Links</v-card-title>
        <v-text-field v-model="gmeetLink" :rules="rules.gmeetLink" label="Google Meet Link" dense outlined />
        <v-text-field v-model="whatsappLink" :rules="rules.whatsappLink" label="WhatsApp Link" dense outlined />
        <v-btn class="float-right" color="primary" @click="updateLinks" depressed>Set</v-btn>
      </v-form>
    </v-sheet>
    <v-text-field v-model="search" append-icon="mdi-magnify" label="Search" single-line hide-details></v-text-field>
    <v-data-table
      v-model="selected"
      :headers="headers"
      :items="students"
      :single-select="singleSelect"
      :search="search"
      item-key="_id"
      show-select
      class="elevation-1"
      :item-class="itemRowBackground"
    >
      <template slot="item._id" slot-scope="props" v-if="props.item.gmeet || props.item.whatsapp">
        <div class="action-links">
          <a @click="removeLinks(props.item)">Delete</a>
        </div>
      </template>
    </v-data-table>
  </div>
</template>

<script>
import Snackbar from "../../../components/Snackbar.vue";
import snackbarMixin from "../../../mixins/snackbar";
import moment from "moment";
import { adminApi } from "../../../utils/api";
// import User from '../../../server/models/User';
export default {
  name: "Students-List",
  components: {
    Snackbar,
  },
  mixins: [snackbarMixin],
  data: () => ({
    gmeetLink: "",
    whatsappLink: "",
    singleSelect: false,
    isDataSet: false,
    selected: [],
    headers: [
      { text: "First Name", value: "first_name" },
      { text: "Last Name", value: "last_name" },
      { text: "Email", value: "email" },
      { text: "Phone No.", value: "phone_number" },
      { text: "GMeet", value: "gmeet" },
      { text: "WhatsApp", value: "whatsapp" },
      { text: "", value: "_id", width: "40px" },
    ],
    search: "",
    students: [],
    rules: {
      gmeetLink: [(v) => !!v || "Google Meet Link is required"],
      whatsappLink: [(v) => !!v || "WhatsApp Link is required"],
    },
    snackbar: {
      show: false,
      status: "",
      message: "",
    },
  }),
  computed: {},
  created() {
    this.getStudents();
  },
  methods: {
    itemRowBackground: function (item) {
      return this.selected.filter((x) => x._id == item._id).length && this.isDataSet ? "allocated2" : "";
    },
    async getStudents() {
      try {
        const res = await adminApi.get("/api/student", {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access-token"),
          },
        });
        if (res.data.success) {
          this.students = res.data.data;
          this.$store.dispatch("setStudents", res.data.data);
        }
      } catch (err) {
        console.log("err", err);
      }
    },
    formatDate(date) {
      return moment(date).format("MM/DD/YYYY");
    },
    async updateLinks() {
      if (!this.$refs.setVideoForm.validate()) return;
      if (this.selected.length == 0) {
        this.callError("Please select at least on student from table.");
        return;
      }
      this.isDataSet = true;
      const res = await adminApi.post(
        `/api/student/update-links`,
        {
          students: this.selected.map((x) => x._id),
          links: { gmeet: this.gmeetLink, whatsapp: this.whatsappLink },
        },
        {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access-token"),
          },
        }
      );
      if (res.data.success) {
        this.callSuccess(res.data.message);
        this.gmeetLink = "";
        this.whatsappLink = "";
        setTimeout(() => {
          this.selected = [];
          this.isDataSet = false;
        }, 10000);
        this.getStudents();
      } else {
        this.isDataSet = false;
        this.callError(res.data.message);
      }
    },
    async removeLinks(student) {
      if (confirm("Are you sure you want to remove links?")) {
        const res = await adminApi.delete(`/api/student/${student._id}/remove-links`, {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access-token"),
          },
        });
        if (res.data.success) {
          student.gmeet = "";
          student.whatsapp = "";
          this.$store.dispatch("updateStudent", student);
          this.callSuccess(res.data.message);
        } else {
          this.callError(res.data.message);
        }
      }
    },
  },
};
</script>

<style>
.container {
  max-width: 100%;
}
.allocated2 {
  background-color: green !important;
  color: white !important;
}
</style>