import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"

const STORAGE_KEY = "wrendex-theme"

function getInitialDark(): boolean {
  if (typeof window === "undefined") return false
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === "dark") return true
  if (stored === "light") return false
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false
}

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean>(getInitialDark)

  useEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.classList.add("dark")
      window.localStorage.setItem(STORAGE_KEY, "dark")
    } else {
      root.classList.remove("dark")
      window.localStorage.setItem(STORAGE_KEY, "light")
    }
  }, [dark])

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setDark((d) => !d)}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}
