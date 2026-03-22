import { useEffect } from "react"
import { Outlet } from "react-router-dom"
import Navbar from "./Navbar"
import ChatOverlay from "./ChatOverlay"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { usePortfolioStore } from "@/stores/portfolioStore"
import { useAuth } from "@/hooks/useAuth"

export default function AppShell() {
  const { isAuthenticated, isLoading } = useAuth()
  const loadPreferences = usePreferencesStore((s) => s.loadFromServer)
  const loadPortfolios = usePortfolioStore((s) => s.loadFromServer)

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      loadPreferences()
      loadPortfolios()
    }
  }, [isAuthenticated, isLoading, loadPreferences, loadPortfolios])

  return (
    <div className="min-h-[100dvh] bg-[#f9fafb]">
      <Navbar />
      <main className="pt-16">
        <Outlet />
      </main>
      <ChatOverlay />
    </div>
  )
}
