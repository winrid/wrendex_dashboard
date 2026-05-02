// Vitest setup file. Polyfills the few jsdom gaps we hit while testing
// shadcn / sonner / radix components.

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  // sonner reads window.matchMedia('(prefers-color-scheme: dark)') on
  // mount; jsdom doesn't ship it. The MediaQueryList stub returns
  // matches=false and a no-op listener API.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}
