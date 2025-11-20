// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ["@nuxt/ui", "@nuxtjs/supabase", "@nuxt/image"],

  devtools: {
    enabled: true,
  },

  css: ["~/assets/css/main.css"],

  ui: {
    theme: {
      colors: [
        "primary",
        "secondary",
        "info",
        "success",
        "warning",
        "error",
        "mine-shaft",
      ],
    },
  },

  colorMode: {
    preference: "light",
  },

  compatibilityDate: "2025-01-15",

  runtimeConfig: {
    openaiApiKey: process.env.OPENAI_API_KEY,
    public: {
      apiBase: process.env.NUXT_PUBLIC_SITE_URL || "http://localhost:3000/",
    },
  },
});
