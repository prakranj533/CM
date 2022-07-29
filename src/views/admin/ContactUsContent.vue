<template>
  <div id="admin-changepwd-view">
    <Snackbar :snackbar="snackbar" />
    <v-sheet width="650px" height="80vh" class="pa-4 mx-auto d-flex flex-column justify-center">
      <div class="text-h5 mb-3">Contact Us</div>
      <v-form ref="contentForm" lazy-validation>
        <v-row>
          <v-col cols="12" sm="12" md="12" class="pb-0">
            <v-text-field v-model="content.name" required label="Name" outlined dense />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="12" md="12" class="pb-0">
            <v-text-field v-model="content.address" required label="Address" outlined dense />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="12" md="12" class="pb-0">
            <v-text-field v-model="content.phone_number" required label="Phone" outlined dense />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="12" md="12" class="pb-0">
            <v-text-field v-model="content.email" required label="Email" outlined dense />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="12" md="12" class="pb-0">
            <v-text-field v-model="content.youtube_link" required label="YouTube Link" outlined dense />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="12" md="12" class="pb-0">
            <v-text-field v-model="content.liveurl" required label="Live Url" outlined dense />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="12" md="12" class="pb-0">
            <v-textarea
              v-model="content.description"
              :rules="contentRules"
              label="Content"
              hint=""
              outlined
              dense
            ></v-textarea>
          </v-col>
        </v-row>
        <v-btn class="float-right" color="primary" @click="handleSaveContent" depressed>Save</v-btn>
      </v-form>
    </v-sheet>
  </div>
</template>

<script>
import Snackbar from "../../components/Snackbar.vue";
import snackbarMixin from "../../mixins/snackbar";
import { adminApi } from "../../utils/api";

export default {
  name: "ContactUsContent",
  components: {
    Snackbar,
  },
  mixins: [snackbarMixin],
  data: () => ({
    content: {
      _id: "",
      description: "",
      name: "",
      address: "",
      phone_number: "",
      youtube_link: "",
      email: "",
      liveurl: "",
    },
    contentRules: [(v) => !!v || "Content is required"],
    snackbar: {
      show: false,
      status: "",
      message: "",
    },
  }),
  computed: {},
  created() {
    this.getContent("CONTACT_US");
  },
  methods: {
    async getContent(id_code) {
      try {
        const response = await adminApi.get(`/api/content/${id_code}`, {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access-token"),
          },
        });
        if (response.data.success) {
          const data = response.data.data[0];
          const description = JSON.parse(data.description);
          const contentData = {
            _id: data._id,
            ...description,
          };
          this.$set(this, "content", contentData);
        }
      } catch (e) {
        console.log(e);
        console.error(e.response.data.message);
      }
    },
    async handleSaveContent() {
      if (!this.$refs.contentForm.validate()) return;

      try {
        const data = {
          _id: this.content._id,
          code: "CONTACT_US",
          title: "Contact Us",
          subtitle: "",
          description: JSON.stringify({
            description: this.content.description,
            name: this.content.name,
            email: this.content.email,
            phone_number: this.content.phone_number,
            address: this.content.address,
            youtube_link: this.content.youtube_link,
            liveurl: this.content.liveurl
          }),
        };
        const methodName = this.content._id ? "put" : "post";
        const url = this.content._id ? `/api/content/${this.content._id}` : "/api/content/";
        const response = await adminApi[methodName](url, data, {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access-token"),
          },
        });
        if (response.data.success) {
          const data = response.data.data[0];
          const description = JSON.parse(data.description);
          const contentData = {
            _id: data._id,
            ...description,
          };
          this.$set(this, "content", contentData);

          this.callSuccess(response.data.message);
        } else {
          this.callError(response.data.message);
        }
      } catch (e) {
        console.error(e.response.data.message);
        this.callError(e.response.data.message);
      }
    },
  },
};
</script>
