<script setup lang="ts">
const user = useSupabaseUser();
const { query } = useRoute();

watch(
  user,
  () => {
    if (user.value) {
      const to = (query.redirectTo as string) ?? "/";
      return navigateTo(to);
    }
  },
  { immediate: true }
);
</script>

<template>
  <div></div>
</template>
