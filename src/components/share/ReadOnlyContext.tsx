// Read-only context (plan section P3 iter 2 FE-B). The /shared/:token route
// renders the same report components as the authenticated dashboard, but the
// recipient must not be able to mutate state. Each report checks
// useReadOnly() before rendering action buttons (Run audit, Pause, Ignore /
// Unignore, Settings link, etc.). Defaults to false so authenticated routes
// behave normally without opting in.
//
// AGENTS.md note: factor each report into a `<XReport read-only?>` prop OR
// (lighter) wrap each report's component with a context provider that hides
// the action buttons. We chose the second approach so we don't have to
// thread a prop through every report - the shared route mounts a single
// provider wrapper and every nested action button reads the boolean.

import { createContext, useContext, type ReactNode } from "react"

const ReadOnlyContext = createContext<boolean>(false)

export function ReadOnlyProvider({
  value,
  children,
}: {
  value: boolean
  children: ReactNode
}) {
  return (
    <ReadOnlyContext.Provider value={value}>
      {children}
    </ReadOnlyContext.Provider>
  )
}

/** Returns true when the current subtree is mounted under the public
 *  /shared/:token route. Authenticated dashboard routes always see false. */
export function useReadOnly(): boolean {
  return useContext(ReadOnlyContext)
}
