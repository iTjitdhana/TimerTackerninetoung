import type { AlertState } from "../types";

interface AlertProps {
  alert: AlertState | null;
}

export function Alert({ alert }: AlertProps) {
  if (!alert) return null;

  const style =
    alert.variant === "success"
      ? {
          background: "rgba(34, 197, 94, 0.12)",
          color: "#86efac",
          borderColor: "rgba(34, 197, 94, 0.3)",
        }
      : undefined;

  return (
    <div className="alert" role="alert" style={style}>
      {alert.message}
    </div>
  );
}
