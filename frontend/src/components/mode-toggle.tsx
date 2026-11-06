import { Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";

/** Toggles between dark and light themes from the navbar. */
export function ModeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="text-lg hover:opacity-70 transition-opacity"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <Sun className="h-5 w-5 inline" /> : <Moon className="h-5 w-5 inline" />}
    </button>
  );
}
