import { useSyncExternalStore } from "react";

export const CLIENT_THEMES = [
  { id: "padrao", name: "Padrão", description: "Identidade original R&R Services", colors: ["#0B192C", "#00D4FF", "#F5F7FA"] },
  { id: "atlantico", name: "Atlântico", description: "Azul profundo e verde elegante", colors: ["#123D4A", "#2D8C88", "#F2F7F7"] },
  { id: "minimal", name: "Minimal", description: "Neutros executivos e grafite", colors: ["#323A46", "#65758B", "#F3F4F6"] },
  { id: "solar", name: "Solar", description: "Tons quentes e acolhedores", colors: ["#783F2C", "#D58C52", "#FBF6F0"] },
] as const;

export type ClientTheme = (typeof CLIENT_THEMES)[number]["id"];
export const CLIENT_THEME_STORAGE_KEY = "rr-client-theme";
export const CLIENT_THEME_EVENT = "rr-client-theme-change";
let memoryTheme: ClientTheme = "padrao";

export function isClientTheme(value: unknown): value is ClientTheme {
  return typeof value === "string" && CLIENT_THEMES.some((theme) => theme.id === value);
}

export function saveClientTheme(theme: ClientTheme) {
  memoryTheme = theme;
  try {
    window.localStorage.setItem(CLIENT_THEME_STORAGE_KEY, theme);
  } catch {
    // Mantém a seleção ativa na sessão mesmo quando o navegador bloqueia storage.
  }
  window.dispatchEvent(new CustomEvent<ClientTheme>(CLIENT_THEME_EVENT, { detail: theme }));
}

function subscribeToThemeChanges(callback: () => void) {
  window.addEventListener(CLIENT_THEME_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CLIENT_THEME_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getThemeSnapshot(): ClientTheme {
  try {
    const value = window.localStorage.getItem(CLIENT_THEME_STORAGE_KEY);
    if (isClientTheme(value)) memoryTheme = value;
  } catch {
    return memoryTheme;
  }
  return memoryTheme;
}

export function useClientTheme() {
  return useSyncExternalStore(subscribeToThemeChanges, getThemeSnapshot, () => "padrao");
}
