import { defineStore } from "pinia";
import { ref } from "vue";
import { api } from "@/api/client";
import type { AuthUser } from "@/api/types";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<AuthUser | null>(null);
  const providers = ref<{ password: boolean; google: boolean }>({ password: true, google: false });
  const loading = ref(false);

  /** In-flight promise, so concurrent callers share one request. */
  let inFlight: Promise<void> | null = null;

  async function load(): Promise<void> {
    loading.value = true;
    try {
      const response = await api.me();
      user.value = response.user;
      providers.value = response.providers;
    } catch {
      // Treat an unreachable API as "signed out" rather than blocking navigation.
      user.value = null;
    } finally {
      loading.value = false;
    }
  }

  function ensureLoaded(): Promise<void> {
    inFlight ??= load().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  async function signIn(email: string, password: string): Promise<void> {
    const { user: signedIn } = await api.login(email, password);
    user.value = signedIn;
  }

  async function register(email: string, password: string, name?: string): Promise<void> {
    const { user: created } = await api.register(email, password, name);
    user.value = created;
  }

  async function signOut(): Promise<void> {
    await api.logout();
    user.value = null;
  }

  return { user, providers, loading, ensureLoaded, load, signIn, register, signOut };
});
