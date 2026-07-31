const LOBE_ICON_BASE = "https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png";

export function normalizeLobeIconKey(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";

  let candidate = raw;
  try {
    const url = new URL(raw);
    candidate = url.pathname.split("/").filter(Boolean).pop() || "";
  } catch {
    candidate = raw.split("/").filter(Boolean).pop() || raw;
  }

  return candidate
    .replace(/\.(png|webp|svg)$/i, "")
    .replace(/-color$/i, "")
    .replace(/[^a-z0-9-]/g, "");
}

export function getLobeIconUrl(iconKey, theme = "light", color = true) {
  const key = normalizeLobeIconKey(iconKey);
  if (!key) return "";
  return `${LOBE_ICON_BASE}/${theme}/${key}${color ? "-color" : ""}.png`;
}
