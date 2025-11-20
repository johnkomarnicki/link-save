<script setup lang="ts">
const { auth } = useSupabaseClient();
const route = useRoute();

const user = useSupabaseUser();
watchEffect(async () => {
  if (user.value) {
    await navigateTo(query.redirectTo as string, {
      replace: true,
    });
  }
});

const { query } = useRoute();
async function signUpOAuth() {
  const queryParams =
    query.redirectTo !== undefined ? `?redirectTo=${query.redirectTo}` : "";
  const redirectTo = `${
    useRuntimeConfig().public.apiBase
  }confirm${queryParams}`;
  const { error } = await auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });

  if (error) console.warn(error);
}
</script>

<template>
  <div class="flex min-h-screen bg-white">
    <!-- Left side - Dynamic content -->
    <div class="white relative flex flex-1 flex-col overflow-hidden px-8">
      <div
        class="flex w-full max-w-screen-sm flex-1 items-center justify-center self-center"
      >
        <div
          class="flex w-full flex-col gap-6 rounded-md p-8 text-xs text-[#292727] sm:p-12 sm:text-sm"
        >
          <div
            class="flex flex-col items-center gap-6 text-center"
            :class="route.name === 'reset' ? 'mb-0' : 'mb-8'"
          >
            <div class="rounded-md">
              <NuxtImg
                src="/link-save-logo.png"
                width="80"
                height="80"
                alt="Link Saver Logo"
              />
            </div>
            <h1 class="text-5xl font-semibold">Link Saver</h1>
            <p v-if="route.name !== 'reset'" class="text-[#292727]/90">
              Please enter your details to
              {{ route.name === "login" ? "log in" : "register" }}
            </p>
            <p v-else class="text-[#292727]/90">
              Please enter your email to reset your password.
            </p>
          </div>
          <template v-if="route.name !== 'reset'">
            <UButton
              color="mine-shaft"
              @click="signUpOAuth"
              icon="i-logos-google-icon"
              label="Sign in with Google"
              block
            />
            <div class="relative">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-[#292727]"></div>
              </div>
              <div class="relative flex justify-center">
                <span class="bg-white px-2 text-sm text-[#292727]">
                  or continue with
                </span>
              </div>
            </div>
          </template>
          <slot />
        </div>
      </div>

      <!-- Footer -->
      <div
        class="relative z-10 flex flex-col items-center gap-4 py-8 md:flex-row md:justify-between"
      >
        <p class="text-xs text-gray-500">
          © 2025 Link Saver. All rights reserved.
        </p>
        <div class="flex gap-2 text-xs text-gray-500">
          <!-- <ULink to="/terms">Terms Of Service</ULink>
          <ULink to="/privacy">Privacy Policy</ULink> -->
        </div>
      </div>
    </div>

    <!-- Right side - Static background -->
    <div class="relative hidden flex-1 overflow-hidden md:block">
      <div
        class="absolute inset-0 bg-auth bg-cover bg-center bg-no-repeat"
      ></div>
    </div>
  </div>
</template>
