<template>
  <div class="page">
    <div class="d-flex flex-wrap align-end justify-space-between ga-4 mb-6">
      <div>
        <h1 class="page-title">Explore the career map</h1>
        <p class="page-subtitle mt-1">
          Explore Indian careers from the Government of India's NCO-2015 classification. Zoom from broad families into
          subfamilies and specialties before opening an individual career.
        </p>
      </div>
      <v-autocomplete
        v-model="jumpTo"
        :items="roleOptions"
        item-title="name"
        item-value="slug"
        label="Jump to a stage"
        prepend-inner-icon="mdi-magnify"
        hide-details
        clearable
        style="min-width: 320px; max-width: 420px"
        @update:model-value="openRole"
      />
    </div>

    <div v-if="selectedFamily" class="d-flex flex-wrap align-center ga-2 mb-4">
      <v-btn variant="tonal" prepend-icon="mdi-arrow-left" @click="goBack">
        {{ selectedSpecialty ? selectedSubfamilyName : selectedSubfamily ? selectedFamily : "All career families" }}
      </v-btn>
      <v-chip color="primary" :variant="selectedSubfamily ? 'tonal' : 'flat'">{{ selectedFamily }}</v-chip>
      <v-icon v-if="selectedSubfamily" icon="mdi-chevron-right" size="small" />
      <v-chip v-if="selectedSubfamily" color="primary" :variant="selectedSpecialty ? 'tonal' : 'flat'">
        {{ selectedSubfamilyName }}
      </v-chip>
      <v-icon v-if="selectedSpecialty" icon="mdi-chevron-right" size="small" />
      <v-chip v-if="selectedSpecialty" color="primary" variant="flat">{{ selectedSpecialtyName }}</v-chip>
      <span class="text-caption text-medium-emphasis">{{ mapLevelText }}</span>
    </div>

    <v-row dense class="mb-2">
      <v-col v-for="stat in stats" :key="stat.label" cols="6" md="3">
        <v-card border flat class="pa-4">
          <div class="stat-value">{{ stat.value }}</div>
          <div class="stat-label">{{ stat.label }}</div>
        </v-card>
      </v-col>
    </v-row>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">
      {{ error }}
      <template #append><v-btn variant="text" @click="load">Retry</v-btn></template>
    </v-alert>

    <v-row>
      <v-col cols="12" lg="8">
        <v-card border flat>
          <v-skeleton-loader v-if="loading" type="image" height="620" />
          <CareerGraph
            v-else
            :nodes="graph.nodes"
            :edges="graph.edges"
            :height="620"
            :label-all="!selectedSpecialty"
            @select="selectMapNode"
          />
        </v-card>
      </v-col>

      <v-col cols="12" lg="4">
        <v-card border flat class="mb-4">
          <v-card-title class="text-subtitle-1">Most pivotal stages</v-card-title>
          <v-card-subtitle class="text-caption pb-2">
            Ranked by betweenness centrality — how many routes pass through them.
          </v-card-subtitle>
          <v-list density="compact" lines="one">
            <v-list-item
              v-for="hub in hubs"
              :key="hub.slug"
              :to="`/roles/${hub.slug}`"
              :title="hub.name"
              :subtitle="`${hub.inDegree} way(s) in · ${hub.outDegree} way(s) out`"
            >
              <template #append>
                <v-chip size="x-small" variant="tonal">{{ hub.centrality }}</v-chip>
              </template>
            </v-list-item>
          </v-list>
        </v-card>

        <v-card border flat>
          <v-card-title class="text-subtitle-1">Skills employers ask for now</v-card-title>
          <v-card-subtitle class="text-caption pb-2">
            Counted across every posting collected from public job sources.
          </v-card-subtitle>
          <v-card-text>
            <div v-if="trending.length" class="d-flex flex-wrap ga-1">
              <v-chip
                v-for="skill in trending"
                :key="skill.name"
                :color="skillColor(skill.category)"
                variant="tonal"
                :to="`/jobs?skill=${encodeURIComponent(skill.name)}`"
              >
                {{ skill.name }} · {{ skill.postings }}
              </v-chip>
            </div>
            <p v-else class="text-body-2 text-medium-emphasis mb-0">
              No postings collected yet. Run <code>npm run ingest</code> to fetch today's jobs.
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import CareerGraph from "@/components/CareerGraph.vue";
import { api } from "@/api/client";
import type { CareerGraphPayload } from "@/api/types";
import { skillColor } from "@/utils/format";

