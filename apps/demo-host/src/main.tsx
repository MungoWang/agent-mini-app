import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "@monkey-mini-app/ui/globals.css"
import { TooltipProvider } from "@monkey-mini-app/ui/components/tooltip"
import { Toaster } from "@monkey-mini-app/ui/components/toast"
import { App } from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <Toaster>
        <TooltipProvider>
          <App />
        </TooltipProvider>
      </Toaster>
    </ThemeProvider>
  </StrictMode>
)
