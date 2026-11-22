import { defineManifest } from "@pliantui/contract"

// #region manifest
export const statCardManifest = defineManifest({
  kind: "acme:stat-card",
  version: 1,
  description: "A card with one metric and its change from last period",
  capabilities: {
    props: {
      variant: {
        values: ["default", "outline", "muted", "danger"],
        default: "default",
        semantic: ["danger"],
        description: "How much the card stands out",
      },
      size: { values: ["sm", "default", "lg"], default: "default" },
    },
    label: true,
    hideable: true,
    defaults: {
      defaultPeriod: { values: ["week", "month", "quarter"], persist: true },
    },
  },
})
// #endregion manifest
