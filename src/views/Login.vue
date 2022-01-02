<template>
  <div id="login-view">
    <Snackbar :snackbar="snackbar" />
    <v-sheet
      width="350"
      height="80vh"
      class="pa-4 mx-auto d-flex flex-column justify-center"
    >
      <div class="text-h5 mb-3">Log In</div>
      <v-form
        ref="form"
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
      <div class="mt-3">
        Don't have an account? <router-link to="/sign-up">Sign Up</router-link>
      </div>
    </v-sheet>
  </div>
</template>

<script>
import axios from "axios";
import Snackbar from "../components/Snackbar.vue";
import snackbarMixin from "../mixins/snackbar";

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
      v => /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v) || 'Email must be valid',
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
      let response;
      try {
        response = await axios.post('http://localhost:8001/login', {
          email: this.email,
          password: this.password
        });
        if(response.data.success) {
          localStorage.setItem('access-token', response.data.accessToken);
          this.$router.push('/');
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