const router = useRouter();
const graph = ref<CareerGraphPayload>({ nodes: [], edges: [] });
const overview = ref<CareerGraphPayload>({ nodes: [], edges: [] });
const selectedFamily = ref<string | null>(null);
const selectedSubfamily = ref<string | null>(null);
const selectedSubfamilyName = ref<string | null>(null);
const selectedSpecialty = ref<string | null>(null);
const selectedSpecialtyName = ref<string | null>(null);
const roleOptions = ref<Array<{ name: string; slug: string }>>([]);
const hubs = ref<Array<{ slug: string; name: string; centrality: number; inDegree: number; outDegree: number }>>([]);
const trending = ref<Array<{ name: string; category: string; postings: number }>>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const jumpTo = ref<string | null>(null);

const totalCareers = computed(() => overview.value.nodes.reduce((total, node) => total + (node.summaryCount ?? 0), 0));
const careersAtLevel = computed(() =>
  selectedSpecialty.value ? graph.value.nodes.length : graph.value.nodes.reduce((total, node) => total + (node.summaryCount ?? 0), 0),
);
const mapLevelText = computed(() => {
  if (selectedSpecialty.value) return "Individual careers in this specialty";
  if (selectedSubfamily.value) return "Choose a focused career specialty";
  return "Choose a smaller career subfamily";
});

const stats = computed(() => [
  { label: selectedFamily.value ? "Careers in this area" : "Career stages", value: selectedFamily.value ? careersAtLevel.value : totalCareers.value },
  {
    label: selectedSpecialty.value
      ? "Career connections"
      : selectedSubfamily.value
        ? "Career specialties"
        : selectedFamily.value
          ? "Career subfamilies"
          : "Career families",
    value: selectedSpecialty.value ? graph.value.edges.length : graph.value.nodes.length,
  },
  { label: "Areas with openings", value: graph.value.nodes.filter((node) => node.openings > 0).length },
  { label: "Live postings", value: graph.value.nodes.reduce((total, node) => total + node.openings, 0) },
]);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    // Independent requests, so fetch them together rather than in sequence.
    const [overviewPayload, rolesPayload, hubsPayload, skillsPayload] = await Promise.all([
      api.graphOverview(),
      api.roles({ limit: 5000 }),
      api.hubs(12),
      api.trendingSkills(18),
    ]);
    overview.value = overviewPayload;
    graph.value = overviewPayload;
    roleOptions.value = rolesPayload.roles.map((role) => ({ name: role.name, slug: role.slug }));
    hubs.value = hubsPayload.hubs;
    trending.value = skillsPayload.skills;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : "Could not load the career map";
  } finally {
    loading.value = false;
  }
}

async function selectMapNode(slug: string): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    if (slug.startsWith("family:")) {
      const family = slug.slice("family:".length);
      graph.value = await api.graphOverview(family);
      selectedFamily.value = family;
      selectedSubfamily.value = null;
      selectedSubfamilyName.value = null;
      selectedSpecialty.value = null;
      selectedSpecialtyName.value = null;
      return;
    }
    if (slug.startsWith("subfamily:") && selectedFamily.value) {
      const subfamily = slug.slice("subfamily:".length);
      selectedSubfamilyName.value = graph.value.nodes.find((node) => node.slug === slug)?.name ?? "Career subfamily";
      graph.value = await api.graphOverview(selectedFamily.value, subfamily);
      selectedSubfamily.value = subfamily;
      selectedSpecialty.value = null;
      selectedSpecialtyName.value = null;
      return;
    }
    if (slug.startsWith("specialty:") && selectedFamily.value && selectedSubfamily.value) {
      const specialty = slug.slice("specialty:".length);
      selectedSpecialtyName.value = graph.value.nodes.find((node) => node.slug === slug)?.name ?? "Career specialty";
      graph.value = await api.graph(selectedFamily.value, selectedSubfamily.value, specialty);
      selectedSpecialty.value = specialty;
      return;
    }
    await router.push(`/roles/${slug}`);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : "Could not open this part of the career map";
  } finally {
    loading.value = false;
  }
}

async function goBack(): Promise<void> {
  loading.value = true;
  try {
    if (selectedSpecialty.value && selectedFamily.value && selectedSubfamily.value) {
      graph.value = await api.graphOverview(selectedFamily.value, selectedSubfamily.value);
      selectedSpecialty.value = null;
      selectedSpecialtyName.value = null;
      return;
    }
    if (selectedSubfamily.value && selectedFamily.value) {
      graph.value = await api.graphOverview(selectedFamily.value);
      selectedSubfamily.value = null;
      selectedSubfamilyName.value = null;
      return;
    }
    selectedFamily.value = null;
    graph.value = overview.value;
  } finally {
    loading.value = false;
  }
}

function openRole(slug: string | null): void {
  if (slug) void router.push(`/roles/${slug}`);
}

onMounted(load);
</script>
