<template>
  <div id="add-view">
    <Snackbar :snackbar="snackbar" />
    <v-sheet width="650" height="90vh" class="pa-4 mx-auto d-flex flex-column justify-center">
      <div class="text-h5 mb-3">{{ this.id ? "Edit" : "Add" }} Policy</div>
      <v-form ref="signUpForm" lazy-validation>
        <v-row>
          <v-col cols="12" sm="12" md="12" class="pb-0">
            <v-text-field v-model="name" :rules="policyNameRules" required label="Policy Name" outlined dense />
          </v-col>
          <v-col cols="12" sm="12" md="12" class="pb-0">
            <v-text-field v-model="amount" required label="Amount" outlined dense />
          </v-col>
          <v-col cols="12" sm="12" md="12" class="pb-0">
            <v-text-field v-model="description" label="Description" outlined dense />
          </v-col>
        </v-row>
        <v-btn class="float-right" color="primary" @click="handleSavingPolicy" depressed>Save</v-btn>
        <v-btn class="float-right mr-1" color="secondary" to="/admin/policy/list" depressed>Cancel</v-btn>
      </v-form>
    </v-sheet>
  </div>
</template>

<script>
import Snackbar from "../../../components/Snackbar.vue";
import snackbarMixin from "../../../mixins/snackbar";
import { adminApi } from "../../../utils/api";
import { getDateStr } from '../../../utils/helper';
export default {
  name: "Policy-Add",
  components: {
    Snackbar,
  },
  mixins: [snackbarMixin],
  props: ["id"],
  data: () => ({
    name: '',
    amount: 0,
    description: '',
    policyNameRules: [(v) => !!v || "Policy Name is required"],
    snackbar: {
      show: false,
      status: "",
      message: "",
    },
  }),
  watch: {
  },
  computed: {
  },
  created() {
  },
  async mounted() {
    if (this.id) {
      const response = await adminApi.get(`/api/policy/${this.id}`, {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("access-token"),
        },
      });
      if (response.data.success) {
        var d = response.data.data[0];
        Object.keys(d).forEach((p) => {
          this.$set(this, p, d[p]);
        });
        
      }
    }
  },
  methods: {
    async handleSavingPolicy() {
      if (!this.$refs.signUpForm.validate()) return;

      try {
        const methodName = this.id ? "put" : "post";
        const url = this.id ? `/api/policy/${this.id}` : "/api/policy";
        const dataToSave = {
          name: this.name,
          amount: this.amount,
          description: this.description,
          createdDateStr: getDateStr()
        };

        const response = await adminApi[methodName](url, dataToSave);
        if (response.data.success) {
          this.callSuccess(response.data.message);
          setTimeout(() => {
            const actionName = this.id ? "updatePolicy" : "addPolicy";
            this.$store.dispatch(actionName, response.data.data[0]);
            this.$router.push("/admin/policy/list");
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
