import { useState, useRef, useEffect, useCallback } from 'react'
import { Sparkles, Loader2, Search, Wrench, ChevronDown, ChevronRight, Trash2, Server, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/appStore'
import { chatWithTools, type ChatMessage, type McpToolInfo } from '@/lib/aiHelper'
import { useTranslation } from 'react-i18next'

export function AiQueryBar() {
	const {
		openaiApiKey,
		anthropicApiKey,
		googleApiKey,
		aiProvider,
		language
	} = useAppStore()
	const { t } = useTranslation()

	const [prompt, setPrompt] = useState('')
	const [messages, setMessages] = useState<ChatMessage[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [mcpTools, setMcpTools] = useState<McpToolInfo[]>([])
	const [activeToolCall, setActiveToolCall] = useState<string | null>(null)
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const messagesEndRef = useRef<HTMLDivElement>(null)

	// Auto-resize textarea
	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = 'auto'
			textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
		}
	}, [prompt])

	// Scroll to bottom on new messages
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [messages, activeToolCall])

	// Load MCP tools on mount and periodically
	const loadMcpTools = useCallback(async () => {
		try {
			const tools = await window.ipcRenderer.mcpListAllTools()
			setMcpTools(tools)
		} catch {
			// MCP not available
		}
	}, [])

	useEffect(() => {
		loadMcpTools()
		const interval = setInterval(loadMcpTools, 10000) // Refresh every 10s
		return () => clearInterval(interval)
	}, [loadMcpTools])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		const apiKey = aiProvider === 'openai' ? openaiApiKey :
			aiProvider === 'anthropic' ? anthropicApiKey :
				googleApiKey

		if (!apiKey) {
			alert(`Please set your ${aiProvider.toUpperCase()} API Key in Settings first.`)
			return
		}
		if (!prompt.trim()) return

		const userMessage: ChatMessage = { role: 'user', content: prompt.trim() }
		const updatedMessages = [...messages, userMessage]
		setMessages(updatedMessages)
		setPrompt('')
		setIsLoading(true)
		setActiveToolCall(null)

		try {
			const config = { provider: aiProvider, apiKey }

			// Refresh tools before calling
			await loadMcpTools()

			const result = await chatWithTools(
				config,
				updatedMessages,
				mcpTools,
				language,
				(toolName) => {
					setActiveToolCall(toolName)
				},
				() => {
					setActiveToolCall(null)
				}
			)

			setMessages(result.messages)
		} catch (err: any) {
			console.error("AI Assistant failed:", err)
			setMessages(prev => [...prev, {
				role: 'assistant',
				content: `Error: ${err.message || 'An error occurred.'}`
			}])
		} finally {
			setIsLoading(false)
			setActiveToolCall(null)
		}
	}

	const handleClear = () => {
		setMessages([])
		setActiveToolCall(null)
	}

	return (
		<div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3 shadow-sm flex flex-col">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 text-primary">
					<Sparkles className="w-5 h-5 fill-primary/20" />
					<div className="flex flex-col">
						<span className="text-sm font-bold">{t('query.orchestratorTitle')} Assistant</span>
						<span className="text-[10px] text-muted-foreground uppercase tracking-tight">
							{t('query.orchestratorSubtitle', { provider: aiProvider })}
							{mcpTools.length > 0 && (
								<span className="ml-1 text-primary">
									• {mcpTools.length} tools
								</span>
							)}
						</span>
					</div>
				</div>
				{messages.length > 0 && (
					<Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-muted-foreground" onClick={handleClear}>
						<Trash2 className="w-3 h-3 mr-1" />
						Clear
					</Button>
				)}
			</div>

			{/* Message History */}
			{messages.length > 0 && (
				<div className="max-h-[400px] overflow-y-auto space-y-2 border rounded-lg p-2 bg-background/50">
					{messages.map((msg, i) => (
						<MessageBubble key={i} message={msg} />
					))}
					{activeToolCall && (
						<div className="flex items-center gap-2 text-xs text-primary px-2 py-1 animate-pulse">
							<Loader2 className="w-3 h-3 animate-spin" />
							<Wrench className="w-3 h-3" />
							<span>Calling {activeToolCall}...</span>
						</div>
					)}
					{isLoading && !activeToolCall && (
						<div className="flex items-center gap-2 text-xs text-muted-foreground px-2 py-1">
							<Loader2 className="w-3 h-3 animate-spin" />
							<span>Thinking...</span>
						</div>
					)}
					<div ref={messagesEndRef} />
				</div>
			)}

			{/* Input */}
			<form onSubmit={handleSubmit} className="group relative">
				<Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
				<textarea
					ref={textareaRef}
					placeholder={mcpTools.length > 0
						? "Ask anything... AI will use MCP tools automatically (e.g. 'Show my tasks')"
						: "Ask how to use the APIs... (e.g. 'How do I create a new task?')"
					}
					className="w-full pl-10 pr-28 py-2.5 text-sm bg-background/50 border border-primary/10 rounded-md focus:border-primary/40 focus:ring-1 focus:ring-primary/20 focus:outline-none resize-none min-h-[40px] max-h-[200px] overflow-y-auto"
					value={prompt}
					onChange={(e) => setPrompt(e.target.value)}
					disabled={isLoading}
					rows={1}
					onKeyDown={(e) => {
						if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
							e.preventDefault()
							if (prompt.trim()) {
								handleSubmit(e)
							}
						}
					}}
				/>
				<div className="absolute right-1 top-1 flex gap-1">
					<Button
						type="submit"
						size="sm"
						className="h-8 px-3 text-xs gap-1"
						disabled={isLoading || !prompt.trim()}
					>
						{isLoading ? (
							<Loader2 className="w-3 h-3 animate-spin" />
						) : (
							<>
								<Sparkles className="w-3 h-3 fill-current" />
								<span>Ask</span>
							</>
						)}
					</Button>
				</div>
			</form>

			{/* MCP tools indicator */}
			{mcpTools.length > 0 && (
				<div className="flex flex-wrap gap-1">
					{Array.from(new Set(mcpTools.map(t => t.serverName))).map(name => (
						<span key={name} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
							<Server className="w-2.5 h-2.5" />
							{name}
						</span>
					))}
				</div>
			)}
		</div>
	)
}

