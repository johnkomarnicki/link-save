export default defineAppConfig({
  ui: {
    colors: {
      primary: "san-marino",
      neutral: "gray",
      "mine-shaft": "mine-shaft",
    },
    button: {
      defaultVariants: {
        size: "xl",
      },
      slots: {
        base: "text-white!",
      },
    },
    input: {
      defaultVariants: {
        size: "lg",
        color: "neutral",
      },
    },
  },
});
