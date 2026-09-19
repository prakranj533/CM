import { createVuetify } from "vuetify";
import "vuetify/styles";

/**
 * Palette sampled directly from the logo: the pin is #056839 and the accent
 * crescent is #FCB040. Everything else is derived from those two so the app and
 * the mark stay in step.
 */
export const brand = {
  green: "#056839",
  greenDark: "#034A28",
  greenMuted: "#9DBBA9",
  amber: "#FCB040",
  amberDark: "#C4841F",
} as const;

export const vuetify = createVuetify({
  theme: {
    defaultTheme: "careerMaps",
    themes: {
      careerMaps: {
        dark: false,
        colors: {
          primary: "#056839",
          secondary: "#0B7F47",
          // Amber is a fill/highlight colour, never a text colour: #FCB040 on
          // white fails contrast, so it is paired with dark text everywhere.
          accent: "#FCB040",
          surface: "#ffffff",
          background: "#f5f8f5",
          success: "#056839",
          warning: "#B4740C",
          error: "#B3261E",
          info: "#0B7F47",
        },
      },
    },
  },
  defaults: {
    VCard: { rounded: "lg", elevation: 1 },
    VBtn: { rounded: "lg" },
    VTextField: { variant: "outlined", density: "comfortable", color: "primary" },
    VAutocomplete: { variant: "outlined", density: "comfortable", color: "primary" },
    VSelect: { variant: "outlined", density: "comfortable", color: "primary" },
    VChip: { size: "small" },
    VProgressLinear: { color: "primary" },
  },
});