// ---- Message Bubble Component ----

function MessageBubble({ message }: { message: ChatMessage }) {

	if (message.role === 'user') {
		return (
			<div className="flex justify-end">
				<div className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm max-w-[85%]">
					{message.content}
				</div>
			</div>
		)
	}

	if (message.role === 'assistant') {
		return (
			<div className="space-y-1">
				{/* Tool calls indicator */}
				{message.toolCalls && message.toolCalls.length > 0 && (
					<div className="space-y-1">
						{message.toolCalls.map((tc, i) => (
							<ToolCallBubble key={tc.id || i} toolCall={tc} />
						))}
					</div>
				)}
				{/* Text response */}
				{message.content && (
					<div className="bg-muted/50 rounded-lg px-3 py-2 text-sm max-w-[90%] whitespace-pre-wrap leading-relaxed">
						{message.content}
					</div>
				)}
			</div>
		)
	}

	if (message.role === 'tool') {
		// Tool results are shown inside ToolCallBubble, skip standalone rendering
		// Only render if not preceded by an assistant message with matching toolCall
		return null
	}

	return null
}

function ToolCallBubble({ toolCall }: { toolCall: { id: string; name: string; arguments: Record<string, unknown>; result?: any } }) {
	const [isExpanded, setIsExpanded] = useState(false)
	const displayName = toolCall.name.includes('__') ? toolCall.name.split('__').pop() : toolCall.name
	const hasError = toolCall.result?.error

	return (
		<div className={`border rounded-md text-xs ${hasError ? 'border-red-500/30 bg-red-500/5' : 'border-primary/20 bg-primary/5'}`}>
			<button
				onClick={() => setIsExpanded(!isExpanded)}
				className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left hover:bg-muted/30 transition-colors"
			>
				{isExpanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
				{hasError ? (
					<AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
				) : (
					<Wrench className="w-3 h-3 text-primary shrink-0" />
				)}
				<span className="font-medium text-primary truncate">{displayName}</span>
				{toolCall.result && !hasError && (
					<span className="text-[9px] text-green-500 ml-auto">✓</span>
				)}
				{hasError && (
					<span className="text-[9px] text-red-500 ml-auto">✗</span>
				)}
			</button>
			{isExpanded && (
				<div className="px-2 pb-2 space-y-1 border-t border-primary/10">
					<div>
						<span className="text-[9px] uppercase text-muted-foreground font-bold">Arguments</span>
						<pre className="text-[10px] bg-muted/50 rounded p-1.5 overflow-auto max-h-[100px] whitespace-pre-wrap break-all">
							{JSON.stringify(toolCall.arguments, null, 2)}
						</pre>
					</div>
					{toolCall.result && (
						<div>
							<span className="text-[9px] uppercase text-muted-foreground font-bold">Result</span>
							<pre className="text-[10px] bg-muted/50 rounded p-1.5 overflow-auto max-h-[200px] whitespace-pre-wrap break-all">
								{JSON.stringify(toolCall.result, null, 2)}
							</pre>
						</div>
					)}
				</div>
			)}
		</div>
	)
}
