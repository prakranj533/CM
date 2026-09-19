<template>
  <v-card border flat class="h-100 d-flex flex-column">
    <v-card-item>
      <div class="d-flex justify-space-between align-start ga-2">
        <div>
          <a :href="job.url" target="_blank" rel="noopener noreferrer" class="text-body-1 font-weight-medium text-primary text-decoration-none">
            {{ job.title }}
            <v-icon icon="mdi-open-in-new" size="12" />
          </a>
          <div class="text-body-2 text-medium-emphasis">
            {{ job.company }}<span v-if="job.location"> · {{ job.location }}</span>
          </div>
        </div>
        <v-chip v-if="job.isRemote" size="x-small" color="secondary" variant="tonal">Remote</v-chip>
      </div>
    </v-card-item>

    <v-card-text class="pt-0">
      <div class="d-flex flex-wrap ga-1 mb-2">
        <v-chip v-if="salary" color="success" variant="tonal" prepend-icon="mdi-cash">{{ salary }}</v-chip>
        <v-chip v-if="job.seniority" variant="tonal">{{ job.seniority }}</v-chip>
        <v-chip
          v-if="job.role"
          :to="`/roles/${job.role.slug}`"
          variant="tonal"
          color="primary"
          prepend-icon="mdi-map-marker-path"
        >
          {{ job.role.name }}
        </v-chip>
      </div>

      <div v-if="job.skills?.length" class="d-flex flex-wrap ga-1">
        <v-chip
          v-for="skill in job.skills"
          :key="skill.name"
          size="x-small"
          variant="outlined"
          :color="skillColor(skill.category)"
        >
          {{ skill.name }}
        </v-chip>
      </div>
    </v-card-text>

    <v-card-actions class="text-caption text-medium-emphasis pt-0">
      <span>{{ posted }} · via {{ job.sourceKey }}</span>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { JobSummary } from "@/api/types";
import { formatSalary, relativeTime, skillColor } from "@/utils/format";

const props = defineProps<{ job: JobSummary }>();
const salary = computed(() => formatSalary(props.job));

// Not every source publishes a date (We Work Remotely doesn't), so fall back to
// when the crawler first saw the posting rather than showing "date unknown".
const posted = computed(() => {
  const when = props.job.postedAt ?? props.job.firstSeenAt ?? null;
  const label = relativeTime(when);
  return props.job.postedAt ? label : `first seen ${label}`;
});
</script>
