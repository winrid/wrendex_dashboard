import { Link, NavLink, Outlet, useLocation, useParams } from "react-router-dom"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Search, ChevronDown, LogOut, User, Building } from "lucide-react"
import { Toaster } from "@/components/ui/sonner"
import { ThemeToggle } from "./ThemeToggle"
import { CommandPalette } from "./CommandPalette"
import { getNavItems } from "./nav-items"

function SidebarNav() {
  const location = useLocation()
  const { tenantId = "default" } = useParams()
  const items = getNavItems(tenantId)
  return (
    <SidebarMenu>
      {items.map((item) => {
        const active =
          location.pathname === item.to ||
          location.pathname.startsWith(`${item.to}/`)
        return (
          <SidebarMenuItem key={item.to}>
            <SidebarMenuButton asChild isActive={active}>
              <NavLink to={item.to}>
                <item.icon className="size-4" />
                <span>{item.label}</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}

function UserMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <div className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
            DW
          </div>
          <span className="hidden text-sm font-medium sm:inline">Dan W.</span>
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <User className="mr-2 size-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Building className="mr-2 size-4" />
          <span>Switch tenant</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <LogOut className="mr-2 size-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppShell() {
  const { tenantId = "default" } = useParams()
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="px-3 py-3">
          <Link to={`/t/${tenantId}/sites`} className="flex items-center gap-2 px-1">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
              W
            </div>
            <span className="text-base font-semibold">Wrendex</span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarNav />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="px-3 py-2 text-xs text-muted-foreground">
          v0.1.0 - bootstrap
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-muted-foreground hidden md:inline-flex"
            onClick={() => {
              window.dispatchEvent(
                new KeyboardEvent("keydown", { key: "k", metaKey: true }),
              )
            }}
          >
            <Search className="size-3.5" />
            <span>Search...</span>
            <kbd className="ml-2 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono">
              cmd K
            </kbd>
          </Button>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </SidebarInset>
      <CommandPalette />
      <Toaster />
    </SidebarProvider>
  )
}
