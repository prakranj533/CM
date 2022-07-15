<template>
  <nav>
    <v-app-bar flat app color="grey lighten-5" dense>
      <v-icon class="pa-2" @click.stop="$emit('toggle-drawer')">mdi-menu</v-icon>
      <router-link to="/" class="text-decoration-none">
        <v-toolbar-title class="text-uppercase black--text subtitle-2">
          <span class="blue--text text--darken-4">Career</span>
          <span class="font-weight-bold">Maps</span>
        </v-toolbar-title>
      </router-link>
      <v-spacer></v-spacer>
      <span v-if="user" class="body-2 text-capitalize mr-3">Welcome {{ user.firstName }}</span>
      <v-btn text color="black" v-show="user" @click.prevent="logOut">
        <span class="body-2 text-capitalize">Log Out</span>
        <v-icon right>mdi-logout</v-icon>
      </v-btn>
    </v-app-bar>
  </nav>
</template>

<script>
import jwt from "jsonwebtoken";
import { adminApiAuth } from "../utils/api";

export default {
  data: () => ({}),
  computed: {
    user() {
      return this.$store.state.user;
    },
  },
  created() {
    if (!this.$store.state.user) {
      const user = jwt.decode(localStorage.getItem("refresh-token"));
      this.$store.dispatch("updateAuthState", user);
    }
  },
  methods: {
    async logOut() {
      const { is_admin } = this.$store.state.user;
      try {
        var authRequest = adminApiAuth;
        await authRequest.delete("/logout", {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
          },
          data: {
            token: localStorage.getItem("refresh-token"),
          },
        });
      } catch (e) {
        console.error(e.message);
      }
      localStorage.removeItem("access-token");
      localStorage.removeItem("refresh-token");
      this.$store.dispatch("updateAuthState", null);
      this.$router.push(is_admin ? "/admin-login" : "/login");
    },
  },
};
</script>

<style lang="scss" scoped>
</style>