import { useState, useEffect } from "react";

interface ThemeToggleProps {
  onThemeChange: (isDark: boolean) => void;
}

export function ThemeToggle({ onThemeChange }: ThemeToggleProps) {
  const [isDark, setIsDark] = useState(() => {
    // Check localStorage for saved theme preference
    const saved = localStorage.getItem("samantha-theme");
    return saved === "dark";
  });

  useEffect(() => {
    // Save theme preference and notify parent
    localStorage.setItem("samantha-theme", isDark ? "dark" : "light");
    onThemeChange(isDark);
  }, [isDark, onThemeChange]);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  return (
    <button
      onClick={toggleTheme}
      className="companion-button px-3 py-1 text-xs flex items-center gap-2"
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {isDark ? (
        <>
          <span>☀️</span>
          <span>LIGHT</span>
        </>
      ) : (
        <>
          <span>🌙</span>
          <span>DARK</span>
        </>
      )}
    </button>
  );
}