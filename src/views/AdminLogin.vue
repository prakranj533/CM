<template>
  <div id="login-view">
    <Snackbar :snackbar="snackbar" />
    <v-sheet
      width="350"
      height="80vh"
      class="pa-4 mx-auto d-flex flex-column justify-center"
    >
      <div class="text-h5 mb-3">Admin Log In</div>
      <v-form
        ref="loginForm"
        lazy-validation
      >
        <v-text-field
          v-model="email"
          :rules="emailRules"
          label="Email"
          outlined
          dense
        />
        <v-text-field
          v-model="password"
          :append-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
          :rules="passwordRules"
          :type="showPassword ? 'text' : 'password'"
          label="Password"
          @click:append="showPassword = !showPassword"
          outlined
          dense
        />
        <v-btn
          class="float-right"
          color="primary"
          @click="handleLogin"
          depressed
        >
          Log In
        </v-btn>
      </v-form>
    </v-sheet>
  </div>
</template>

<script>
import jwt from "jsonwebtoken";
import Snackbar from "../components/Snackbar.vue";
import snackbarMixin from "../mixins/snackbar";
import { adminApiAuth } from "../utils/api";

export default {
  name: "Login",
  components: {
    Snackbar
  },
  mixins: [snackbarMixin],
  data: () => ({
    email: "",
    password: "",
    showPassword: false,
    emailRules: [
      v => !!v || 'Email is required',
      v => /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,7})+$/.test(v) || 'Email must be valid',
    ],
    passwordRules: [
      v => !!v || 'Password is required'
    ],
    snackbar: {
      show: false,
      status: "",
      message: ""
    }
  }),
  methods: {
    async handleLogin() {
      if(!this.$refs.loginForm.validate()) return;

      try {
        const response = await adminApiAuth.post('/login', {
          email_or_phone: this.email,
          password: this.password
        });
        if(response.data.success) {
          const data = response.data.data[0];
          localStorage.setItem('access-token', data.accessToken);
          localStorage.setItem('refresh-token',data.refreshToken);
          const user = jwt.decode(data.accessToken);
          this.$store.dispatch('updateAuthState', user);
          if(user.is_admin){
            this.$router.push('/admin/dashboard');
          }else {
            this.$router.push('/');
          }
        } else {
          this.callError(response.data.message);
        }
      } catch(e) {
        console.error(e.response.data.message);
        this.callError(e.response.data.message);
      }
    },
  }
}
</script>
