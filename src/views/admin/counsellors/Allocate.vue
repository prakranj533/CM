<template>
  <div class="home">
    <Snackbar :snackbar="snackbar" />
    <div class="text-h5 text-center">Allocate Counsellor to Students</div>
    <v-card>
      <v-card-title>Counsellor Name: {{ counsellor.first_name + " " + counsellor.last_name }}</v-card-title>
      <v-card-actions>
        <v-flex x class="text-right">
          <v-btn color="secondary" class="mr-1" @click="handleDeallocate" depressed>Deallocate</v-btn>
          <v-btn color="primary" @click="handleAllocate" depressed>Allocate</v-btn>
        </v-flex>
      </v-card-actions>
    </v-card>
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
      <template slot="item.first_name" slot-scope="props">
        {{ props.item.first_name + " " + props.item.last_name }}
      </template>
      <template slot="item.createdAt" slot-scope="props">
        {{ formatDate(props.item.createdAt) }}
      </template>
    </v-data-table>
  </div>
</template>

<script>
import { adminApi } from "../../../utils/api";
import moment from "moment";
import Snackbar from "../../../components/Snackbar.vue";
import snackbarMixin from "../../../mixins/snackbar";
// import User from '../../../server/models/User';
export default {
  name: "Counsellors-List",
  components: {
    Snackbar,
  },
  mixins: [snackbarMixin],
  props: ["id"],
  data: () => ({
    singleSelect: false,
    selected: [],
    allocated: [],
    allocatedStudents: {},
    headers: [
      { text: "Name", value: "first_name" },
      { text: "Last Name", value: "last_name", align: " d-none" },
      { text: "Gender", value: "gender" },
      { text: "Occupation", value: "occupation" },
      { text: "DOB", value: "dob" },
      { text: "Email", value: "email" },
      { text: "Phone No.", value: "phone_number" },
      { text: "Created At", value: "createdAt" },
    ],
    counsellor: {},
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
    if (this.id) {
      this.getCounsellor(this.id);
      this.getStudents();
    } else {
      this.$router.push("/admin/counsellor/list");
    }
  },
  methods: {
    itemRowBackground: function (item) {
      return this.allocatedStudents[item._id] ? "allocated" : "";
    },
    async getStudents() {
      try {
        const res = await adminApi.get("/api/student", {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access-token"),
          },
        });
        if (res.data.success) {
          this.$store.dispatch("setStudents", res.data.data);
          var counsellor_id = this.id;
          this.getAllocations(this.id, () => {
            this.students = res.data.data.filter((x) => !x.counsellor_id || x.counsellor_id == counsellor_id);
          });
        }
      } catch (err) {
        console.log("err", err);
      }
    },
    async getCounsellor(id) {
      try {
        const res = await adminApi.get(`/api/counsellor/${id}`, {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access-token"),
          },
        });
        if (res.data.success) {
          this.counsellor = res.data.data[0];
        }
      } catch (err) {
        console.log("err", err);
      }
    },
    async getAllocations(id, cb) {
      try {
        const res = await adminApi.get(`/api/allocate/counsellor/${id}`, {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access-token"),
          },
        });
        if (res.data.success) {
          this.allocated = res.data.data;
          this.allocatedStudents = {};
          for (let x = 0; x < this.allocated.length; x++) {
            this.allocatedStudents[this.allocated[x].student] = 1;
          }
          this.$set(this, "selected", []);
          // this.selected = res.data.data.map((x) => this.students.find((s) => s._id == x.student));
          (cb || (() => {}))();
        }
      } catch (err) {
        console.log("err", err);
      }
    },
    formatDate(date) {
      return moment(date).format("DD/MM/YYYY");
    },
    async handleAllocate() {
      const data = this.selected.map((s) => ({ counsellor: this.id, student: s._id }));
      try {
        const res = await adminApi.post(
          "/api/allocate",
          { data },
          {
            headers: {
              Authorization: "Bearer " + localStorage.getItem("access-token"),
            },
          }
        );
        if (res.data.success) {
          this.callSuccess(res.data.message);
          this.getAllocations(this.id);
        }
      } catch (err) {
        console.log("err", err);
      }
    },
    async handleDeallocate() {
      const dataToDelete = this.selected.map((s) => ({ counsellor: this.id, student: s._id }));
      try {
        const res = await adminApi.delete("/api/allocate", {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access-token"),
          },
          data: dataToDelete,
        });
        if (res.data.success) {
          this.callSuccess(res.data.message);
          this.getAllocations(this.id);
        }
      } catch (err) {
        console.log("err", err);
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
}
.action-links a {
  margin: 5px 10px;
  display: inline-block;
  text-decoration: underline;
}
.allocated {
  background-color: #1976d2;
  color: white;
}
.v-data-table__selected.allocated, .v-data-table__selected.allocated:hover{
  color: #000 !important;
}

.theme--light.v-data-table > .v-data-table__wrapper > table > tbody > tr:hover:not(.v-data-table__expanded__content):not(.v-data-table__empty-wrapper) {
   color: #000 !important;
 }
</style>