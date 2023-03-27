<template>
  <div id="add-view">
    <Snackbar :snackbar="snackbar" />
    <v-sheet width="650" height="90vh" class="pa-4 mx-auto d-flex flex-column justify-center">
      <div class="text-h5 mb-3">{{ this.id ? "Edit" : "Add" }} Plan</div>
      <v-form ref="signUpForm" lazy-validation>
        <v-row>
          <v-col cols="12" sm="12" md="12" class="pb-0">
            <v-text-field v-model="name" :rules="planNameRules" required label="Plan Name" outlined dense />
          </v-col>
          <v-col cols="12" sm="12" md="12" class="pb-0">
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
          <v-col cols="12" sm="12" md="12" class="pb-0">
            <v-text-field v-model="amount" required label="Amount" outlined dense />
          </v-col>
          <v-col cols="12" sm="12" md="12" class="pb-0">
            <v-text-field v-model="description" label="Description" outlined dense />
          </v-col>
        </v-row>
        <v-btn class="float-right" color="primary" @click="handleSavingPlan" depressed>Save</v-btn>
        <v-btn class="float-right mr-1" color="secondary" to="/admin/plan/list" depressed>Cancel</v-btn>
      </v-form>
    </v-sheet>
  </div>
</template>

<script>
import Snackbar from "../../../components/Snackbar.vue";
import snackbarMixin from "../../../mixins/snackbar";
import { adminApi } from "../../../utils/api";
export default {
  name: "Plan-Add",
  components: {
    Snackbar,
  },
  mixins: [snackbarMixin],
  props: ["id"],
  data: () => ({
    name: "",
    duration: { text: "7 days", value: 7 },
    amount: 0,
    description: "",
    planNameRules: [(v) => !!v || "Plan Name is required"],
    snackbar: {
      show: false,
      status: "",
      message: "",
    },
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
  }),
  watch: {},
  computed: {},
  created() {},
  async mounted() {
    if (this.id) {
      const response = await adminApi.get(`/api/plan/${this.id}`, {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("access-token"),
        },
      });
      if (response.data.success) {
        var d = response.data.data[0];
        Object.keys(d).forEach((p) => {
          this.$set(this, p, d[p]);
        });
        this.duration = this.durations.find((x) => x.value === d.duration_days);
      }
    }
  },
  methods: {
    async handleSavingPlan() {
      if (!this.$refs.signUpForm.validate()) return;

      try {
        const methodName = this.id ? "put" : "post";
        const url = this.id ? `/api/plan/${this.id}` : "/api/plan";
        const dataToSave = {
          name: this.name,
          amount: this.amount,
          duration_days: this.duration.value,
          duration_text: this.duration.text,
          description: this.description,
        };

        const response = await adminApi[methodName](url, dataToSave, {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access-token"),
          },
        });
        if (response.data.success) {
          this.callSuccess(response.data.message);
          setTimeout(() => {
            const actionName = this.id ? "updatePlan" : "addPlan";
            this.$store.dispatch(actionName, response.data.data[0]);
            this.$router.push("/admin/plan/list");
          }, 1000);
        } else {
          this.callError(response.data.message);
        }
      } catch (e) {
        console.log(e);
        if (e?.response?.data.message === "Invalid data.") {
          this.callError(e?.response?.data.error.map((e) => Object.values(e).join(",")).join("<br/>"), true);
        } else if (e?.response?.data.message) {
          this.callError(e?.response?.data.message);
        } else {
          this.callError(e.message);
        }
      }
    },
    titleize(v) {
      return v.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    },
  },
};
</script>
