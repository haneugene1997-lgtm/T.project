"use client";

import { ThemeProvider } from "../src/theme/ThemeProvider.jsx";

export function Providers({ children }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
