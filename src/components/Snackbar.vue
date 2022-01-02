<template>
  <v-snackbar
    top
    v-model="snackbar.show"
    :timeout="4000"
    :color="snackbar.status"
    elevation="24"
  >
    <span>{{ snackbar.message }}</span>
    <template v-slot:action="{ attrs }">
      <v-btn icon v-bind="attrs" @click="snackbar.show = false">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </template>
  </v-snackbar>
</template>

<script>
export default {
  name: "Snackbar",
  props: ['snackbar'],
  data: () => ({ })
}
</script>