<template>
  <div class="page">
    <h1 class="page-title">My roadmaps</h1>
    <p class="page-subtitle mt-1 mb-6">
      Routes you saved. Each one keeps the steps exactly as they were when you saved it, so later edits to the map
      cannot rewrite your plan.
    </p>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>

    <v-skeleton-loader v-if="loading" type="card, card" />

    <v-card v-else-if="!roadmaps.length" border flat class="pa-8 text-center">
      <v-icon icon="mdi-bookmark-outline" size="42" class="mb-3 text-medium-emphasis" />
      <div class="text-body-1">You haven't saved a route yet.</div>
      <v-btn color="primary" variant="flat" class="mt-4" to="/plan">Plan a path</v-btn>
    </v-card>

    <v-row v-else>
      <v-col v-for="roadmap in roadmaps" :key="roadmap.id" cols="12" md="6">
        <v-card border flat class="h-100">
          <v-card-item>
            <v-card-title class="text-subtitle-1">{{ roadmap.title }}</v-card-title>
            <v-card-subtitle class="text-caption">
              Saved {{ relativeTime(roadmap.createdAt) }}
              <template v-if="roadmap.path"> · {{ formatYears(roadmap.path.totalYears) }} years</template>
            </v-card-subtitle>
          </v-card-item>

          <v-card-text>
            <div v-if="roadmap.path" class="d-flex flex-wrap align-center ga-1">
              <template v-for="(step, index) in roadmap.path.steps" :key="step.roleId">
                <v-icon v-if="index > 0" icon="mdi-chevron-right" size="14" class="text-medium-emphasis" />
                <router-link :to="`/roles/${step.slug}`" class="text-body-2">{{ step.name }}</router-link>
              </template>
            </div>
            <p v-else class="text-body-2 text-medium-emphasis mb-0">Saved route data could not be read.</p>
          </v-card-text>

          <v-card-actions>
            <v-btn variant="text" :to="`/plan?from=${roadmap.from.slug}&to=${roadmap.to.slug}`">Open in planner</v-btn>
            <v-spacer />
            <v-btn
              variant="text"
              color="error"
              :loading="deleting === roadmap.id"
              @click="remove(roadmap.id)"
            >
              Delete
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "@/api/client";
import type { SavedRoadmap } from "@/api/types";
import { formatYears, relativeTime } from "@/utils/format";

const roadmaps = ref<SavedRoadmap[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const deleting = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    roadmaps.value = (await api.roadmaps()).roadmaps;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : "Could not load your roadmaps";
  } finally {
    loading.value = false;
  }
}

async function remove(id: string): Promise<void> {
  deleting.value = id;
  try {
    await api.deleteRoadmap(id);
    roadmaps.value = roadmaps.value.filter((roadmap) => roadmap.id !== id);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : "Could not delete that roadmap";
  } finally {
    deleting.value = null;
  }
}

onMounted(load);
</script>
