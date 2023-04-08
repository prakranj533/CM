<template>
  <v-card>
    <v-navigation-drawer v-model="drawer" app class="admin-drawer">
      <v-list dense nav>
        <v-list-item v-for="item in items" :key="item.title" :to="item.href" link>
          <v-list-item-icon>
            <v-icon>{{ item.icon }}</v-icon>
          </v-list-item-icon>
          <v-list-item-content>
            <v-list-item-title>{{ item.title }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>
  </v-card>
</template>
<script>
import jwt from "jsonwebtoken";

export default {
  data: () => ({
    drawer: true,
    items: [
      { title: "Career Map", icon: "mdi-view-dashboard", href:"/admin/dashboard" },
      { title: "Manage Student", icon: "mdi-view-dashboard", href:"/admin/student/list" },
      { title: "Manage School", icon: "mdi-view-dashboard", href:"/admin/school/list" },
      { title: "Manage Device", icon: "mdi-image", href:"/admin/device/list" },
      { title: "Manage Policy", icon: "mdi-image", href:"/admin/policy/list" },
      { title: "Manage Plan", icon: "mdi-image", href:"/admin/plan/list" },
      { title: "Set Video", icon: "mdi-image", href:"/admin/set-video" },
      { title: "Manage Counsellor", icon: "mdi-image", href:"/admin/counsellor/list" },
      { title: "Reply to Student/User", icon: "mdi-image", href:"/admin/query/list" },
      { title: "Transaction History", icon: "mdi-image", href:"/admin/history" },
      // { title: "User Career Map History", icon: "mdi-image", href:"/admin/career-map/history" },
      { title: "Contact Us", icon: "mdi-image", href:"/admin/contact-us" },
      { title: "ChangePassword", icon: "mdi-help-box", href:"/admin/change-password" },
    ],
    right: "a",
  }),
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
  methods: {},
};
</script>

<style>
</style>