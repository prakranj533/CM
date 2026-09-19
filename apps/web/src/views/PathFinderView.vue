<template>
  <div class="page">
    <h1 class="page-title">Plan a path</h1>
    <p class="page-subtitle mt-1 mb-6">
      Pick where you are now and where you want to end up. Every route in the curated map is listed, cheapest first,
      with the time each step takes.
    </p>

    <v-card border flat class="pa-4 mb-6">
      <v-row dense align="center">
        <v-col cols="12" md="5">
          <v-autocomplete
            v-model="from"
            :items="allRoles"
            item-title="name"
            item-value="slug"
            label="Starting point"
            prepend-inner-icon="mdi-map-marker"
            hide-details
            clearable
          />
        </v-col>
        <v-col cols="12" md="5">
          <v-autocomplete
            v-model="to"
            :items="destinations"
            item-title="name"
            item-value="slug"
            label="Destination"
            prepend-inner-icon="mdi-flag-checkered"
            :disabled="!from"
            :loading="loadingDestinations"
            :hint="from ? `${destinations.length} stages reachable from here` : 'Choose a starting point first'"
            persistent-hint
            clearable
          />
        </v-col>
        <v-col cols="12" md="2">
          <v-btn block color="primary" variant="flat" :disabled="!from || !to" :loading="loading" @click="search">
            Find routes
          </v-btn>
        </v-col>
      </v-row>
    </v-card>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>

    <v-alert v-if="result && result.count === 0" type="info" variant="tonal" class="mb-4">
      No route exists from <strong>{{ result.from.name }}</strong> to <strong>{{ result.to.name }}</strong> in the
      curated map. The connection may simply not be recorded yet.
    </v-alert>

    <template v-if="result && result.count > 0">
      <v-row>
        <v-col cols="12" lg="7">
          <v-card border flat>
            <v-tabs v-model="tab" show-arrows density="comfortable">
              <v-tab v-for="(path, index) in result.paths" :key="index" :value="index">
                Route {{ index + 1 }} · {{ formatYears(path.totalYears) }}y
              </v-tab>
            </v-tabs>

            <v-window v-model="tab">
              <v-window-item v-for="(path, index) in result.paths" :key="index" :value="index">
                <v-card-text>
                  <div class="d-flex flex-wrap justify-space-between align-center ga-2 mb-2">
                    <div>
                      <span class="stat-value">{{ formatYears(path.totalYears) }} years</span>
                      <span class="text-body-2 text-medium-emphasis ms-2">
                        · {{ pluralize(path.steps.length - 1, "step") }}
                      </span>
                    </div>
                    <v-btn
                      size="small"
                      variant="tonal"
                      prepend-icon="mdi-bookmark-plus"
                      :loading="saving === index"
                      @click="saveRoadmap(path, index)"
                    >
                      Save this route
                    </v-btn>
                  </div>

                  <v-timeline side="end" density="compact" truncate-line="both">
                    <v-timeline-item
                      v-for="(step, stepIndex) in path.steps"
                      :key="step.roleId"
                      size="x-small"
                      :dot-color="stepIndex === path.steps.length - 1 ? 'success' : 'primary'"
                    >
                      <div class="d-flex justify-space-between ga-2">
                        <router-link :to="`/roles/${step.slug}`" class="text-body-1 font-weight-medium">
                          {{ step.name }}
                        </router-link>
                        <span class="text-caption text-medium-emphasis">
                          {{ stepIndex === 0 ? "start" : `+${formatYears(step.durationYears)}y` }}
                        </span>
                      </div>
                      <div v-if="step.skills.length" class="text-caption text-medium-emphasis">
                        {{ step.skills.join(", ") }}
                      </div>
                    </v-timeline-item>
                  </v-timeline>

                  <template v-if="path.skills.length">
                    <v-divider class="my-3" />
                    <div class="text-caption stat-label mb-2">Skills across this route</div>
                    <div class="d-flex flex-wrap ga-1">
                      <v-chip v-for="skill in path.skills" :key="skill" variant="outlined">{{ skill }}</v-chip>
                    </div>
                  </template>
                </v-card-text>
              </v-window-item>
            </v-window>
          </v-card>
        </v-col>

        <v-col cols="12" lg="5">
          <v-card border flat class="mb-4">
            <v-card-title class="text-subtitle-1">
              {{ result.count }} route{{ result.count === 1 ? "" : "s" }} found
            </v-card-title>
            <v-card-subtitle class="text-caption">Selected route highlighted on the map.</v-card-subtitle>
            <CareerGraph
              :nodes="subgraphNodes"
              :edges="result.subgraph.edges"
              :height="380"
              :highlight-path="highlightedEdges"
              label-all
              @select="openRole"
            />
          </v-card>

          <v-card v-if="result.fastest" border flat>
            <v-card-title class="text-subtitle-1">Quickest route</v-card-title>
            <v-card-text>
              <div class="stat-value mb-2">{{ formatYears(result.fastest.totalYears) }} years</div>
              <div class="text-body-2">
                {{ result.fastest.steps.map((step) => step.name).join(" → ") }}
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>

    <v-snackbar v-model="snackbar.open" :color="snackbar.color" timeout="4000">{{ snackbar.text }}</v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import CareerGraph from "@/components/CareerGraph.vue";
