<template>
  <div class="home">
    <Navbar v-if="user" @toggle-drawer="$refs.drawer.drawer = !$refs.drawer.drawer" />
    <Drawer v-if="isAdmin" ref="drawer" />
    <router-view />
  </div>
</template>

<script>
import jwt from "jsonwebtoken";
import Navbar from "../../components/Navbar.vue";
import Drawer from "../../components/Drawer.vue";

export default {
  name: "AdminHome",
  components: {
    Navbar,
    Drawer,
  },
  data: () => ({}),
  computed: {
    user() {
      return this.$store.state.user;
    },
    isAdmin() {
      return this.user ? this.user.is_admin : false;
    },
  },
  created() {
    if (!this.$store.state.user) {
      const user = jwt.decode(localStorage.getItem("refresh-token"));
      this.$store.dispatch("updateAuthState", user);
    }
  },
  methods: {
    goToCareerPathFinder() {},
  },
};
</script>

<style>
.container {
  max-width: 100%;
}
</style>