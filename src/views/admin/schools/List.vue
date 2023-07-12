<template>
  <div class="home">
    <Snackbar :snackbar="snackbar" />
    <div class="text-h5 text-center">Manage School</div>
    <UploadCSVDialog
      :config="createCsvDialogConfig"
      @upload="importData"
      @downloadTemplate="downloadTemplate"
    ></UploadCSVDialog>
    <v-row>
      <v-col class="text-right">
        <v-btn color="primary" @click="openCsvDialog" depressed style="margin-right: 5px">Import Schools</v-btn>
        <v-btn color="primary" to="/admin/school/add" depressed>+ New School</v-btn>
      </v-col>
    </v-row>
    <v-text-field v-model="search" append-icon="mdi-magnify" label="Search" single-line hide-details></v-text-field>
    <v-data-table
      :headers="headers"
      :items="schools"
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
      <!-- <template slot="item.createdAt" slot-scope="props">
        {{ formatDate(props.item.createdAt) }}
      </template> -->
      <template slot="item.deposite_date" slot-scope="props">
        {{ formatDate(props.item.deposite_date) }}
      </template>
      <template slot="item.is_subscribed" slot-scope="props">
        {{ props.item.is_subscribed && props.item.sub_end ? "Yes" : "No" }}
      </template>
    
      <template slot="item.occupation" slot-scope="props">
        {{ props.item.occupation }}{{ props.item.occupation == "Other" ? "/" + props.item.otherOccupation : "" }}
      </template>
      <template slot="item.maplink" slot-scope="props">
        <span style="word-break: break-all;">{{ props.item.maplink }}</span>
      </template>
      <template slot="item._id" slot-scope="props">
        <div class="action-links">
          <router-link :to="{ name: 'school-devices', params: { id: props.item._id } }">Devices</router-link>
          <router-link :to="{ name: 'school-policies', params: { id: props.item._id } }">Policies</router-link>
          <router-link :to="{ name: 'school-coupons', params: { id: props.item._id } }">Coupons</router-link>
          <router-link :to="{ name: 'school-add', params: { id: props.item._id } }">Edit</router-link>
          <a @click="importStudents(props.item)">Import Students</a>
          <a @click="deleteSchool(props.item)">Delete</a>
          <!-- <a @click="getResume(props.item)">Resume</a> -->
        </div>
      </template>
    </v-data-table>
  </div>
</template>

<script>
import UploadCSVDialog from "../../../components/UploadCsvDialog";
import Snackbar from "../../../components/Snackbar.vue";
import snackbarMixin from "../../../mixins/snackbar";
import { adminApi } from "../../../utils/api";
import moment from "moment";
// import User from '../../../server/models/User';
export default {
  name: "Schools-List",
  components: {
    Snackbar,
    UploadCSVDialog,
  },
  mixins: [snackbarMixin],
  data: () => ({
    createCsvDialogConfig: {
      id: "",
      value: "",
      model: false,
      title: "Import Schools Data",
    },
    headers: [
      { text: "Name", value: "name", width: '200px' },
      { text: "Address", value: "address" },
      { text: "Security Deposite", value: "deposite" },
      { text: "Deposite Date", value: "deposite_date" },
      { text: "Agent Name", value: "agent_name" },
      { text: "Google map link", value: "maplink", width: '300px' },
      { text: "Email", value: "email" },
      { text: "Phone No.", value: "phone_number" },
      { text: "Students", value: "no_of_students" },
      // { text: "Payment", value: "sub_id" },
      // { text: "Expiration", value: "sub_end" },
      { text: "Created At", value: "createdDateStr" },
      { text: "", value: "_id", width: "40px" },
    ],
    search: "",
    schools: [],
    snackbar: {
      show: false,
      status: "",
      message: "",
    },
  }),
  computed: {},
  created() {
    this.getSchools();
  },
  methods: {
    async getSchools() {
      try {
        const res = await adminApi.get("/api/school", {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access-token"),
          },
        });
        if (res.data.success) {
          this.schools = res.data.data;
          this.$store.dispatch("setSchools", res.data.data);
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
    deleteSchool(school) {
      if (confirm("Are you sure you want to delete this item?")) {
        adminApi
          .delete(`/api/school/${school._id}`, {
            headers: {
              Authorization: "Bearer " + localStorage.getItem("access-token"),
            },
          })
          .then((res) => {
            if (res.data.success) {
              const index = this.schools.indexOf(school);
              this.schools.splice(index, 1);
            } else {
              this.callError(res.data.message);
            }
          })
          .catch((err) => {
            console.log("err", err);
          });
      }
    },
    importStudents(school) {
      this.createCsvDialogConfig.id = "students";
      this.createCsvDialogConfig.value = school;
      this.createCsvDialogConfig.title = "Import Students Data";
      this.createCsvDialogConfig.model = true;
    },
    openCsvDialog() {
      this.createCsvDialogConfig.id = "schools";
      this.createCsvDialogConfig.title = "Import Schools Data";
      this.createCsvDialogConfig.model = true;
    },
    async downloadTemplate(templateType) {
      const res = await adminApi.get(`/api/download/${templateType}-sample`, {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("access-token"),
        },
        responseType: "blob",
      });
      if (res && res.data && res.data instanceof Blob) {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `${templateType}_sample.csv`); //or any other extension
        document.body.appendChild(link);
        link.click();
      } else if (!res.data.status) {
        this.callError(res.data.message);
      }
    },
    async importData(file, success, fail) {
      const formData = new FormData();
      formData.append("file", file);
      let url = "/api/school/upload";
      if (this.createCsvDialogConfig.id === "students") {
        url = `${url}/${this.createCsvDialogConfig.value._id}`;
      }
      const response = await adminApi.post(url, formData, {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("access-token"),
        },
      });
      if (response.data.success) {
        success && success(response);
      } else {
        fail && fail();
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