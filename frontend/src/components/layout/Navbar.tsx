import { Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { useUIStore } from "@/stores/uiStore"
import { useAuth } from "@/hooks/useAuth"
import { Settings, MessageCircle, TrendingUp, LogOut } from "lucide-react"

export default function Navbar() {
  const { activeFlow, setActiveFlow, toggleChat, chatOpen } = useUIStore()
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const handleFlowChange = (flow: "build" | "analyze") => {
    setActiveFlow(flow)
    if (flow === "build") navigate("/build")
    else navigate("/analyze")
  }

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

        {/* Flow Toggle - centered, hidden on mobile */}
        <div className="hidden md:flex items-center bg-zinc-100 rounded-full p-1">
          {(["build", "analyze"] as const).map((flow) => (
            <button
              key={flow}
              onClick={() => handleFlowChange(flow)}
              className="relative px-5 py-1.5 text-sm font-medium transition-colors duration-200 rounded-full"
            >
              {activeFlow === flow && (
                <motion.div
                  layoutId="flow-indicator"
                  className="absolute inset-0 bg-white rounded-full shadow-sm"
                  transition={{ type: "spring" as const, stiffness: 300, damping: 30 }}
                />
              )}
              <span
                className={`relative z-10 ${
                  activeFlow === flow ? "text-zinc-950" : "text-zinc-500"
                }`}
              >
                {flow === "build" ? "Build New" : "Analyze Existing"}
              </span>
            </button>
          ))}
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
