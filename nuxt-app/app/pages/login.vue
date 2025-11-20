<script setup lang="ts">
import type { FormSubmitEvent } from "#ui/types";
import { z } from "zod";

definePageMeta({
  layout: "authentication",
});

useSeoMeta({
  title: "Link Saver | Login",
  description:
    "Log in to Link Saver - your personal bookmark manager. Save, organize, and access your favorite links from anywhere. Keep your web discoveries safe and searchable in one place.",
  ogTitle: "Link Saver | Login",
  ogDescription:
    "Log in to Link Saver - your personal bookmark manager. Save, organize, and access your favorite links from anywhere.",
  ogImage: "/link-save-logo.png",
  ogUrl: "/login",
  twitterTitle: "Link Saver | Login",
  twitterDescription:
    "Log in to Link Saver - your personal bookmark manager. Save, organize, and access your favorite links from anywhere.",
  twitterImage: "/link-save-logo.png",
  twitterCard: "summary",
});

const supabase = useSupabaseClient();
const router = useRouter();

const formSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type Schema = z.output<typeof formSchema>;
const formState = reactive({
  email: undefined,
  password: undefined,
});

const toast = useToast();
async function signIn(event: FormSubmitEvent<Schema>) {
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: event.data.email,
      password: event.data.password!,
    });
    if (error) throw error;
    router.push("/");
  } catch (error: any) {
    toast.add({
      title: "Error signing in",
      description: error.message,
    });
  }
}
</script>

<template>
  <UForm
    :state="formState"
    :schema="formSchema"
    @submit="signIn"
    class="flex flex-col gap-6"
  >
    <UFormField name="email" label="Email" size="lg">
      <UInput class="w-full" v-model="formState.email" />
    </UFormField>
    <UFormField name="password" label="Password" size="lg" class="w-full">
      <template #label>
        <div class="flex flex-1 justify-between">
          <label for="password">Password</label>
          <!-- <ULink
            to="/reset"
            class="text-primary ml-auto text-sm hover:underline"
          >
            Forgot password?
          </ULink> -->
        </div>
      </template>
      <UInput v-model="formState.password" class="w-full" type="password" />
    </UFormField>
    <UButton class="mb-6" type="submit" label="Log in" block />
  </UForm>
  <!-- <RouterLink to="/register" class="text-center text-sm text-[#292727]">
    <span>Don't have an account?</span>
    <span class="font-medium"> Register</span>
  </RouterLink> -->
</template>

<style></style>