import { api, ApiError } from "@/api/client";
import type { CareerPath, GraphNode, PathsPayload } from "@/api/types";
import { useAuthStore } from "@/stores/auth";
import { formatYears, pluralize } from "@/utils/format";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const allRoles = ref<Array<{ slug: string; name: string }>>([]);
const destinations = ref<Array<{ slug: string; name: string }>>([]);
const from = ref<string | null>(null);
const to = ref<string | null>(null);
const result = ref<PathsPayload | null>(null);
const tab = ref(0);
const loading = ref(false);
const loadingDestinations = ref(false);
const saving = ref<number | null>(null);
const error = ref<string | null>(null);
const snackbar = ref({ open: false, text: "", color: "success" });

const subgraphNodes = computed<GraphNode[]>(() =>
  (result.value?.subgraph.nodes ?? []).map((node) => ({
    id: node.id,
    slug: node.slug,
    name: node.name,
    category: null,
    centrality: 1,
    inDegree: 0,
    outDegree: 0,
    openings: 0,
  })),
);

/** Edges of the currently selected route, so the map mirrors the open tab. */
const highlightedEdges = computed(() => {
  const path = result.value?.paths[tab.value];
  if (!path) return [];
  return path.steps.slice(1).map((step, index) => ({ from: path.steps[index]!.roleId, to: step.roleId }));
});

async function loadRoles(): Promise<void> {
  const { nodes } = await api.graph();
  allRoles.value = nodes
    .map((node) => ({ slug: node.slug, name: node.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

watch(from, async (value) => {
  to.value = null;
  result.value = null;
  destinations.value = [];
  if (!value) return;
  loadingDestinations.value = true;
  try {
    destinations.value = (await api.reachable(value)).roles;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : "Could not load destinations";
  } finally {
    loadingDestinations.value = false;
  }
});

async function search(): Promise<void> {
  if (!from.value || !to.value) return;
  loading.value = true;
  error.value = null;
  try {
    result.value = await api.paths(from.value, to.value);
    tab.value = 0;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : "Could not find routes";
    result.value = null;
  } finally {
    loading.value = false;
  }
}

async function saveRoadmap(path: CareerPath, index: number): Promise<void> {
  if (!auth.user) {
    await router.push({ name: "signin", query: { redirect: route.fullPath } });
    return;
  }
  if (!from.value || !to.value) return;

  saving.value = index;
  try {
    await api.saveRoadmap({ from: from.value, to: to.value, path });
    snackbar.value = { open: true, text: "Route saved to your roadmaps", color: "success" };
  } catch (caught) {
    const message =
      caught instanceof ApiError ? caught.message : "Could not save this route";
    snackbar.value = { open: true, text: message, color: "error" };
  } finally {
    saving.value = null;
  }
}

function openRole(slug: string): void {
  void router.push(`/roles/${slug}`);
}

onMounted(async () => {
  await loadRoles();
  // Support deep links from role pages: /plan?to=some-role (and optional ?from=).
  const queryFrom = typeof route.query.from === "string" ? route.query.from : null;
  const queryTo = typeof route.query.to === "string" ? route.query.to : null;
  if (queryFrom) from.value = queryFrom;
  if (queryTo) {
    // Default the origin to the map's entry stage so a one-click plan works.
    if (!queryFrom) from.value = allRoles.value.find((role) => role.slug === "8th")?.slug ?? null;
    await new Promise((resolve) => setTimeout(resolve, 0));
    to.value = queryTo;
    if (from.value) await search();
  }
});
</script>
