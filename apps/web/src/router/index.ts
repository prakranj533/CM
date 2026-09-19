import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/explore" },
  { path: "/explore", name: "explore", component: () => import("@/views/ExploreView.vue") },
  { path: "/roles/:slug", name: "role", component: () => import("@/views/RoleView.vue"), props: true },
  { path: "/plan", name: "plan", component: () => import("@/views/PathFinderView.vue") },
  { path: "/jobs", name: "jobs", component: () => import("@/views/JobsView.vue") },
  { path: "/roadmaps", name: "roadmaps", component: () => import("@/views/RoadmapsView.vue"), meta: { auth: true } },
  { path: "/signin", name: "signin", component: () => import("@/views/SignInView.vue") },
  { path: "/data", name: "data", component: () => import("@/views/DataView.vue") },
  { path: "/:pathMatch(.*)*", name: "not-found", component: () => import("@/views/NotFoundView.vue") },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to, _from, savedPosition) => savedPosition ?? (to.hash ? { el: to.hash } : { top: 0 }),
});

/**
 * Guard protected routes. The session lives in an httpOnly cookie, so the client
 * cannot inspect it directly — resolve it once from the API before deciding.
 */
router.beforeEach(async (to) => {
  if (!to.meta.auth) return true;
  const auth = useAuthStore();
  await auth.ensureLoaded();
  if (auth.user) return true;
  return { name: "signin", query: { redirect: to.fullPath } };
});
