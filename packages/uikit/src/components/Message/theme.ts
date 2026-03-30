import { Variant } from "./types";

const variants = {
  warning: {
    backgroundColor: "#FFB23719",
    borderColor: "warning",
  },
  danger: {
    backgroundColor: "#ED4B9E19",
    borderColor: "failure",
  },
  success: {
    backgroundColor: "rgba(49, 208, 170, 0.1)",
    borderColor: "success",
  },
  primary: {
    backgroundColor: "rgba(118, 69, 217, 0.1)",
    borderColor: "secondary",
  },
  secondary: {
    backgroundColor: "#FFB23719",
    borderColor: "warning",
  },
  primary60: {
    backgroundColor: "#EEFBFC",
    borderColor: "#C1EDF0",
  },
  secondary60: {
    backgroundColor: "secondary10",
    borderColor: "secondary",
  },
  warning60: {
    backgroundColor: "warning10",
    borderColor: "warning20",
    iconColor: "warning60",
  },
} as const satisfies Record<Variant, { backgroundColor: string; borderColor: string; iconColor?: string }>;

export default variants;
