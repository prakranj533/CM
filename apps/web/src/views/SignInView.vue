<template>
  <div class="page" style="max-width: 460px">
    <v-card border flat class="pa-6">
      <h1 class="text-h5 font-weight-bold mb-1">{{ mode === "signin" ? "Sign in" : "Create an account" }}</h1>
      <p class="text-body-2 text-medium-emphasis mb-5">
        An account lets you save routes and come back to them later.
      </p>

      <v-alert v-if="oauthError" type="error" variant="tonal" class="mb-4">
        Google sign-in did not complete. Please try again.
      </v-alert>
      <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>

      <v-form @submit.prevent="submit">
        <v-text-field
          v-if="mode === 'register'"
          v-model="name"
          label="Name (optional)"
          autocomplete="name"
          class="mb-2"
        />
        <v-text-field
          v-model="email"
          label="Email"
          type="email"
          autocomplete="email"
          :error-messages="fieldErrors.email"
          required
          class="mb-2"
        />
        <v-text-field
          v-model="password"
          label="Password"
          :type="showPassword ? 'text' : 'password'"
          :autocomplete="mode === 'signin' ? 'current-password' : 'new-password'"
          :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
          :error-messages="fieldErrors.password"
          :hint="mode === 'register' ? 'At least 8 characters' : undefined"
          persistent-hint
          required
          @click:append-inner="showPassword = !showPassword"
        />

        <v-btn type="submit" block color="primary" variant="flat" size="large" :loading="loading" class="mt-5">
          {{ mode === "signin" ? "Sign in" : "Create account" }}
        </v-btn>
      </v-form>

      <template v-if="auth.providers.google">
        <div class="d-flex align-center my-4 ga-3">
          <v-divider /><span class="text-caption text-medium-emphasis">or</span><v-divider />
        </div>
        <v-btn block variant="outlined" size="large" prepend-icon="mdi-google" href="/api/auth/google">
          Continue with Google
        </v-btn>
      </template>

      <v-divider class="my-5" />

      <div class="text-body-2 text-center">
        <template v-if="mode === 'signin'">
          No account yet?
          <a href="#" @click.prevent="switchMode('register')">Create one</a>
        </template>
        <template v-else>
          Already registered?
          <a href="#" @click.prevent="switchMode('signin')">Sign in</a>
        </template>
      </div>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ApiError } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const mode = ref<"signin" | "register">("signin");
const email = ref("");
const password = ref("");
const name = ref("");
const showPassword = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);
const fieldErrors = ref<{ email?: string[]; password?: string[] }>({});

const oauthError = computed(() => route.query.error === "google");

function switchMode(next: "signin" | "register"): void {
  mode.value = next;
  error.value = null;
  fieldErrors.value = {};
}

async function submit(): Promise<void> {
  loading.value = true;
  error.value = null;
  fieldErrors.value = {};
  try {
    if (mode.value === "signin") await auth.signIn(email.value, password.value);
    else await auth.register(email.value, password.value, name.value || undefined);

    const redirect = typeof route.query.redirect === "string" ? route.query.redirect : "/roadmaps";
    await router.push(redirect);
  } catch (caught) {
    if (caught instanceof ApiError) {
      error.value = caught.message;
      // Surface per-field validation messages next to the inputs.
      if (caught.details) fieldErrors.value = caught.details;
    } else {
      error.value = "Something went wrong. Please try again.";
    }
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void auth.ensureLoaded();
  if (route.query.mode === "register") mode.value = "register";
});
</script>
