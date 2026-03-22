import { Routes, Route, Navigate } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import AppShell from "@/components/layout/AppShell"
import DashboardPage from "@/routes/DashboardPage"
import OnboardingPage from "@/routes/OnboardingPage"
import BuildPage from "@/routes/BuildPage"
import PortfolioDetailPage from "@/routes/PortfolioDetailPage"
import AnalyzePage from "@/routes/AnalyzePage"
import ImportPage from "@/routes/ImportPage"
import ImportedPortfolioPage from "@/routes/ImportedPortfolioPage"
import HealthReportPage from "@/routes/HealthReportPage"
import StockAnalysisPage from "@/routes/StockAnalysisPage"
import ComparePage from "@/routes/ComparePage"
import PreferencesPage from "@/routes/PreferencesPage"

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <div className="min-h-[100dvh] flex items-center justify-center"><div className="animate-shimmer h-8 w-32 rounded-lg" /></div>
  if (!isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="onboarding" element={<OnboardingPage />} />
        <Route path="build" element={<BuildPage />} />
        <Route path="build/:portfolioId" element={<PortfolioDetailPage />} />
        <Route path="analyze" element={<AnalyzePage />} />
        <Route path="analyze/import" element={<ImportPage />} />
        <Route path="analyze/:portfolioId" element={<ImportedPortfolioPage />} />
        <Route path="analyze/:portfolioId/health" element={<HealthReportPage />} />
        <Route path="stocks/:ticker" element={<StockAnalysisPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="preferences" element={<PreferencesPage />} />
      </Route>
    </Routes>
  )
}
