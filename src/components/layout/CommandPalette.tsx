import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { getNavItems } from "./nav-items"

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { tenantId = "default" } = useParams()
  const items = getNavItems(tenantId)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Command palette" description="Search across the app">
      <CommandInput placeholder="Jump to..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {items.map((item) => (
            <CommandItem
              key={item.to}
              value={item.label}
              onSelect={() => {
                setOpen(false)
                navigate(item.to)
              }}
            >
              <item.icon className="mr-2 size-4" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
