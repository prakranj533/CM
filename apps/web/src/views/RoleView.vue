<template>
  <div class="page">
    <v-skeleton-loader v-if="loading" type="article, actions, card" />

    <v-alert v-else-if="error" type="error" variant="tonal">
      {{ error }}
      <template #append><v-btn variant="text" to="/explore">Back to map</v-btn></template>
    </v-alert>

    <template v-else-if="detail">
      <v-breadcrumbs
        class="px-0 pt-0"
        :items="[{ title: 'Explore', to: '/explore' }, { title: detail.role.name, disabled: true }]"
      />

      <div class="d-flex flex-wrap justify-space-between align-start ga-4 mb-4">
        <div>
          <h1 class="page-title">{{ detail.role.name }}</h1>
          <p v-if="detail.role.description" class="page-subtitle mt-1">{{ detail.role.description }}</p>
          <div class="d-flex flex-wrap ga-2 mt-3">
            <v-chip prepend-icon="mdi-source-branch" variant="tonal">
              {{ pluralize(detail.prerequisites.length, "route in") }}
            </v-chip>
            <v-chip prepend-icon="mdi-arrow-decision" variant="tonal">
              {{ pluralize(detail.nextSteps.length, "next step") }}
            </v-chip>
            <v-chip prepend-icon="mdi-briefcase" variant="tonal" color="primary">
              {{ pluralize(detail.market.postings, "live posting") }}
            </v-chip>
          </div>
        </div>
        <v-btn color="primary" variant="flat" prepend-icon="mdi-directions" :to="`/plan?to=${detail.role.slug}`">
          Plan a route here
        </v-btn>
      </div>

      <v-row>
        <v-col cols="12" md="7">
          <v-card border flat class="mb-4">
            <v-card-title class="text-subtitle-1">Where you can go next</v-card-title>
            <v-list v-if="detail.nextSteps.length" density="comfortable">
              <v-list-item v-for="step in detail.nextSteps" :key="step.slug" :to="`/roles/${step.slug}`">
                <v-list-item-title>{{ step.name }}</v-list-item-title>
                <v-list-item-subtitle v-if="step.skills.length" class="text-caption">
                  {{ step.skills.join(", ") }}
                </v-list-item-subtitle>
                <template #append>
                  <v-chip v-if="step.durationYears" size="x-small" variant="tonal">
                    {{ formatYears(step.durationYears) }} yr
                  </v-chip>
                </template>
              </v-list-item>
            </v-list>
            <v-card-text v-else class="text-body-2 text-medium-emphasis">
              This is an end point in the curated map — no onward steps are recorded yet.
            </v-card-text>
          </v-card>

          <v-card border flat class="mb-4">
            <v-card-title class="text-subtitle-1">How people get here</v-card-title>
            <v-list v-if="detail.prerequisites.length" density="comfortable">
              <v-list-item v-for="step in detail.prerequisites" :key="step.slug" :to="`/roles/${step.slug}`">
                <v-list-item-title>{{ step.name }}</v-list-item-title>
                <template #append>
                  <v-chip v-if="step.durationYears" size="x-small" variant="tonal">
                    {{ formatYears(step.durationYears) }} yr
                  </v-chip>
                </template>
              </v-list-item>
            </v-list>
            <v-card-text v-else class="text-body-2 text-medium-emphasis">
              This is a starting point — nothing in the map leads into it.
            </v-card-text>
          </v-card>

          <v-card border flat>
            <v-card-title class="text-subtitle-1">Immediate neighbourhood</v-card-title>
            <CareerGraph
              v-if="neighbourhood.nodes.length > 1"
              :nodes="neighbourhood.nodes"
              :edges="neighbourhood.edges"
              :height="360"
              :selected-id="detail.role.slug"
              label-all
              @select="openRole"
            />
            <v-card-text v-else class="text-body-2 text-medium-emphasis">
              Nothing connects to this stage yet.
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="5">
          <v-card border flat class="mb-4">
            <v-card-title class="text-subtitle-1">What the market asks for</v-card-title>
            <v-card-subtitle class="text-caption">
              From postings matched to this role in the last 60 days.
            </v-card-subtitle>
            <v-card-text>
              <template v-if="detail.marketSkills.length">
                <div v-for="skill in detail.marketSkills.slice(0, 12)" :key="skill.name" class="mb-3">
                  <div class="d-flex justify-space-between text-body-2">
                    <span>{{ skill.name }}</span>
                    <span class="text-medium-emphasis">{{ Math.round(skill.demand * 100) }}%</span>
                  </div>
                  <v-progress-linear
                    :model-value="skill.demand * 100"
                    :color="skillColor(skill.category)"
                    height="6"
                    rounded
                  />
                </div>
                <p class="text-caption text-medium-emphasis mb-0">
                  Percentages are the share of matched postings mentioning each skill.
                </p>
              </template>
              <p v-else class="text-body-2 text-medium-emphasis mb-0">
                No live postings are matched to this stage. Qualification stages usually have none — try a job-shaped
                stage such as <router-link to="/roles/software-job-it">Software Job (IT)</router-link>, or browse
                <router-link to="/jobs">all live jobs</router-link>.
              </p>
            </v-card-text>
          </v-card>

          <v-card v-if="detail.curatedSkills.length" border flat class="mb-4">
            <v-card-title class="text-subtitle-1">Curated requirements</v-card-title>
            <v-card-subtitle class="text-caption">From the maintained career sheet.</v-card-subtitle>
            <v-card-text class="d-flex flex-wrap ga-1">
              <v-chip v-for="skill in detail.curatedSkills" :key="skill.name" variant="outlined">
                {{ skill.name }}
              </v-chip>
            </v-card-text>
          </v-card>

          <v-card v-if="detail.market.postings" border flat class="mb-4">
            <v-card-title class="text-subtitle-1">Market snapshot</v-card-title>
            <v-card-text>
              <v-row dense>
                <v-col cols="6">
                  <div class="stat-value">{{ Math.round(detail.market.remoteShare * 100) }}%</div>
                  <div class="stat-label">Remote</div>
                </v-col>
                <v-col cols="6">
                  <div class="stat-value">{{ salaryRange ?? "—" }}</div>
                  <div class="stat-label">Typical advertised pay</div>
                </v-col>
              </v-row>
              <v-divider class="my-3" />
              <div class="d-flex flex-wrap ga-1">
                <v-chip v-for="level in detail.market.seniority" :key="level.level" variant="tonal">
                  {{ level.level }} · {{ level.count }}
                </v-chip>
              </div>
            </v-card-text>
          </v-card>

          <v-card v-if="detail.recentJobs.length" border flat>
            <v-card-title class="text-subtitle-1">Latest openings</v-card-title>
            <v-card-text class="d-flex flex-column ga-3">
              <JobCard v-for="job in detail.recentJobs" :key="job.id" :job="job" />
            </v-card-text>
            <v-card-actions>
              <v-btn variant="text" :to="`/jobs?role=${detail.role.slug}`">See all for this role</v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import CareerGraph from "@/components/CareerGraph.vue";
