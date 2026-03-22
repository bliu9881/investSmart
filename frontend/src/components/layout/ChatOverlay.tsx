import { AnimatePresence, motion } from "framer-motion"
import { useUIStore } from "@/stores/uiStore"
import { X, Send, Bot, Loader2 } from "lucide-react"
import { useState, useEffect, useRef, useCallback } from "react"
import { AgentCoreClient } from "@/lib/agentcore-client"
import type { AgentPattern } from "@/lib/agentcore-client"
import { useAuth } from "@/hooks/useAuth"
import type { Message, MessageSegment, ToolCall } from "@/components/chat/types"
import ReactMarkdown from "react-markdown"

export default function ChatOverlay() {
  const { chatOpen, setChatOpen } = useUIStore()
  const { token } = useAuth()
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [client, setClient] = useState<AgentCoreClient | null>(null)
  const [sessionId] = useState(() => crypto.randomUUID())
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Load agent configuration and create client
  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await fetch("/aws-exports.json")
        if (!response.ok) return
        const config = await response.json()
        if (!config.agentRuntimeArn) return

        const agentClient = new AgentCoreClient({
          runtimeArn: config.agentRuntimeArn,
          region: config.awsRegion || "us-east-1",
          pattern: (config.agentPattern || "strands-single-agent") as AgentPattern,
        })
        setClient(agentClient)
      } catch (err) {
        console.error("Failed to load agent configuration:", err)
      }
    }
    loadConfig()
  }, [])

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return

    setError(null)

    const userMsg: Message = {
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    }

    const assistantMsg: Message = {
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput("")
    setIsStreaming(true)

    if (!client || !token) {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: client
            ? "Authentication required. Please log in again."
            : "Chat service is not configured yet. Please ensure the backend is deployed.",
        }
        return updated
      })
      setIsStreaming(false)
      return
    }

    try {
      const segments: MessageSegment[] = []
      const toolCallMap = new Map<string, ToolCall>()

      const updateAssistant = () => {
        const content = segments
          .filter((s): s is Extract<MessageSegment, { type: "text" }> => s.type === "text")
          .map(s => s.content)
          .join("")

        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content,
            segments: [...segments],
          }
          return updated
        })
      }

      await client.invoke(trimmed, sessionId, token, event => {
        switch (event.type) {
          case "text": {
            const last = segments[segments.length - 1]
            if (last && last.type === "text") {
              last.content += event.content
            } else {
              segments.push({ type: "text", content: event.content })
            }
            updateAssistant()
            break
          }
          case "tool_use_start": {
            const tc: ToolCall = {
              toolUseId: event.toolUseId,
              name: event.name,
              input: "",
              status: "streaming",
            }
            toolCallMap.set(event.toolUseId, tc)
            segments.push({ type: "tool", toolCall: tc })
            updateAssistant()
            break
          }
          case "tool_use_delta": {
            const tc = toolCallMap.get(event.toolUseId)
            if (tc) tc.input += event.input
            updateAssistant()
            break
          }
          case "tool_result": {
            const tc = toolCallMap.get(event.toolUseId)
            if (tc) {
              tc.result = event.result
              tc.status = "complete"
            }
            updateAssistant()
            break
          }
          case "message": {
            if (event.role === "assistant") {
              for (const tc of toolCallMap.values()) {
                if (tc.status === "streaming") tc.status = "executing"
              }
              updateAssistant()
            }
            break
          }
        }
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error"
      setError(errorMessage)
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: "I encountered an error processing your request. Please try again.",
        }
        return updated
      })
    } finally {
      setIsStreaming(false)
    }
  }, [input, isStreaming, client, token, sessionId])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const hasMessages = messages.length > 0

  return (
    <>
      {/* Floating action button */}
      <AnimatePresence>
        {!chatOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring" as const, stiffness: 200, damping: 20 }}
            onClick={() => setChatOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 flex items-center justify-center hover:bg-emerald-700 active:scale-[0.95] transition-colors"
          >
            <Bot className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {chatOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setChatOpen(false)}
              className="fixed inset-0 z-40 bg-zinc-950/10 backdrop-blur-sm md:hidden"
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring" as const, stiffness: 300, damping: 30 }}
              className="fixed top-0 right-0 z-50 h-full w-full md:w-[400px] bg-white border-l border-zinc-200/50 shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-950">AI Assistant</h3>
                    <p className="text-xs text-zinc-400">
                      {isStreaming ? "Thinking..." : "Investment guidance"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setChatOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {!hasMessages && (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                      <Bot className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h4 className="text-sm font-medium text-zinc-950 mb-1">
                      Ask me anything about investments
                    </h4>
                    <p className="text-xs text-zinc-400 max-w-[240px]">
                      I can help with stock analysis, portfolio strategy, market concepts, and more.
                    </p>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-emerald-600 text-white"
                          : "bg-zinc-100 text-zinc-900"
                      }`}
                    >
                      {msg.role === "assistant" && !msg.content && isStreaming && i === messages.length - 1 ? (
                        <div className="flex items-center gap-2 text-zinc-400">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span className="text-xs">Thinking...</span>
                        </div>
                      ) : msg.role === "assistant" ? (
                        <div className="prose prose-sm prose-zinc max-w-none [&>p]:m-0 [&>ul]:my-1 [&>ol]:my-1">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}

                      {/* Show tool calls if any */}
                      {msg.segments?.filter(s => s.type === "tool").map((seg, j) => {
                        if (seg.type !== "tool") return null
                        return (
                          <div
                            key={j}
                            className="mt-2 text-xs bg-zinc-200/50 rounded-lg px-3 py-2 font-mono"
                          >
                            <span className="text-emerald-700">{seg.toolCall.name}</span>
                            {seg.toolCall.status === "complete" ? (
                              <span className="text-zinc-400 ml-1">completed</span>
                            ) : (
                              <Loader2 className="w-3 h-3 animate-spin inline ml-1" />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {error && (
                  <div className="text-xs text-rose-500 text-center px-4 py-2 bg-rose-50 rounded-xl">
                    {error}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div className="border-t border-zinc-100 p-4">
                <div className="flex items-center gap-2 bg-zinc-50 rounded-2xl px-4 py-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about stocks, portfolios..."
                    disabled={isStreaming}
                    className="flex-1 bg-transparent text-sm text-zinc-950 placeholder:text-zinc-400 focus:outline-none disabled:opacity-50"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || isStreaming}
                    className="p-2 rounded-xl bg-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-700 active:scale-[0.95] transition-all"
                  >
                    {isStreaming ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
