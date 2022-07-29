<template>
  <div class="home">
    <Snackbar :snackbar="snackbar" />
    <div class="text-h5 text-center">List Queries</div>
    <v-text-field v-model="search" append-icon="mdi-magnify" label="Search" single-line hide-details></v-text-field>
    <v-data-table
      :headers="headers"
      :items="queries"
      :search="search"
      item-key="_id"
      class="elevation-1"
      :item-class="itemRowBackground"
      :items-per-page="50"
      :footer-props="{
        'items-per-page-options': [10, 20, 50, 100, -1],
      }"
    >
      <template slot="item.createdAt" slot-scope="props">
        {{ formatDate(props.item.createdAt) }}
      </template>
      <template slot="item.first_name" slot-scope="props">
        {{ `${props.item.first_name || ""} ${props.item.last_name || ""}` }}
      </template>
      <template slot="item.status" slot-scope="props">
        {{ (props.item.status || "Open").toUpperCase() }}
      </template>
      <template slot="item.question" slot-scope="props">
        <div>
          <v-icon v-if="props.item.filePath" @click="getQueryFile(props.item)">mdi-paperclip</v-icon>
          {{ props.item.question }}
        </div>
      </template>
      <template slot="item.reply" slot-scope="props">
        <div>
          <v-icon v-if="props.item.reply_path" @click="getReplyFile(props.item)">mdi-paperclip</v-icon>
          <router-link
            v-if="props.item.reply || props.item.reply_path"
            :to="{ name: 'query-reply', params: { id: props.item._id } }"
          >
            {{ props.item.reply }}
          </router-link>

          <router-link
            v-if="!props.item.reply && !props.item.reply_path"
            :to="{ name: 'query-reply', params: { id: props.item._id } }"
          >
            Reply to Query
          </router-link>
        </div>
      </template>
      <template slot="item.type" slot-scope="props">
        <div>
          {{ titleize(props.item.type) }}
          <div class="counsellor-name" v-if="(props.item.type || '').toLowerCase() === 'counsellor'">
            {{ props.item.counsellor_name }}
          </div>
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
      { text: "Query Date", value: "createdAt" },
      { text: "Name", value: "first_name", align: "ws" },
      { text: "Last Name", value: "last_name", align: " d-none" },
      { text: "Phone No.", value: "phone_number" },
      { text: "Type", value: "type" },
      { text: "Status", value: "status" },
      { text: "Question", value: "question" },
      { text: "Reply", value: "reply" },
      { text: "counsellor_name", value: "counsellor_name", align: " d-none" },
    ],
    search: "",
    queries: [],
    snackbar: {
      show: false,
      status: "",
      message: "",
    },
  }),
  computed: {},
  created() {
    this.getQueries();
  },
  methods: {
    itemRowBackground: function (item) {
      return `query-status-${item.status}`;
    },
    titleize(v) {
      return v.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    },
    async getQueries() {
      try {
        const res = await adminApi.get("/api/query/all", {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access-token"),
          },
        });
        if (res.data.success) {
          this.queries = res.data.data;
          this.$store.dispatch("setQueries", res.data.data);
        }
      } catch (err) {
        console.log("err", err);
      }
    },
    formatDate(date) {
      return moment(date).format("MM/DD/YYYY");
    },
    async getQueryFile(query) {
      try {
        const res = await adminApi.get(`/api/query/${query._id}/download`, {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access-token"),
          },
          responseType: "blob",
        });
        if (res && res.data && res.data instanceof Blob) {
          console.log(res.data);
          let ext = res.headers["ext"];
          const url = window.URL.createObjectURL(new Blob([res.data]));
          const link = document.createElement("a");
          link.href = url;
          link.setAttribute("download", `query_${new Date().getTime()}.${ext}`); //or any other extension
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
    async getReplyFile(query) {
      try {
        const res = await adminApi.get(`/api/query/${query._id}/download/reply`, {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access-token"),
          },
          responseType: "blob",
        });
        if (res && res.data && res.data instanceof Blob) {
          console.log(res.data);
          let ext = res.headers["ext"];
          const url = window.URL.createObjectURL(new Blob([res.data]));
          const link = document.createElement("a");
          link.href = url;
          link.setAttribute("download", `reply_${new Date().getTime()}.${ext || "pdf"}`); //or any other extension
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
  },
};
</script>

<style>
.container {
  max-width: 100%;
}
.counsellor-name {
  font-size: 12px;
  color: #000;
  font-weight: bold;
  text-transform: uppercase;
}
.query-status-open {
   background-color: rgb(239, 255, 229);
}
.query-status-closed {
  background-color: rgb(255, 238, 212);
}
.query-status-cancelled {
  background-color: rgb(255, 255, 212);
}
.text-ws {
  white-space: nowrap;
}
</style>