<template>
  <div class="page">
    <h1 class="page-title">Data freshness</h1>
    <p class="page-subtitle mt-1 mb-6">
      Job listings are collected on a schedule from public sources. This page shows exactly what ran, when, and whether
      it worked — so you can tell how current the numbers elsewhere are.
    </p>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>
    <v-skeleton-loader v-if="loading" type="card, table" />

    <template v-else-if="status">
      <v-row dense class="mb-4">
        <v-col cols="6" md="3">
          <v-card border flat class="pa-4">
            <div class="stat-value">{{ status.totals.roles }}</div>
            <div class="stat-label">Career stages</div>
          </v-card>
        </v-col>
        <v-col cols="6" md="3">
          <v-card border flat class="pa-4">
            <div class="stat-value">{{ status.totals.jobs }}</div>
            <div class="stat-label">Postings stored</div>
          </v-card>
        </v-col>
        <v-col cols="6" md="3">
          <v-card border flat class="pa-4">
            <div class="stat-value">{{ status.totals.jobsMatchedToRoles }}</div>
            <div class="stat-label">Linked to a stage</div>
          </v-card>
        </v-col>
        <v-col cols="6" md="3">
          <v-card border flat class="pa-4">
            <div class="stat-value text-body-1 font-weight-bold">{{ status.totals.schedule }}</div>
            <div class="stat-label">Daily schedule (cron)</div>
          </v-card>
        </v-col>
      </v-row>

      <v-alert type="info" variant="tonal" class="mb-4" density="comfortable">
        Most postings stay unlinked, and that is deliberate: a title is only attached to a career stage when the match
        is unambiguous. A wrong link would distort that stage's "skills in demand" figures, whereas an unlinked posting
        is still fully browsable on the jobs board.
      </v-alert>

      <v-card border flat class="mb-4">
        <v-card-title class="text-subtitle-1">Sources</v-card-title>
        <v-table density="comfortable">
          <thead>
            <tr>
              <th>Source</th>
              <th>Type</th>
              <th>Enabled</th>
              <th>Last collected</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="source in status.sources" :key="source.key">
              <td>
                <a :href="source.homepage" target="_blank" rel="noopener noreferrer">{{ source.name }}</a>
              </td>
              <td>
                <v-chip size="x-small" variant="tonal">{{ source.kind }}</v-chip>
              </td>
              <td>
                <v-icon
                  :icon="source.enabled ? 'mdi-check-circle' : 'mdi-pause-circle'"
                  :color="source.enabled ? 'success' : 'warning'"
                  size="18"
                />
              </td>
              <td class="text-medium-emphasis">{{ relativeTime(source.lastRunAt) }}</td>
            </tr>
          </tbody>
        </v-table>
      </v-card>

      <v-card border flat>
        <v-card-title class="text-subtitle-1">Recent collection runs</v-card-title>
        <v-table v-if="status.runs.length" density="comfortable">
          <thead>
            <tr>
              <th>Started</th>
              <th>Source</th>
              <th>Status</th>
              <th class="text-right">Found</th>
              <th class="text-right">New</th>
              <th class="text-right">Linked</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="run in status.runs" :key="run.id">
              <td class="text-medium-emphasis">{{ relativeTime(run.startedAt) }}</td>
              <td>{{ run.sourceKey }}</td>
              <td>
                <v-tooltip v-if="run.message" :text="run.message" location="top">
                  <template #activator="{ props }">
                    <v-chip v-bind="props" size="x-small" :color="statusColor(run.status)" variant="tonal">
                      {{ run.status }}
                    </v-chip>
                  </template>
                </v-tooltip>
                <v-chip v-else size="x-small" :color="statusColor(run.status)" variant="tonal">{{ run.status }}</v-chip>
              </td>
              <td class="text-right">{{ run.jobsFound }}</td>
              <td class="text-right">{{ run.jobsNew }}</td>
              <td class="text-right">{{ run.jobsMatched }}</td>
            </tr>
          </tbody>
        </v-table>
        <v-card-text v-else class="text-body-2 text-medium-emphasis">
          Nothing collected yet. Run <code>npm run ingest</code> from the repository root.
        </v-card-text>
      </v-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "@/api/client";
import type { StatusPayload } from "@/api/types";
import { relativeTime } from "@/utils/format";

const status = ref<StatusPayload | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

function statusColor(value: string): string {
  if (value === "ok") return "success";
  if (value === "error") return "error";
  if (value === "running") return "info";
  return "warning";
}

onMounted(async () => {
  try {
    status.value = await api.status();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : "Could not load status";
  } finally {
    loading.value = false;
  }
});
</script>
