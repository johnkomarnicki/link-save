<script setup lang="ts">
import type { DropdownMenuItem } from "#ui/types";

const user = useSupabaseUser();
const { auth } = useSupabaseClient();
const toast = useToast();

// Mobile menu state
const isMobileMenuOpen = ref(false);

const items: DropdownMenuItem[][] = [
  [
    {
      label: user.value?.email || "",
      slot: "account",
      disabled: true,
    },
    {
      label: "My Profile",
      click: toProfile,
    },
    {
      label: "Profile Settings",
      to: "/profile/settings",
    },
  ],
  [
    {
      label: "Sign out",
      icon: "i-mdi-logout",
      onSelect: logout,
    },
  ],
];

function toProfile() {
  navigateTo(`/profile/${user.value?.id}`);
}

function toggleMobileMenu() {
  isMobileMenuOpen.value = !isMobileMenuOpen.value;
}

function closeMobileMenu() {
  isMobileMenuOpen.value = false;
}

async function logout() {
  try {
    const { error } = await auth.signOut();
    if (error) throw error;
    navigateTo("/login");
  } catch (error: any) {
    toast.add({
      color: "error",
      title: error.message,
    });
  }
}
</script>

<template>
  <header class="bg-white border-b border-gray-200">
    <UContainer>
      <nav class="flex items-center justify-between py-4">
        <!-- Logo -->
        <NuxtLink to="/" class="flex items-center" @click="closeMobileMenu">
          <NuxtImg
            format="webp"
            src="link-save-logo.png"
            height="40"
            width="40"
            alt="WebDevDaily Logo"
          />
          <span class="text-xl font-bold text-gray-900">LinkSaver</span>
        </NuxtLink>

        <!-- Desktop Navigation -->
        <div class="hidden lg:flex items-center gap-4">
          <NuxtLink
            to="/"
            class="transition-colors text-gray-600 hover:text-gray-900"
          >
            Home
          </NuxtLink>
          <NuxtLink
            to="/links"
            class="transition-colors text-gray-600 hover:text-gray-900"
          >
            Links
          </NuxtLink>
        </div>

        <!-- CTA Buttons -->
        <div class="flex items-center space-x-4">
          <UDropdownMenu
            v-if="user"
            :items="items"
            :content="{
              align: 'start',
              side: 'bottom',
              sideOffset: 8,
            }"
          >
            <UAvatar size="lg" :alt="user?.email" />
            <template #account>
              <div class="truncate text-left">
                <p class="text-sm text-gray-500">Signed in as</p>
                <p class="truncate font-medium text-gray-900">
                  {{ user?.email }}
                </p>
              </div>
            </template>
          </UDropdownMenu>

          <UButton
            v-else
            color="primary"
            size="md"
            to="/login"
            class="hidden sm:block"
          >
            Get Started
          </UButton>

          <!-- Mobile menu button -->
          <UButton
            color="primary"
            size="md"
            class="lg:hidden text-gray-900"
            :icon="
              isMobileMenuOpen ? 'i-heroicons-x-mark' : 'i-heroicons-bars-3'
            "
            @click="toggleMobileMenu"
          />
        </div>
      </nav>

      <!-- Mobile Navigation Menu -->
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="max-h-0 opacity-0"
        enter-to-class="max-h-48 opacity-100"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="max-h-48 opacity-100"
        leave-to-class="max-h-0 opacity-0"
      >
        <div v-if="isMobileMenuOpen" class="lg:hidden overflow-hidden">
          <div class="container mx-auto px-4 pt-4 pb-4 space-y-4">
            <NuxtLink
              to="/"
              class="block transition-colors py-2 text-gray-600 hover:text-gray-900"
              @click="closeMobileMenu"
            >
              Home
            </NuxtLink>
            <NuxtLink
              to="/links"
              class="block transition-colors py-2 text-gray-600 hover:text-gray-900"
              @click="closeMobileMenu"
            >
              Links
            </NuxtLink>
            <div v-if="!user" class="pt-2 border-t border-gray-300">
              <UButton
                color="neutral"
                size="sm"
                to="/login"
                class="w-full"
                @click="closeMobileMenu"
              >
                Get Started
              </UButton>
            </div>
          </div>
        </div>
      </Transition>
    </UContainer>
  </header>
</template>