import JobCard from "@/components/JobCard.vue";
import { api } from "@/api/client";
import type { GraphEdge, GraphNode, RoleDetail } from "@/api/types";
import { formatYears, pluralize, skillColor } from "@/utils/format";

const route = useRoute();
const router = useRouter();
const detail = ref<RoleDetail | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const salaryRange = computed(() => {
  const market = detail.value?.market;
  if (!market?.avgSalaryMin && !market?.avgSalaryMax) return null;
  const format = (value: number | null): string | null => (value ? `${Math.round(value / 1000)}k` : null);
  return [format(market.avgSalaryMin), format(market.avgSalaryMax)].filter(Boolean).join("–");
});

/**
 * Build a small local graph (this role + direct neighbours) for the inline map.
 * Centrality is unavailable for neighbours here, so nodes are sized uniformly.
 */
const neighbourhood = computed<{ nodes: GraphNode[]; edges: GraphEdge[] }>(() => {
  const value = detail.value;
  if (!value) return { nodes: [], edges: [] };

  const make = (slug: string, name: string, openings = 0): GraphNode => ({
    id: slug,
    slug,
    name,
    category: null,
    centrality: 1,
    inDegree: 0,
    outDegree: 0,
    openings,
  });

  const nodes = new Map<string, GraphNode>([
    [value.role.slug, make(value.role.slug, value.role.name, value.market.postings)],
  ]);
  const edges: GraphEdge[] = [];

  for (const step of value.prerequisites) {
    nodes.set(step.slug, make(step.slug, step.name));
    edges.push({ from: step.slug, to: value.role.slug, durationYears: step.durationYears, skills: step.skills });
  }
  for (const step of value.nextSteps) {
    nodes.set(step.slug, make(step.slug, step.name));
    edges.push({ from: value.role.slug, to: step.slug, durationYears: step.durationYears, skills: step.skills });
  }

  return { nodes: [...nodes.values()], edges };
});

async function load(slug: string): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    detail.value = await api.role(slug);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : "Could not load this stage";
    detail.value = null;
  } finally {
    loading.value = false;
  }
}

function openRole(slug: string): void {
  void router.push(`/roles/${slug}`);
}

watch(
  () => route.params.slug,
  (slug) => {
    if (typeof slug === "string") void load(slug);
  },
  { immediate: true },
);
</script>
