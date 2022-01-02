<template>
  <nav>
    <v-app-bar flat app color="grey lighten-5" dense>
      <router-link to="/" class="text-decoration-none">
        <v-toolbar-title class="text-uppercase black--text subtitle-2">
          <span class="blue--text text--darken-4">Career </span>
          <span class="font-weight-bold">Maps</span>
        </v-toolbar-title>
      </router-link>
      <v-spacer></v-spacer>
      <span class="body-2 text-capitalize mr-3">Welcome {{ user }}</span>
      <v-btn text color="black" v-show="user" @click.prevent="logOut">
        <span class="body-2 text-capitalize">Log Out</span>
        <v-icon right>mdi-logout</v-icon>
      </v-btn>
    </v-app-bar>
  </nav>  
</template>

<script>
import axios from "axios";

export default {
  data:() => ({
    user: "Suvrat",
  }),
  methods: {
    async logOut() {
      try {
        await axios.delete('http://localhost:8001/logout', {
          headers:{
            'Content-Type': 'application/json; charset=utf-8'
          },
          data: {
            token: localStorage.getItem('refresh-token')
          }
        });
      } catch(e) {
        console.error(e.message);
      }

      localStorage.removeItem('access-token');
      localStorage.removeItem('refresh-token');
      this.$router.push('/login');
    }
  }
}
</script>

<style lang="scss" scoped>
</style>