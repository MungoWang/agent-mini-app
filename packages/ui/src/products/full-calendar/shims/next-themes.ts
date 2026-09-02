export function useTheme() {
  return {
    theme: typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light",
    setTheme(_theme: string) {},
  }
}
