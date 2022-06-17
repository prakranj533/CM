<template>
  <div id="add-view">
    <Snackbar :snackbar="snackbar" />
    <v-sheet width="650" height="90vh" class="pa-4 mx-auto d-flex flex-column justify-center">
      <div class="text-h5 mb-3">{{ this.id ? "Edit" : "Add" }} Counsellor</div>
      <v-form ref="signUpForm" lazy-validation>
        <v-row>
          <v-col cols="12" sm="6" md="6" class="pb-0">
            <v-text-field v-model="firstName" required label="First Name" outlined dense />
          </v-col>
          <v-col cols="12" sm="6" md="6" class="pb-0">
            <v-text-field v-model="lastName" required label="Last Name" outlined dense />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" class="py-0">
            <v-text-field v-model="email" :rules="emailRules" label="Email" outlined dense id="email-counsellor" />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="6" md="6" class="py-0">
            <v-text-field
              v-model="password"
              :append-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
              :rules="passwordRules.concat(matchPasswordRule)"
              :type="showPassword ? 'text' : 'password'"
              label="Password"
              @click:append="showPassword = !showPassword"
              outlined
              dense
            />
          </v-col>
          <v-col cols="12" sm="6" md="6" class="py-0">
            <v-text-field
              v-model="confirmPassword"
              :append-icon="showConfirmPassword ? 'mdi-eye' : 'mdi-eye-off'"
              :rules="passwordRules.concat(matchPasswordRule)"
              :type="showConfirmPassword ? 'text' : 'password'"
              label="Confirm Password"
              @click:append="showConfirmPassword = !showConfirmPassword"
              outlined
              dense
            />
          </v-col>
        </v-row>
        <v-radio-group v-model="gender" row>
          <template v-slot:label>
            <div class="text-subtitle-1">Gender</div>
          </template>
          <v-radio v-for="n in ['male', 'female', 'others']" :key="n" :label="titleize(n)" :value="n" />
        </v-radio-group>
        <v-row>
          <v-col cols="12" sm="6" md="6" class="pb-0">
            <v-menu
              ref="dob"
              v-model="dobMenu"
              :close-on-content-click="false"
              transition="scale-transition"
              offset-y
              min-width="auto"
            >
              <template v-slot:activator="{ on, attrs }">
                <v-text-field
                  v-model="dateOfBirth"
                  label="Date of Birth"
                  readonly
                  v-bind="attrs"
                  v-on="on"
                  outlined
                  dense
                ></v-text-field>
              </template>
              <v-date-picker
                v-model="dateOfBirth"
                :active-picker.sync="activePicker"
                :max="new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().substr(0, 10)"
                min="1900-01-01"
                @change="saveDoB"
              ></v-date-picker>
            </v-menu>
          </v-col>
          <v-col cols="12" sm="6" md="6" class="pb-0">
            <v-text-field v-model="phoneNumber" required label="Phone Number" outlined dense />
          </v-col>
        </v-row>
        <v-btn class="float-right" color="primary" @click="handleSignUp" depressed>Save</v-btn>
        <v-btn class="float-right mr-1" color="secondary" to="/admin/counsellor/list" depressed>Cancel</v-btn>
      </v-form>
    </v-sheet>
  </div>
</template>

<script>
import Snackbar from "../../../components/Snackbar.vue";
import snackbarMixin from "../../../mixins/snackbar";
import { adminApiAuth, adminApi } from "../../../utils/api";

export default {
  name: "Counsellor-Add",
  components: {
    Snackbar,
  },
  mixins: [snackbarMixin],
  props: ["id"],
  data: () => ({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    gender: "",
    dateOfBirth: null,
    phoneNumber: "",
    currentStandard: "",
    occupation: "",
    dobMenu: false,
    activePicker: null,
    showPassword: false,
    showConfirmPassword: false,
    emailRules: [
      (v) => !!v || "Email is required",
      (v) => /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v) || "Email must be valid",
    ],
    passwordRules: [
      (v) => !!v || "Password is required",
      (v) => (v && v.length >= 8) || "Password must be at least 8 characters long",
    ],
    snackbar: {
      show: false,
      status: "",
      message: "",
    },
  }),
  watch: {
    dobMenu(val) {
      val && setTimeout(() => (this.activePicker = "YEAR"));
    },
  },
  computed: {
    matchPasswordRule() {
      return this.password === this.confirmPassword || "Password must match";
    },
  },
  async mounted() {
    if (this.id) {
      const response = await adminApi.get(`/api/counsellor/${this.id}`, {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("access-token"),
        },
      });
      if (response.data.success) {
        var d = response.data.data[0];
        var props = {
          firstName: "first_name",
          lastName: "last_name",
          email: "email",
          gender: "gender",
          dateOfBirth: "dob",
          phoneNumber: "phone_number",
          currentStandard: "current_standard",
          occupation: "occupation",
          id: "_id",
        };
        Object.keys(props).forEach((p) => {
          this.$set(this, p, d[props[p]]);
        });
        this.$set(this, "passwordRules", [
          (v) => {
            return !v || v.length > 8 || "Password must be at least 8 characters long";
          },
        ]);
      }
    }
  },
  methods: {
    async handleSignUp() {
      if (!this.$refs.signUpForm.validate()) return;

      try {
        const methodName = this.id ? "put" : "post";
        const url = this.id ? `/update-counsellor/${this.id}` : "/register-counsellor";
        const response = await adminApiAuth[methodName](url, {
          first_name: this.firstName,
          last_name: this.lastName,
          email: this.email,
          password: this.password,
          dob: this.dateOfBirth,
          gender: this.gender,
          phone_number: this.phoneNumber,
          occupation: this.occupation,
          current_standard: this.currentStandard,
        });
        if (response.data.success) {
          this.callSuccess(response.data.message);
          setTimeout(() => {
            const actionName = this.id ? "updateCounsellor" : "addCounsellor";
            this.$store.dispatch(actionName, response.data.data[0]);
            this.$router.push("/admin/counsellor/list");
          }, 1000);
        } else {
          this.callError(response.data.message);
        }
      } catch (e) {
        console.log(e);
        if (e?.response?.data.message) {
          this.callError(e?.response?.data.error.map((e) => Object.values(e).join(",")).join("<br/>"), true);
        } else {
          this.callError(e.message);
        }
      }
    },
    titleize(v) {
      return v.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    },
    saveDoB(date) {
      this.$refs.dob.save(date);
    },
  },
};
</script>
