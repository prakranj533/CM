<template>
  <div id="add-view">
    <Snackbar :snackbar="snackbar" />
    <v-sheet width="650" height="90vh" class="pa-4 mx-auto d-flex flex-column justify-center">
      <div class="text-h5 mb-3">{{ this.id ? "Edit" : "Add" }} School</div>
      <v-form ref="signUpForm" lazy-validation>
        <v-row>
          <v-col cols="12" class="py-0">
            <v-text-field v-model="name" :rules="nameRules" label="School Name" outlined dense />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" class="py-0">
            <v-text-field v-model="address" :rules="addressRules" label="Address" outlined dense />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="4" md="4" class="pb-0">
            <v-text-field v-model="deposite" label="Security Deposite" outlined dense />
          </v-col>
          <v-col cols="12" sm="4" md="4" class="pb-0">
            <v-menu
              ref="depositeDate"
              v-model="depositeMenu"
              :close-on-content-click="false"
              transition="scale-transition"
              offset-y
              min-width="auto"
            >
              <template v-slot:activator="{ on, attrs }">
                <v-text-field
                  v-model="deposite_date"
                  label="Deposite Date"
                  readonly
                  v-bind="attrs"
                  v-on="on"
                  outlined
                  dense
                  class="dob"
                ></v-text-field>
              </template>
              <v-date-picker
                v-model="deposite_date"
                :active-picker.sync="activePicker"
                :max="new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().substr(0, 10)"
                min="2020-01-01"
                @change="saveDepositeDate"
              ></v-date-picker>
            </v-menu>
          </v-col>
          <v-col cols="12" sm="4" md="4" class="pb-0">
            <v-text-field v-model="agent_name" label="Agent Name" outlined dense />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="8" md="8" class="pb-0">
            <v-text-field v-model="maplink" label="Google Map Link" outlined dense />
          </v-col>
          <v-col cols="12" sm="4" md="4" class="pb-0">
            <v-text-field v-model="pin_code" :rules="pincodeRules" required label="Pincode" outlined dense />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" class="py-0">
            <v-text-field v-model="email" :rules="emailRules" label="Email" outlined dense autocomplete="username" />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="6" md="6" class="py-0">
            <v-text-field
              v-model="password"
              :append-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
              :type="showPassword ? 'text' : 'password'"
              label="Password"
              autocomplete="new-password"
              @click:append="showPassword = !showPassword"
              outlined
              dense
            />
          </v-col>
          <v-col cols="12" sm="6" md="6" class="py-0">
            <v-text-field
              v-model="confirmPassword"
              :append-icon="showConfirmPassword ? 'mdi-eye' : 'mdi-eye-off'"
              :type="showConfirmPassword ? 'text' : 'password'"
              label="Confirm Password"
              @click:append="showConfirmPassword = !showConfirmPassword"
              outlined
              dense
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="6" md="6" class="pb-0">
            <v-text-field v-model="phone_number" label="Phone Number" outlined dense />
          </v-col>
          <v-col cols="12" sm="6" md="6" class="pb-0">
            <v-text-field
              v-model="no_of_students"
              :rules="studentsRules"
              required
              label="Number of Students"
              outlined
              dense
            />
          </v-col>
        </v-row>

        <v-btn class="float-right" color="primary" @click="handleSavingSchool" depressed>Save</v-btn>
        <v-btn class="float-right mr-1" color="secondary" to="/admin/school/list" depressed>Cancel</v-btn>
      </v-form>
    </v-sheet>
  </div>
</template>

<script>
import Snackbar from "../../../components/Snackbar.vue";
import snackbarMixin from "../../../mixins/snackbar";
import { adminApiAuth, adminApi } from "../../../utils/api";
// import occupations from "../../../data/occupations";
const passwordLengthValidator = (v) => !v || (v && v.length >= 6) || "Password must be at least 6 characters long";
export default {
  name: "School-Add",
  components: {
    Snackbar,
  },
  mixins: [snackbarMixin],
  props: ["id"],
  data: () => ({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone_number: "",
    no_of_students: "",
    branch: "",
    address: "",
    maplink: "",
    deposite: "",
    deposite_date: "",
    agent_name: "",
    pin_code: "",
    activePicker: null,
    showPassword: false,
    showConfirmPassword: false,
    emailRules: [
      // (v) => !!v || "Email is required",
      (v) => !v || /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,7})+$/.test(v) || "Email must be valid",
    ],
    // passwordRules: [
    //   (v) => !!v || "Password is required",
    //   passwordLengthValidator,
    // ],
    addressRules: [(v) => !!v || "Address is required"],
    // depositeRules: [(v) => !!v || "Security Deposite is required"],
    // depositeDateRules: [(v) => !!v || "Deposite Date is required"],
    // phoneNumberRules: [(v) => !!v || "Phone Number is required"],
    nameRules: [(v) => !!v || "School Name is required"],
    schoolbranchRules: [(v) => !!v || "Branch is required"],
    studentsRules: [(v) => !!v || "Students Number is required"],
    // maplinkRules: [(v) => !!v || "Google map link is required"],
    pincodeRules: [(v) => !!v || "Pincode is required"],

    snackbar: {
      show: false,
      status: "",
      message: "",
    },
  }),
  watch: {
    depositeMenu(val) {
      val && setTimeout(() => (this.activePicker = "YEAR"));
    },
  },
  computed: {
    matchPasswordRule() {
      return this.password === this.confirmPassword || "Password must match";
    },
  },
  created() {
    this.getSources();
  },
  async mounted() {
    if (this.id) {
      const response = await adminApi.get(`/api/school/${this.id}`, {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("access-token"),
        },
      });
      if (response.data.success) {
        var d = response.data.data[0];
        var props = {
          name: "name",
          email: "email",
          branch: "branch",
          address: "address",
          phone_number: "phone_number",
          no_of_students: "no_of_students",
          maplink: "maplink",
          deposite: "deposite",
          deposite_date: "deposite_date",
          agent_name: "agent_name",
          pin_code: "pin_code",
          id: "_id",
        };
        Object.keys(props).forEach((p) => {
          this.$set(this, p, d[props[p]]);
        });
        this.$set(this, "passwordRules", [passwordLengthValidator]);
      }
    }
  },
  methods: {
    async getSources() {
      try {
        const res = await adminApi.get("/api/index/app-sources", {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("access-token"),
          },
        });
        if (res.data.success) {
          this.occupations = [{ id: "", name: "Other" }].concat(res.data.data);
          this.standards = res.data.data;
        }
      } catch (err) {
        console.log("err", err);
      }
    },
    async handleSavingSchool() {
      if (!this.$refs.signUpForm.validate()) return;

      try {
        const methodName = this.id ? "put" : "post";
        const url = this.id ? `/update-school/${this.id}` : "/register-school";
        const dataToSave = {
          name: this.name,
          password: this.password,
          address: this.address,
          no_of_students: this.no_of_students,
          branch: this.branch,
          phone_number: this.phone_number,
          maplink: this.maplink,
          deposite: this.deposite,
          deposite_date: this.deposite_date,
          agent_name: this.agent_name,
          pin_code: this.pin_code,
        };
        if (this.email) {
          dataToSave.email = this.email;
        }
        const response = await adminApiAuth[methodName](url, dataToSave);
        if (response.data.success) {
          this.callSuccess(response.data.message);
          setTimeout(() => {
            const actionName = this.id ? "updateSchool" : "addSchool";
            this.$store.dispatch(actionName, response.data.data[0]);
            this.$router.push("/admin/school/list");
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
    saveDepositeDate(date) {
      this.$refs.depositeDate.save(date);
    },
  },
};
</script>
