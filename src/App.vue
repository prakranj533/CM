<template>
  <v-app>
    <v-main class="text-body-2">
      <v-container>
        <router-view></router-view>
      </v-container>
    </v-main>
  </v-app>
</template>

<script>
export default {
  name: "App",
  components: {},
  data: () => ({}),
};
</script>

<style>
</style>
