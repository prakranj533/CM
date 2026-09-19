<template>
  <div class="page text-center" style="max-width: 520px">
    <v-icon icon="mdi-map-search-outline" size="64" class="text-medium-emphasis mb-4" />
    <h1 class="page-title">Page not found</h1>
    <p class="page-subtitle mx-auto mt-2">
      That route isn't on the map. Try exploring from the start, or search for a stage by name.
    </p>
    <v-btn color="primary" variant="flat" class="mt-5" to="/explore" prepend-icon="mdi-graph-outline">
      Explore the map
    </v-btn>
  </div>
</template>
