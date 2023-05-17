<template>
  <div class="home">
    <Snackbar :snackbar="snackbar" />
    <div class="text-h5 text-center">Manage Student</div>
    <v-row>
      <v-col class="text-right">
        <v-btn color="primary" to="/admin/student/add" depressed>+ New Student</v-btn>
      </v-col>
    </v-row>
    <v-text-field v-model="search" append-icon="mdi-magnify" label="Search" single-line hide-details></v-text-field>
    <v-data-table
      :headers="headers"
      :items="students"
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
      <template slot="item.dob" slot-scope="props">
        {{ formatDate(props.item.dob) }}
      </template>
      <template slot="item.is_subscribed" slot-scope="props">
        {{ props.item.is_subscribed && props.item.sub_end ? "Yes" : "No" }}
      </template>
      <template slot="item.sub_id" slot-scope="props">
        {{ !!props.item.sub_id && props.item.sub_end ? "Yes" : "No" }}
      </template>
      <template slot="item.sub_end" slot-scope="props">
        {{ (props.item.sub_end ? formatDate(props.item.sub_end) : "NA") || "NA" }}
      </template>
      <template slot="item.occupation" slot-scope="props">
        {{ props.item.occupation }}{{ props.item.occupation == "Other" ? "/" + props.item.otherOccupation : "" }}
      </template>
      <template slot="item._id" slot-scope="props">
        <div class="action-links">
          <router-link :to="{ name: 'student-add', params: { id: props.item._id } }">Edit</router-link>
          <a @click="deleteStudent(props.item)">Delete</a>
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
  name: "Students-List",
  components: {
    Snackbar,
  },
  mixins: [snackbarMixin],
  data: () => ({
    headers: [
      { text: "Name", value: "first_name" },
      { text: "Last Name", value: "last_name", align: " d-none" },
      { text: "School Name", value: "school_name" },
      { text: "Gender", value: "gender" },
      { text: "Occupation", value: "occupation" },
      { text: "Occupation", value: "otherOccupation", align: " d-none" },
      { text: "DOB", value: "dob", align: "ws" },
      { text: "Email", value: "email" },
      { text: "Phone No.", value: "phone_number" },
      { text: "Subscribed", value: "is_subscribed" },
      { text: "Payment", value: "sub_id" },
      { text: "Expiration", value: "sub_end" },
      { text: "Created At", value: "createdAt" },
      { text: "", value: "_id", width: "40px" },
    ],
    search: "",
    students: [],
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
    async getResume(user) {
      try {
        const res = await adminApi.get(`/api/upload/resume/${user._id}`, {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access-token"),
          },
          responseType: "blob",
        });
        if (res && res.data && res.data instanceof Blob) {
          console.log(res.data);
          const url = window.URL.createObjectURL(new Blob([res.data]));
          const link = document.createElement("a");
          link.href = url;
          link.setAttribute("download", `${user.first_name}_${user.last_name}_resume.pdf`); //or any other extension
          document.body.appendChild(link);
          link.click();
          // this.students = res.data.data;
          // this.$store.dispatch("setStudents", res.data.data);
        } else if (!res.data.status) {
          this.callError(res.data.message);
        }
      } catch (err) {
        if (err.message.indexOf("404") != -1) {
          this.callError("Resume Not Found");
        }
      }
    },
    formatDate(date) {
      return moment(date).format("DD/MM/YYYY");
    },
    deleteStudent(student) {
      if (confirm("Are you sure you want to delete this item?")) {
        adminApi
          .delete(`/api/student/${student._id}`, {
            headers: {
              Authorization: "Bearer " + localStorage.getItem("access-token"),
            },
          })
          .then((res) => {
            if (res.data.success) {
              const index = this.students.indexOf(student);
              this.students.splice(index, 1);
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