<template>
  <v-app>
    <v-app-bar flat density="comfortable" color="surface" class="brand-appbar">
      <v-app-bar-nav-icon class="d-md-none" @click="drawer = !drawer" />

      <router-link to="/explore" class="brand-lockup d-flex align-center text-decoration-none ms-2">
        <img src="/logo.png" alt="Career Maps" class="brand-mark me-2" width="34" height="34" />
        <span class="text-h6 font-weight-bold text-primary">Career Maps</span>
      </router-link>

      <div class="d-none d-md-flex ms-8">
        <v-btn v-for="link in navLinks" :key="link.to" :to="link.to" variant="text" :prepend-icon="link.icon">
          {{ link.label }}
        </v-btn>
      </div>

      <v-spacer />

      <template v-if="auth.user">
        <v-btn to="/roadmaps" variant="text" prepend-icon="mdi-bookmark-multiple" class="d-none d-sm-flex">
          My roadmaps
        </v-btn>
        <v-menu>
          <template #activator="{ props }">
            <v-btn v-bind="props" icon>
              <v-avatar size="34" color="primary" :image="auth.user.avatarUrl ?? undefined">
                <span v-if="!auth.user.avatarUrl" class="text-white">{{ initials }}</span>
              </v-avatar>
            </v-btn>
          </template>
          <v-list density="compact">
            <v-list-item :subtitle="auth.user.email" :title="auth.user.name ?? 'Signed in'" />
            <v-divider />
            <v-list-item to="/roadmaps" prepend-icon="mdi-bookmark-multiple" title="My roadmaps" />
            <v-list-item prepend-icon="mdi-logout" title="Sign out" @click="signOut" />
          </v-list>
        </v-menu>
      </template>
      <v-btn v-else to="/signin" color="primary" variant="flat" prepend-icon="mdi-login">Sign in</v-btn>
    </v-app-bar>

    <v-navigation-drawer v-model="drawer" temporary>
      <div class="d-flex align-center ga-2 pa-4">
        <img src="/logo.png" alt="" class="brand-mark" width="28" height="28" aria-hidden="true" />
        <span class="text-subtitle-1 font-weight-bold text-primary">Career Maps</span>
      </div>
      <v-divider />
      <v-list nav>
        <v-list-item v-for="link in navLinks" :key="link.to" :to="link.to" :prepend-icon="link.icon" :title="link.label" />
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <router-view v-slot="{ Component }">
        <v-fade-transition mode="out-in">
          <component :is="Component" />
        </v-fade-transition>
      </router-view>
    </v-main>

    <v-footer color="surface" border class="d-flex flex-wrap align-center justify-space-between text-caption py-4 ga-2">
      <img src="/logo.png" alt="" class="brand-mark" width="22" height="22" aria-hidden="true" />
      <span class="flex-grow-1">
        Career pathway data is curated. Job listings are collected daily from public sources —
        <router-link to="/data">see what was collected and when</router-link>.
      </span>
      <span class="text-medium-emphasis">Feedback: lifelonglearning.in@gmail.com</span>
    </v-footer>
  </v-app>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const router = useRouter();
const drawer = ref(false);

const navLinks = [
  { to: "/explore", label: "Explore map", icon: "mdi-graph-outline" },
  { to: "/plan", label: "Plan a path", icon: "mdi-directions" },
  { to: "/jobs", label: "Live jobs", icon: "mdi-briefcase-search" },
  { to: "/data", label: "Data freshness", icon: "mdi-database-clock" },
];

const initials = computed(() => {
  const source = auth.user?.name ?? auth.user?.email ?? "";
  return source.trim().slice(0, 1).toUpperCase() || "?";
});

onMounted(() => {
  void auth.ensureLoaded();
});

async function signOut(): Promise<void> {
  await auth.signOut();
  await router.push("/explore");
}
</script>
