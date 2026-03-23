import { useState, useEffect, useRef } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { useUIStore } from "@/stores/uiStore"
import { useAuth } from "@/hooks/useAuth"
import {
  Settings,
  MessageCircle,
  TrendingUp,
  LogOut,
  Home,
  ChevronDown,
  Sparkles,
  Search,
} from "lucide-react"

export default function Navbar() {
  const { toggleChat, chatOpen } = useUIStore()
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const isHome = location.pathname === "/"
  const isPortfolioRoute =
    location.pathname.startsWith("/build") || location.pathname.startsWith("/analyze")

  // Dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [dropdownOpen])

  // Close on Escape
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setDropdownOpen(false)
    }
    if (dropdownOpen) {
      document.addEventListener("keydown", handleEsc)
      return () => document.removeEventListener("keydown", handleEsc)
    }
  }, [dropdownOpen])

  // Close dropdown on route change
  useEffect(() => {
    setDropdownOpen(false)
  }, [location.pathname])

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-white/80 backdrop-blur-xl border-b border-zinc-200/50">
      <div className="max-w-7xl mx-auto h-full px-4 md:px-8 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 no-underline">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-zinc-950">
            InvestSmart
          </span>
        </Link>

        {/* Navigation - centered, hidden on mobile */}
        <div className="hidden md:flex items-center bg-zinc-100 rounded-full p-1">
          {/* Home */}
          <button
            onClick={() => navigate("/")}
            className="relative px-5 py-1.5 text-sm font-medium transition-colors duration-200 rounded-full"
          >
            {isHome && (
              <motion.div
                layoutId="nav-indicator"
                className="absolute inset-0 bg-white rounded-full shadow-sm"
                transition={{ type: "spring" as const, stiffness: 300, damping: 30 }}
              />
            )}
            <span
              className={`relative z-10 flex items-center gap-1.5 ${
                isHome ? "text-zinc-950" : "text-zinc-500"
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              Home
            </span>
          </button>

          {/* Portfolio dropdown */}
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="relative px-5 py-1.5 text-sm font-medium transition-colors duration-200 rounded-full"
            >
              {isPortfolioRoute && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-0 bg-white rounded-full shadow-sm"
                  transition={{ type: "spring" as const, stiffness: 300, damping: 30 }}
                />
              )}
              <span
                className={`relative z-10 flex items-center gap-1 ${
                  isPortfolioRoute ? "text-zinc-950" : "text-zinc-500"
                }`}
              >
                Portfolio
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    dropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </span>
            </button>

            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-white rounded-xl shadow-lg border border-zinc-200 overflow-hidden"
                >
                  <button
                    onClick={() => {
                      navigate("/build")
                      setDropdownOpen(false)
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${
                      location.pathname.startsWith("/build")
                        ? "bg-emerald-50 text-emerald-700"
                        : "text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <div>
                      <p className="font-medium">Build New</p>
                      <p className="text-xs text-zinc-400 mt-0.5">AI-generated portfolio</p>
                    </div>
                  </button>
                  <div className="border-t border-zinc-100" />
                  <button
                    onClick={() => {
                      navigate("/analyze")
                      setDropdownOpen(false)
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${
                      location.pathname.startsWith("/analyze")
                        ? "bg-emerald-50 text-emerald-700"
                        : "text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    <Search className="w-4 h-4 shrink-0" />
                    <div>
                      <p className="font-medium">Analyze Existing</p>
                      <p className="text-xs text-zinc-400 mt-0.5">Import & assess holdings</p>
                    </div>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          <Link
            to="/preferences"
            className="p-2 rounded-xl text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 transition-colors no-underline"
          >
            <Settings className="w-5 h-5" />
          </Link>
          <button
            onClick={toggleChat}
            className={`p-2 rounded-xl transition-colors ${
              chatOpen
                ? "bg-emerald-50 text-emerald-600"
                : "text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100"
            }`}
          >
            <MessageCircle className="w-5 h-5" />
          </button>

          {/* Sign out */}
          <button
            onClick={signOut}
            className="p-2 rounded-xl text-zinc-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  )
}
