<template>
  <div class="home">
    <div class="text-h5 text-center">Manage Student</div>
    <v-btn class="float-right" color="primary" to="/admin/student/add" depressed>+ New Student</v-btn>
    <v-simple-table class="mt-6">
      <template v-slot:default>
        <thead>
          <tr>
            <th class="text-left">First Name</th>
            <th class="text-left">Last Name</th>
            <th class="text-left">DOB</th>
            <th class="text-left">Email</th>
            <th class="text-left">Created At</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in students" :key="row.id">
            <td>{{ row.first_name }}</td>
            <td>{{ row.last_name }}</td>
            <td>{{ row.dob }}</td>
            <td>{{ row.email }}</td>
            <td>{{ formatDate(row.createdAt) }}</td>
          </tr>
        </tbody>
      </template>
    </v-simple-table>
  </div>
</template>

<script>
import { authApi } from "../../utils/api";
import moment from "moment";
// import User from '../../../server/models/User';
export default {
  name: "ManageStudents",
  components: {},
  data: () => ({
    students: [],
  }),
  computed: {},
  created() {
    this.getStudents();
  },
  methods: {
    getStudents() {
      authApi
        .get("/users", {
          // TODO: this needs to be improved
          // Since default localstorage of axios was taking old value of token
          // so had to add the auth header in the direct request
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access-token"),
          },
        })
        .then((res) => {
          this.students = res.data.data;
        })
        .catch((err) => {
          console.log("err", err);
        });
    },
    formatDate(date) {
      return moment(date).format("DD/MM/YYYY");
    },
    async handleNewStudent() {
      
    },
  },
};
</script>

<style>
.container {
  max-width: 100%;
}
</style>