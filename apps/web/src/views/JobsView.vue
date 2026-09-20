<template>
  <div class="page">
    <h1 class="page-title">Live jobs</h1>
    <p class="page-subtitle mt-1 mb-6">
      Collected daily from public job sources. Skills are extracted from each description, so you can filter by what is
      actually being asked for.
    </p>

    <v-card border flat class="pa-4 mb-6">
      <v-row dense>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="filters.search"
            label="Search title, company or description"
            prepend-inner-icon="mdi-magnify"
            clearable
            hide-details
            @keyup.enter="applyFilters"
          />
        </v-col>
        <v-col cols="6" md="2">
          <v-select
            v-model="filters.seniority"
            :items="seniorityOptions"
            label="Seniority"
            clearable
            hide-details
            @update:model-value="applyFilters"
          />
        </v-col>
        <v-col cols="6" md="2">
          <v-select
            v-model="filters.remote"
            :items="[
              { title: 'Remote only', value: 'true' },
              { title: 'On-site only', value: 'false' },
            ]"
            label="Location"
            clearable
            hide-details
            @update:model-value="applyFilters"
          />
        </v-col>
        <v-col cols="6" md="2">
          <v-select
            v-model="filters.source"
            :items="sourceOptions"
            label="Source"
            clearable
            hide-details
            @update:model-value="applyFilters"
          />
        </v-col>
        <v-col cols="6" md="2">
          <v-btn block color="primary" variant="flat" :loading="loading" @click="applyFilters">Apply</v-btn>
        </v-col>
      </v-row>

      <div v-if="activeChips.length" class="d-flex flex-wrap align-center ga-2 mt-4">
        <span class="text-caption stat-label">Filtered by</span>
        <v-chip v-for="chip in activeChips" :key="chip.key" closable @click:close="clearFilter(chip.key)">
          {{ chip.label }}
        </v-chip>
      </div>
    </v-card>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>

    <div class="d-flex justify-space-between align-center mb-3">
      <span class="text-body-2 text-medium-emphasis">
        {{ loading ? "Loading…" : `${payload?.total ?? 0} posting(s)` }}
      </span>
    </div>

    <v-row v-if="loading">
      <v-col v-for="index in 6" :key="index" cols="12" md="6" lg="4">
        <v-skeleton-loader type="card" />
      </v-col>
    </v-row>

    <template v-else-if="payload?.jobs.length">
      <v-row>
        <v-col v-for="job in payload.jobs" :key="job.id" cols="12" md="6" lg="4">
          <JobCard :job="job" />
        </v-col>
      </v-row>

      <div class="d-flex justify-center mt-6">
        <v-pagination
          v-model="page"
          :length="payload.pages"
          :total-visible="7"
          density="comfortable"
          @update:model-value="load"
        />
      </div>
    </template>

    <v-card v-else border flat class="pa-8 text-center">
      <v-icon icon="mdi-briefcase-remove-outline" size="42" class="mb-3 text-medium-emphasis" />
      <div class="text-body-1">No postings match these filters.</div>
      <div class="text-body-2 text-medium-emphasis mt-1">
        If the board is empty entirely, run <code>npm run ingest</code> to collect today's jobs.
      </div>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import JobCard from "@/components/JobCard.vue";
import { api } from "@/api/client";
import type { JobsPayload } from "@/api/types";

const route = useRoute();
const router = useRouter();

const payload = ref<JobsPayload | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const page = ref(1);

const filters = ref({
  search: "",
  seniority: null as string | null,
  remote: null as string | null,
  source: null as string | null,
  role: null as string | null,
  skill: null as string | null,
});

const seniorityOptions = ["intern", "entry", "mid", "senior", "lead", "executive"];
// Fetched rather than hardcoded: the source list changes as adapters are added,
// and a stale literal silently offers filters that match nothing.
const sourceOptions = ref<string[]>([]);

const activeChips = computed(() =>
  (
    [
      { key: "role" as const, label: filters.value.role ? `role: ${filters.value.role}` : null },
      { key: "skill" as const, label: filters.value.skill ? `skill: ${filters.value.skill}` : null },
    ] satisfies Array<{ key: "role" | "skill"; label: string | null }>
  ).filter((chip): chip is { key: "role" | "skill"; label: string } => chip.label !== null),
);

function readQuery(): void {
  const query = route.query;
  filters.value.search = typeof query.search === "string" ? query.search : "";
  filters.value.seniority = typeof query.seniority === "string" ? query.seniority : null;
  filters.value.remote = typeof query.remote === "string" ? query.remote : null;
  filters.value.source = typeof query.source === "string" ? query.source : null;
  filters.value.role = typeof query.role === "string" ? query.role : null;
  filters.value.skill = typeof query.skill === "string" ? query.skill : null;
  page.value = Number(query.page ?? 1) || 1;
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    payload.value = await api.jobs({
      search: filters.value.search || undefined,
      seniority: filters.value.seniority ?? undefined,
      remote: filters.value.remote ?? undefined,
      source: filters.value.source ?? undefined,
      role: filters.value.role ?? undefined,
      skill: filters.value.skill ?? undefined,
      page: page.value,
      perPage: 18,
    });
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : "Could not load jobs";
    payload.value = null;
  } finally {
    loading.value = false;
  }
}

/** Keep filters in the URL so a filtered board is shareable and back works. */
async function applyFilters(): Promise<void> {
  page.value = 1;
  await router.replace({
    query: {
      search: filters.value.search || undefined,
      seniority: filters.value.seniority ?? undefined,
      remote: filters.value.remote ?? undefined,
      source: filters.value.source ?? undefined,
      role: filters.value.role ?? undefined,
      skill: filters.value.skill ?? undefined,
    },
  });
}

function clearFilter(key: "role" | "skill"): void {
  filters.value[key] = null;
  void applyFilters();
}

watch(
  () => route.query,
  () => {
    readQuery();
    void load();
  },
);

onMounted(() => {
  readQuery();
  void load();
  void api
    .status()
    .then((status) => {
      sourceOptions.value = status.registeredSources.map((source) => source.key);
    })
    .catch(() => {
      // A missing source list only costs the filter dropdown; the board still works.
    });
});
</script>
