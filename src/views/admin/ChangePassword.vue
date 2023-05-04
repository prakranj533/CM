<template>
  <div id="admin-changepwd-view">
    <Snackbar :snackbar="snackbar" />
    <v-sheet width="350" height="80vh" class="pa-4 mx-auto d-flex flex-column justify-center">
      <div class="text-h5 mb-3">Change Password</div>
      <v-form ref="changePwdForm" lazy-validation>
        <v-text-field
          v-model="password"
          :append-icon="showCurrentPassword ? 'mdi-eye' : 'mdi-eye-off'"
          :rules="passwordRules"
          :type="showCurrentPassword ? 'text' : 'password'"
          label="Password"
          @click:append="showCurrentPassword = !showCurrentPassword"
          outlined
          dense
        />
        <v-text-field
          v-model="newPassword"
          :append-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
          :rules="newPasswordRules.concat(matchPasswordRule)"
          :type="showPassword ? 'text' : 'password'"
          label="New Password"
          @click:append="showPassword = !showPassword"
          outlined
          dense
        />
        <v-text-field
          v-model="confirmPassword"
          :append-icon="showConfirmPassword ? 'mdi-eye' : 'mdi-eye-off'"
          :rules="newPasswordRules.concat(matchPasswordRule)"
          :type="showConfirmPassword ? 'text' : 'password'"
          label="Confirm Password"
          @click:append="showConfirmPassword = !showConfirmPassword"
          outlined
          dense
        />
        <v-btn class="float-right" color="primary" @click="handleChangePassword" depressed>Change Password</v-btn>
      </v-form>
    </v-sheet>
  </div>
</template>

<script>
import Snackbar from "../../components/Snackbar.vue";
import snackbarMixin from "../../mixins/snackbar";
import { adminApi } from "../../utils/api";

export default {
  name: "AdminChangePwd",
  components: {
    Snackbar,
  },
  mixins: [snackbarMixin],
  data: () => ({
    password: "",
    newPassword: "",
    confirmPassword: "",
    showCurrentPassword: false,
    showPassword: false,
    showConfirmPassword: false,
    emailRules: [
      (v) => !!v || "Email is required",
      (v) => /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,7})+$/.test(v) || "Email must be valid",
    ],
    passwordRules: [(v) => !!v || "Password is required"],
    newPasswordRules: [(v) => !!v || "New Password is required"],
    snackbar: {
      show: false,
      status: "",
      message: "",
    },
  }),
  computed: {
    matchPasswordRule() {
      return this.newPassword === this.confirmPassword || "New Password must match";
    },
  },
  methods: {
    async handleChangePassword() {
      if (!this.$refs.changePwdForm.validate()) return;

      try {
        const response = await adminApi.post(
          "/api/account/change-password",
          {
            password: this.password,
            newPassword: this.newPassword,
          },
          {
            headers: {
              Authorization: "Bearer " + localStorage.getItem("access-token"),
            },
          }
        );
        if (response.data.success) {
          this.callSuccess(response.data.message);
          this.$set(this, 'password', '');
          this.$set(this, 'newPassword', '');
          this.$set(this, 'confirmPassword', '');
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
