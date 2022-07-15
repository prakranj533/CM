<template>
  <div id="add-view">
    <Snackbar :snackbar="snackbar" />
    <v-sheet width="650" height="90vh" class="pa-4 mx-auto d-flex flex-column justify-center">
      <div class="text-h5 mb-3">Reply To {{ titleize(type) }}</div>
      <v-form ref="replyForm" lazy-validation>
        <v-row class="question-title">
          <v-col cols="12" sm="12" md="12" class="pb-0">Question : {{ question }}</v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="6" md="6" class="pb-0">
            <v-text-field v-model="firstName" label="First Name" outlined dense readonly />
          </v-col>
          <v-col cols="12" sm="6" md="6" class="pb-0">
            <v-text-field v-model="lastName" label="Last Name" outlined dense readonly />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="6" md="6" class="pb-0">
            <v-text-field v-model="phoneNumber" label="Phone Number" outlined dense readonly />
          </v-col>
          <v-col cols="12" sm="6" md="6" class="pb-0">
            <v-text-field v-model="type" label="Type" outlined dense readonly />
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" sm="12" md="12" class="pb-0">
            <v-textarea v-model="reply" :rules="rules.replyTextRules" required label="Reply" outlined dense />
          </v-col>
        </v-row>
        <v-row>
          <v-col>
            <v-autocomplete
              outlined
              dense
              label="Status"
              :items="statusList"
              item-text="name"
              item-value="value"
              v-model="status"
            />
          </v-col>
          <v-col>
            <v-file-input placeholder="Upload" truncate-length="70" outlined dense @change="selectFile"></v-file-input>
          </v-col>
        </v-row>
        <v-btn class="float-right" color="primary" @click="submitReply" depressed>Save</v-btn>
        <v-btn class="float-right mr-1" color="secondary" to="/admin/query/list" depressed>Cancel</v-btn>
      </v-form>
    </v-sheet>
  </div>
</template>

<script>
import Snackbar from "../../../components/Snackbar.vue";
import snackbarMixin from "../../../mixins/snackbar";
import { adminApi } from "../../../utils/api";

export default {
  name: "Student-Add",
  components: {
    Snackbar,
  },
  mixins: [snackbarMixin],
  props: ["id"],
  data: () => ({
    userId: "",
    firstName: "",
    lastName: "",
    phoneNumber: "",
    type: "",
    question: "",
    reply: "",
    reply_path: "",
    status: "",
    snackbar: {
      show: false,
      status: "",
      message: "",
    },
    statusList: [
      { name: "Open", value: "open" },
      { name: "Booked", value: "booked" },
      { name: "Cancelled", value: "cancelled" },
      { name: "Closed", value: "closed" },
    ],
    rules: {
      replyTextRules: [(v) => !!v || "Reply is required"],
    }
  }),
  watch: {},
  computed: {},
  async mounted() {
    if (this.id) {
      const response = await adminApi.get(`/api/query/${this.id}`, {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("access-token"),
        },
      });
      if (response.data.success) {
        var d = response.data.data[0];
        var props = {
          userId: "user_id",
          firstName: "first_name",
          lastName: "last_name",
          phoneNumber: "phone_number",
          type: "type",
          question: "question",
          status: "status",
          reply: "reply",
          reply_path: "reply_path",
          id: "_id",
        };
        Object.keys(props).forEach((p) => {
          this.$set(this, p, d[props[p]]);
        });
        if (d.type == "query") {
          this.$set(this, "statusList", [
            { name: "Open", value: "open" },
            { name: "Cancelled", value: "cancelled" },
            { name: "Closed", value: "closed" },
          ]);
        } else {
          this.$set(this, "statusList", [
            { name: "Open", value: "open" },
            { name: "Booked", value: "booked" },
            { name: "Cancelled", value: "cancelled" },
            { name: "Closed", value: "closed" },
          ]);
        }
      }
    }
  },
  methods: {
    selectFile(file) {
      this.currentFile = file;
    },
    async submitReply() {
      if (!this.$refs.replyForm.validate()) return;
      try {
        let formData;
        if (this.currentFile) {
          formData = new FormData();
          formData.append("file", this.currentFile);
          formData.append("reply", this.reply || '');
          formData.append("id", this.id);
          formData.append("status", this.status);
        } else {
          formData = {
            reply: this.reply,
            id: this.id,
            status: this.status,
          };
        }
        const response = await adminApi.post(`/api/query/${this.id}/reply`, formData, {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access-token"),
          },
        });
        if (response.data.success) {
          this.callSuccess(response.data.message);
          setTimeout(() => {
            // const actionName = this.id ? "updateStudent" : "addStudent";
            // this.$store.dispatch(actionName, response.data.data[0]);
            this.$router.push("/admin/query/list");
          }, 1000);
        } else {
          this.callError(response.data.message);
        }
      } catch (e) {
        console.log(e);
        if (e?.response?.data.message === "Invalid data.") {
          this.callError(e?.response?.data.error.map((e) => Object.values(e).join(",")).join("<br/>"), true);
        } else {
          this.callError(e?.response?.data.message || e.message);
        }
      }
    },
    titleize(v) {
      return v.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    },
  },
};
</script>
<style>

.v-input--is-readonly:not(.dob) .v-input__slot {
  background-color: #ddd !important;
}
.question-title {
  font-size: 15px;
  font-weight: bold;
  margin-bottom: 10px;
}
</style>