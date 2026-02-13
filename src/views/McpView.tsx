import { useState, useCallback, useRef, useEffect } from 'react'
import { useAppStore, type McpServerConfig } from '@/store/appStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, Power, PowerOff, Play, Loader2, Server, Wrench, FolderOpen, Copy, Check, Edit, FileJson, Blocks, MessageSquare, Search, ExternalLink, CheckCircle2, X, ChevronDown, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { AiQueryBar } from '@/components/AiQueryBar'
import { CONNECTOR_PRESETS, type ConnectorPreset } from '@/lib/connectorPresets'

type McpServerStatus = 'connected' | 'disconnected' | 'connecting' | 'error'

export function McpView() {
	const { t } = useTranslation()
	const { mcpServers, addMcpServer, updateMcpServer, removeMcpServer } = useAppStore()

	// Server statuses (in-memory only)
	const [serverStatuses, setServerStatuses] = useState<Record<string, McpServerStatus>>({})

	// Tabs State (Manual management because of custom Tabs component)
	const [activeTab, setActiveTab] = useState<'chat' | 'servers' | 'tools' | 'resources'>('chat')

	// Add/Edit Server Form
	const [showForm, setShowForm] = useState(false)
	const [isEditing, setIsEditing] = useState(false)
	const [editingId, setEditingId] = useState<string | null>(null)

	// Form State
	const [name, setName] = useState('')
	const [type, setType] = useState<'stdio' | 'http'>('stdio')
	const [command, setCommand] = useState('')
	const [args, setArgs] = useState('')
	const [env, setEnv] = useState('') // JSON string
	const [url, setUrl] = useState('')
	const [headers, setHeaders] = useState('') // JSON string

	// JSON Import State
	const [isJsonMode, setIsJsonMode] = useState(false)
	const [jsonConfig, setJsonConfig] = useState('')
	const [jsonError, setJsonError] = useState<string | null>(null)

	// Tool execution
	const [tools, setTools] = useState<Record<string, any[]>>({})
	const [selectedTool, setSelectedTool] = useState<{ serverId: string; name: string } | null>(null)
	const [toolArgs, setToolArgs] = useState('')
	const [toolResult, setToolResult] = useState<any>(null)
	const [isExecuting, setIsExecuting] = useState(false)

	// Resources
	const [resources, setResources] = useState<Record<string, any[]>>({})
	const [resourceContent, setResourceContent] = useState<any>(null)

	// Copy state
	const [copiedResult, setCopiedResult] = useState(false)

	// Connector state
	const [selectedPreset, setSelectedPreset] = useState<ConnectorPreset | null>(null)
	const [showPresetDropdown, setShowPresetDropdown] = useState(false)
	const [connectorSearchQuery, setConnectorSearchQuery] = useState('')
	const [connectingPreset, setConnectingPreset] = useState<ConnectorPreset | null>(null)
	const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
	const dropdownRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setShowPresetDropdown(false)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [])

	const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
		setToast({ message, type })
		const duration = type === 'error' ? 5000 : 3000
		setTimeout(() => setToast(null), duration)
	}, [])

	const filteredPresets = CONNECTOR_PRESETS.filter(preset => {
		if (!connectorSearchQuery) return true
		const q = connectorSearchQuery.toLowerCase()
		return preset.name.toLowerCase().includes(q) || preset.description.toLowerCase().includes(q) || preset.category.toLowerCase().includes(q)
	})

	// Check if a connector preset is already connected
	const isConnectorConnected = (presetId: string) => {
		return mcpServers.some(s => s.id.startsWith(`connector-${presetId}-`))
	}

	const getConnectorServerId = (presetId: string) => {
		const server = mcpServers.find(s => s.id.startsWith(`connector-${presetId}-`))
		return server?.id
	}

	const resetForm = () => {
		setName('')
		setType('stdio')
		setCommand('')
		setArgs('')
		setEnv('')
		setUrl('')
		setHeaders('')
		setIsJsonMode(false)
		setJsonConfig('')
		setJsonError(null)
		setIsEditing(false)
		setEditingId(null)
	}

	const openAddForm = () => {
		resetForm()
		setShowForm(true)
	}

	const openEditForm = (server: McpServerConfig) => {
		resetForm()
		setIsEditing(true)
		setEditingId(server.id)
		setName(server.name)
		setType(server.type)
		setEnv(server.env ? JSON.stringify(server.env, null, 2) : '')
		if (server.type === 'stdio') {
			setCommand(server.command || '')
			setArgs((server.args || []).join(' '))
		} else {
			setUrl(server.url || '')
			setHeaders(server.headers ? JSON.stringify(server.headers, null, 2) : '')
		}
		setShowForm(true)
	}

	const handleParseJson = () => {
		setJsonError(null)
		try {
			const parsed = JSON.parse(jsonConfig)
			let config = parsed
			let serverName = 'Imported Server'

			// Handle "mcpServers" format: { "mcpServers": { "name": { ... } } }
			if (parsed.mcpServers) {
				const keys = Object.keys(parsed.mcpServers)
				if (keys.length > 0) {
					serverName = keys[0]
					config = parsed.mcpServers[serverName]
				}
			}
			// Handle direct named format: { "name": { "command": ... } }
			else if (!parsed.command && !parsed.url) {
				const keys = Object.keys(parsed)
				if (keys.length === 1 && typeof parsed[keys[0]] === 'object' && (parsed[keys[0]].command || parsed[keys[0]].url)) {
					serverName = keys[0]
					config = parsed[keys[0]]
				}
			}

			// Smart detection for Wrike/mcp-remote config (convert to direct HTTP)
			if (config.command === 'npx' && Array.isArray(config.args) && config.args.some((a: string) => a.includes('mcp-remote'))) {
				console.log('[MCP] Detected mcp-remote config, converting to HTTP...')
				const urlArg = config.args.find((a: string) => a.startsWith('http'))

				const headersObj: Record<string, string> = {}
				const headerIdx = config.args.indexOf('--header')
				if (headerIdx !== -1 && config.args[headerIdx + 1]) {
					const headerVal = config.args[headerIdx + 1]
					const parts = headerVal.split(':')
					if (parts.length >= 2) {
						const key = parts[0].trim()
						const val = parts.slice(1).join(':').trim()
						headersObj[key] = val
					}
				}

				if (urlArg) {
					setType('http')
					setUrl(urlArg)
					setHeaders(Object.keys(headersObj).length > 0 ? JSON.stringify(headersObj, null, 2) : '')
					setEnv(config.env ? JSON.stringify(config.env, null, 2) : '')
					if (!name) setName(serverName)
					setIsJsonMode(false)
					return
				}
			}

			if (config.command) {
				setType('stdio')
				setCommand(config.command)
				setArgs(Array.isArray(config.args) ? config.args.join(' ') : '')
				setEnv(config.env ? JSON.stringify(config.env, null, 2) : '')
				if (!name) setName(serverName)
			} else if (config.url) {
				setType('http')
				setUrl(config.url)
				setHeaders(config.headers ? JSON.stringify(config.headers, null, 2) : '')
				setEnv(config.env ? JSON.stringify(config.env, null, 2) : '')
				if (!name) setName(serverName)
			} else {
				throw new Error('Invalid config: missing "command" or "url"')
			}

			setIsJsonMode(false)
		} catch (err: any) {
			setJsonError(err.message)
		}
	}

	const handleSaveServer = useCallback(() => {
		if (!name.trim()) return

		if (type === 'stdio' && !command.trim()) {
			alert(t('mcp.error') + ': Step Command is required')
			return
		}
		if (type === 'http' && !url.trim()) {
			alert(t('mcp.error') + ': Server URL is required')
			return
		}

		let envObj: Record<string, string> | undefined
		if (env.trim()) {
			try {
				envObj = JSON.parse(env)
			} catch {
				alert('Invalid JSON in Env Vars')
				return
			}
		}

		let headersObj: Record<string, string> | undefined
		if (headers.trim()) {
			try {
				headersObj = JSON.parse(headers)
			} catch {
				alert('Invalid JSON in Headers')
				return
			}
		}

		const config: McpServerConfig = {
			id: editingId || `mcp-${Date.now()}`,
			name: name.trim(),
			type: type,
			env: envObj,
			...(type === 'stdio'
				? {
					command: command.trim(),
					args: args.split(/\s+/).filter(Boolean),
				}
				: {
					url: url.trim(),
					headers: headersObj
				}
			)
		}

		if (isEditing && editingId) {
			updateMcpServer(editingId, config)
		} else {
			addMcpServer(config)
		}

		setShowForm(false)
		resetForm()
	}, [name, type, command, args, env, url, headers, isEditing, editingId, addMcpServer, updateMcpServer])

	const handleConnect = useCallback(async (server: McpServerConfig) => {
		console.log(`[MCP] Connecting to server: ${server.name} (${server.id})`)
		setServerStatuses(prev => ({ ...prev, [server.id]: 'connecting' }))
		try {
			const result = await window.ipcRenderer.mcpConnect(server)
			console.log(`[MCP] Connection result for ${server.name}:`, result)
			setServerStatuses(prev => ({ ...prev, [server.id]: result.success ? 'connected' : 'error' }))
			if (result.success) {
				// Auto-load tools and resources
				try {
					const t = await window.ipcRenderer.mcpListTools(server.id)
					setTools(prev => ({ ...prev, [server.id]: t }))
				} catch { /* server may not support tools */ }
				try {
					const r = await window.ipcRenderer.mcpListResources(server.id)
					setResources(prev => ({ ...prev, [server.id]: r }))
				} catch { /* server may not support resources */ }
				showToast(`${server.name}${t('mcp.connectedToast', { defaultValue: 'に接続しました。' })}`, 'success')
			} else {
				showToast(`${server.name}: ${result.error || t('mcp.error')}`, 'error')
			}
		} catch (err: any) {
			console.error(`[MCP] Connection exception for ${server.name}:`, err)
			setServerStatuses(prev => ({ ...prev, [server.id]: 'error' }))
			showToast(`${server.name}: ${err.message || t('mcp.error')}`, 'error')
		}
	}, [showToast, t])

	const handleDisconnect = useCallback(async (serverId: string) => {
		await window.ipcRenderer.mcpDisconnect(serverId)
		setServerStatuses(prev => ({ ...prev, [serverId]: 'disconnected' }))
		setTools(prev => { const n = { ...prev }; delete n[serverId]; return n })
		setResources(prev => { const n = { ...prev }; delete n[serverId]; return n })
	}, [])

	const handleRemoveServer = useCallback(async (serverId: string) => {
		if (serverStatuses[serverId] === 'connected') {
			await handleDisconnect(serverId)
		}
		removeMcpServer(serverId)
	}, [serverStatuses, handleDisconnect, removeMcpServer])

	const handleCallTool = useCallback(async () => {
		if (!selectedTool) return
		setIsExecuting(true)
		setToolResult(null)
		try {
			let args: Record<string, unknown> = {}
			if (toolArgs.trim()) {
				args = JSON.parse(toolArgs)
			}
			const result = await window.ipcRenderer.mcpCallTool(selectedTool.serverId, selectedTool.name, args)
			setToolResult(result)
		} catch (err: any) {
			setToolResult({ error: err.message })
		} finally {
			setIsExecuting(false)
		}
	}, [selectedTool, toolArgs])

	const handleReadResource = useCallback(async (serverId: string, uri: string) => {
		try {
			const result = await window.ipcRenderer.mcpReadResource(serverId, uri)
			setResourceContent(result)
		} catch (err: any) {
			setResourceContent({ error: err.message })
		}
	}, [])

	const handleCopyResult = useCallback(() => {
		if (!toolResult) return
		navigator.clipboard.writeText(JSON.stringify(toolResult, null, 2)).then(() => {
			setCopiedResult(true)
			setTimeout(() => setCopiedResult(false), 1500)
		})
	}, [toolResult])

	// Connector handlers
	const handleSelectPreset = (preset: ConnectorPreset) => {
		setSelectedPreset(preset)
		setShowPresetDropdown(false)
	}

	const handleConnectPreset = useCallback(async (preset: ConnectorPreset) => {
		// Check if server entry already exists
		const existingServerId = getConnectorServerId(preset.id)
		const existingStatus = existingServerId ? serverStatuses[existingServerId] : undefined

		// If already connected, do nothing
		if (existingServerId && existingStatus === 'connected') return

		let config: McpServerConfig

		if (existingServerId) {
			// Server entry exists but not connected - reuse it
			const existingServer = mcpServers.find(s => s.id === existingServerId)
			if (!existingServer) return
			config = existingServer
		} else {
			// Create new server config
			config = {
				id: `connector-${preset.id}-${Date.now()}`,
				name: preset.name,
				type: preset.mcpConfig.type,
				command: preset.mcpConfig.command,
				args: preset.mcpConfig.args,
				url: preset.mcpConfig.url,
			}
			addMcpServer(config)
		}

		// Start connecting
		console.log(`[MCP] Connecting to preset: ${preset.name} (ID: ${config.id})`)
		setConnectingPreset(preset)
		setSelectedPreset(null)
		setServerStatuses(prev => ({ ...prev, [config.id]: 'connecting' }))

		try {
			const result = await window.ipcRenderer.mcpConnect(config)
			console.log(`[MCP] Preset connection result for ${preset.name}:`, result)
			setServerStatuses(prev => ({ ...prev, [config.id]: result.success ? 'connected' : 'error' }))

			if (result.success) {
				// Auto-load tools and resources
				try {
					const toolsList = await window.ipcRenderer.mcpListTools(config.id)
					setTools(prev => ({ ...prev, [config.id]: toolsList }))
				} catch { /* server may not support tools */ }
				try {
					const r = await window.ipcRenderer.mcpListResources(config.id)
					setResources(prev => ({ ...prev, [config.id]: r }))
				} catch { /* server may not support resources */ }

				// Show success toast
				showToast(`${preset.name}${t('mcp.connectedToast', { defaultValue: 'に接続しました。' })}`, 'success')
			} else {
				// Connection failed
				showToast(`${preset.name}: ${result.error || t('mcp.error')}`, 'error')
			}
		} catch (err: any) {
			console.error(`[MCP] Preset connection exception for ${preset.name}:`, err)
			setServerStatuses(prev => ({ ...prev, [config.id]: 'error' }))
			showToast(`${preset.name}: ${err.message || t('mcp.error')}`, 'error')
		} finally {
			setConnectingPreset(null)
		}
	}, [addMcpServer, mcpServers, serverStatuses, t, showToast])

	const handleDisconnectPreset = useCallback(async (presetId: string) => {
		const serverId = getConnectorServerId(presetId)
		if (!serverId) return
		await handleDisconnect(serverId)
		removeMcpServer(serverId)
	}, [handleDisconnect, removeMcpServer])

	const statusBadge = (status: McpServerStatus | undefined) => {
		const s = status || 'disconnected'
		const variants: Record<string, { label: string; className: string }> = {
			connected: { label: t('mcp.connected'), className: 'bg-green-500/20 text-green-400 border-green-500/30' },
			disconnected: { label: t('mcp.disconnected'), className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
			connecting: { label: t('mcp.connecting', { defaultValue: 'Connecting...' }), className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
			error: { label: t('mcp.error', { defaultValue: 'Error' }), className: 'bg-red-500/20 text-red-400 border-red-500/30' }
		}
		const v = variants[s]
		return <Badge variant="outline" className={`text-[10px] ${v.className}`}>{v.label}</Badge>
	}

	const allTools = Object.entries(tools).flatMap(([serverId, serverTools]) =>
		serverTools.map(tool => ({ ...tool, serverId }))
	)

	const allResources = Object.entries(resources).flatMap(([serverId, serverResources]) =>
		serverResources.map(res => ({ ...res, serverId }))
	)

	return (
		<div className="h-full overflow-auto p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-xl font-bold flex items-center gap-2">
						<Blocks className="w-5 h-5 text-primary" />
						{t('mcp.title')}
					</h2>
					<p className="text-sm text-muted-foreground mt-1">{t('mcp.subtitle')}</p>
				</div>
				{showForm && (
					<Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
						<X className="w-4 h-4 mr-1" />
						{t('query.close', { defaultValue: 'Cancel' })}
					</Button>
				)}
			</div>

			{/* Add/Edit Server Form */}
			{showForm && (
				<Card className="animate-in fade-in slide-in-from-top-2 border-primary/30">
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-bold">
							{isEditing ? t('mcp.editServer', { defaultValue: 'Edit Server' }) : t('mcp.addServer')}
						</CardTitle>
						<div className="flex items-center gap-2 text-xs">
							<span className={isJsonMode ? "font-bold text-primary" : "text-muted-foreground"}>{t('mcp.jsonConfig')}</span>
							<Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsJsonMode(!isJsonMode)}>
								<FileJson className="w-4 h-4" />
							</Button>
						</div>
					</CardHeader>
					<CardContent className="space-y-3 pt-2">
						{isJsonMode ? (
							<div className="space-y-2">
								<Textarea
									value={jsonConfig}
									onChange={e => setJsonConfig(e.target.value)}
									placeholder={t('mcp.pasteConfig')}
									className="font-mono text-xs h-32"
								/>
								{jsonError && <p className="text-xs text-red-500">{jsonError}</p>}
								<div className="flex justify-end gap-2">
									<Button variant="outline" size="sm" onClick={() => setIsJsonMode(false)}>
										{t('query.close', { defaultValue: 'Cancel' })}
									</Button>
									<Button size="sm" onClick={handleParseJson}>
										{t('mcp.import')}
									</Button>
								</div>
							</div>
						) : (
							<>
								<div className="grid gap-2">
									<label className="text-xs font-medium">{t('mcp.serverName')}</label>
									<Input
										value={name}
										onChange={e => setName(e.target.value)}
										placeholder="My MCP Server"
										className="h-8 text-sm"
									/>
								</div>
								<div className="grid gap-2">
									<label className="text-xs font-medium">{t('mcp.type')}</label>
									<div className="flex gap-2">
										<Button
											size="sm"
											variant={type === 'stdio' ? 'default' : 'outline'}
											onClick={() => setType('stdio')}
											className="text-xs"
										>
											Stdio
										</Button>
										<Button
											size="sm"
											variant={type === 'http' ? 'default' : 'outline'}
											onClick={() => setType('http')}
											className="text-xs"
										>
											HTTP
										</Button>
									</div>
								</div>

								{/* Common Env Vars */}
								<div className="grid gap-2">
									<label className="text-xs font-medium">{t('mcp.env')}</label>
									<Textarea
										value={env}
										onChange={e => setEnv(e.target.value)}
										placeholder={t('mcp.envPlaceholder')}
										className="font-mono text-xs h-20"
									/>
								</div>

								{type === 'stdio' ? (
									<>
										<div className="grid gap-2">
											<label className="text-xs font-medium">{t('mcp.command')}</label>
											<Input
												value={command}
												onChange={e => setCommand(e.target.value)}
												placeholder="npx"
												className="h-8 text-sm font-mono"
											/>
										</div>
										<div className="grid gap-2">
											<label className="text-xs font-medium">{t('mcp.arguments')}</label>
											<Input
												value={args}
												onChange={e => setArgs(e.target.value)}
												placeholder="-y @modelcontextprotocol/server-filesystem /tmp"
												className="h-8 text-sm font-mono"
											/>
										</div>
									</>
								) : (
									<>
										<div className="grid gap-2">
											<label className="text-xs font-medium">{t('mcp.url')}</label>
											<Input
												value={url}
												onChange={e => setUrl(e.target.value)}
												placeholder="http://localhost:3001/mcp"
												className="h-8 text-sm font-mono"
											/>
										</div>
										<div className="grid gap-2">
											<label className="text-xs font-medium">Headers (JSON)</label>
											<Textarea
												value={headers}
												onChange={e => setHeaders(e.target.value)}
												placeholder='{ "Authorization": "Bearer ${AUTH_HEADER}" }'
												className="font-mono text-xs h-20"
											/>
										</div>
									</>
								)}
								<div className="flex justify-end gap-2 pt-2">
									<Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
										{t('query.close', { defaultValue: 'Cancel' })}
									</Button>
									<Button size="sm" onClick={handleSaveServer} disabled={!name.trim()}>
										{isEditing ? t('connSettings.save', { defaultValue: 'Save' }) : t('mcp.addServer')}
									</Button>
								</div>
							</>
						)}
					</CardContent>
				</Card>
			)}

			<Tabs className="w-full">
				<TabsList className="grid w-full grid-cols-4">
					<TabsTrigger
						active={activeTab === 'chat'}
						onClick={() => setActiveTab('chat')}
						className="text-xs"
					>
						<MessageSquare className="w-3 h-3 mr-1" />
						Chat
					</TabsTrigger>
					<TabsTrigger
						active={activeTab === 'servers'}
						onClick={() => setActiveTab('servers')}
						className="text-xs"
					>
						<Server className="w-3 h-3 mr-1" />
						{t('mcp.servers', { defaultValue: 'Servers' })} & {t('mcp.connectors', { defaultValue: 'Connectors' })} ({mcpServers.length})
					</TabsTrigger>
					<TabsTrigger
						active={activeTab === 'tools'}
						onClick={() => setActiveTab('tools')}
						className="text-xs"
					>
						<Wrench className="w-3 h-3 mr-1" />
						{t('mcp.tools')} ({allTools.length})
					</TabsTrigger>
					<TabsTrigger
						active={activeTab === 'resources'}
						onClick={() => setActiveTab('resources')}
						className="text-xs"
					>
						<FolderOpen className="w-3 h-3 mr-1" />
						{t('mcp.resources')} ({allResources.length})
					</TabsTrigger>
				</TabsList>

				{/* Chat Tab */}
				<TabsContent active={activeTab === 'chat'} className="mt-4">
					<AiQueryBar />
				</TabsContent>

				{/* Servers & Connectors Tab */}
				<TabsContent active={activeTab === 'servers'} className="mt-4 space-y-6">
					{/* Connector Dropdown (Gallery) */}
					<div className="space-y-4">
						<div className="flex items-center gap-2">
							<Blocks className="w-4 h-4 text-primary" />
							<h3 className="text-sm font-semibold">{t('mcp.connectors', { defaultValue: 'Connectors' })}</h3>
						</div>
						<Card>
							<CardContent className="p-4 space-y-4">
								<div className="relative" ref={dropdownRef}>
									<button
										onClick={() => { setShowPresetDropdown(!showPresetDropdown); setConnectorSearchQuery('') }}
										className="w-full flex items-center justify-between px-3 py-2.5 rounded-md border bg-background text-sm hover:bg-muted transition-colors"
									>
										<span className={selectedPreset ? 'text-foreground' : 'text-muted-foreground'}>
											{selectedPreset ? (
												<span className="flex items-center gap-2">
													{selectedPreset.icon.startsWith('http') ? <img src={selectedPreset.icon} alt={selectedPreset.name} className="w-5 h-5 rounded-sm object-contain shrink-0" /> : <span className="text-lg">{selectedPreset.icon}</span>}
													{selectedPreset.name}
													<span className="text-xs text-muted-foreground">– {selectedPreset.description}</span>
												</span>
											) : (
												t('mcp.selectConnector')
											)}
										</span>
										<ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showPresetDropdown ? 'rotate-180' : ''}`} />
									</button>

									{showPresetDropdown && (
										<div className="absolute z-50 w-full mt-1 rounded-md border bg-popover shadow-lg max-h-80 flex flex-col animate-in fade-in slide-in-from-top-1">
											<div className="p-2 border-b sticky top-0 bg-popover z-10">
												<div className="relative">
													<Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
													<input
														className="w-full h-8 pl-8 pr-3 text-xs bg-background border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
														value={connectorSearchQuery}
														onChange={e => setConnectorSearchQuery(e.target.value)}
														placeholder={t('mcp.searchConnectors', { defaultValue: 'Search connectors...' })}
														autoFocus
														onClick={e => e.stopPropagation()}
													/>
												</div>
											</div>
											<div className="overflow-auto flex-1">
												{filteredPresets.length === 0 ? (
													<div className="text-center py-6 text-sm text-muted-foreground">{t('mcp.noResults', { defaultValue: 'No connectors found' })}</div>
												) : (
													filteredPresets.map(preset => {
														const connected = isConnectorConnected(preset.id)
														return (
															<button
																key={preset.id}
																onClick={() => handleSelectPreset(preset)}
																className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left border-b last:border-b-0"
															>
																{preset.icon.startsWith('http') ? <img src={preset.icon} alt={preset.name} className="w-6 h-6 rounded-sm object-contain shrink-0" /> : <span className="text-xl shrink-0">{preset.icon}</span>}
																<div className="flex-1 min-w-0">
																	<div className="font-medium">{preset.name}</div>
																	<div className="text-xs text-muted-foreground truncate">{preset.description}</div>
																</div>
																{connected ? (
																	<Badge className="bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30 text-[9px] gap-1 shrink-0">
																		<CheckCircle2 className="w-3 h-3" />
																		{t('mcp.connected')}
																	</Badge>
																) : (
																	<Badge variant="outline" className="text-[9px] shrink-0">{preset.category}</Badge>
																)}
															</button>
														)
													})
												)}
											</div>
										</div>
									)}
								</div>

								{/* Selected Connector Info + Connect Button */}
								{selectedPreset && (
									<div className="space-y-3 pt-2 border-t animate-in fade-in slide-in-from-top-2">
										<div className="flex items-center gap-2">
											{selectedPreset.icon.startsWith('http') ? <img src={selectedPreset.icon} alt={selectedPreset.name} className="w-8 h-8 rounded-sm object-contain shrink-0" /> : <span className="text-2xl">{selectedPreset.icon}</span>}
											<div>
												<h3 className="font-semibold text-sm">{selectedPreset.name}</h3>
												<p className="text-xs text-muted-foreground">{selectedPreset.description}</p>
											</div>
											{selectedPreset.mcpConfig.type === 'http' && (
												<Badge variant="outline" className="ml-auto text-[9px] text-blue-500 border-blue-500/30 bg-blue-500/10">OAuth</Badge>
											)}
										</div>

										<div className="flex items-center justify-between pt-2">
											<div className="text-[10px] text-muted-foreground">
												{selectedPreset.mcpConfig.url || selectedPreset.mcpConfig.command || ''}
											</div>
											<div className="flex gap-2">
												<Button variant="ghost" size="sm" onClick={() => setSelectedPreset(null)}>
													{t('query.close', { defaultValue: 'Cancel' })}
												</Button>
												{isConnectorConnected(selectedPreset.id) ? (
													<Button size="sm" variant="destructive" className="text-xs" onClick={() => { handleDisconnectPreset(selectedPreset.id); setSelectedPreset(null) }}>
														<PowerOff className="w-3.5 h-3.5 mr-1" />
														{t('mcp.disconnect')}
													</Button>
												) : selectedPreset.mcpConfig.url ? (
													<Button size="sm" className="text-xs" onClick={() => handleConnectPreset(selectedPreset)}>
														<ExternalLink className="w-3.5 h-3.5 mr-1" />
														{t('mcp.connectAction', { defaultValue: '連携' })}
													</Button>
												) : (
													<Badge variant="outline" className="text-xs text-muted-foreground py-1">
														{t('mcp.comingSoon', { defaultValue: '準備中' })}
													</Badge>
												)}
											</div>
										</div>
									</div>
								)}
							</CardContent>
						</Card>
					</div>

					{/* Custom Servers Section */}
					<div className="space-y-4 pt-4 border-t">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Server className="w-4 h-4 text-primary" />
								<h3 className="text-sm font-semibold">{t('mcp.servers', { defaultValue: 'Custom Servers' })}</h3>
							</div>
							{!showForm && (
								<Button size="sm" variant="outline" className="h-7 text-xs" onClick={openAddForm}>
									<Plus className="w-3 h-3 mr-1" />
									{t('mcp.addServer')}
								</Button>
							)}
						</div>

						{mcpServers.length === 0 ? (
							<Card className="border-dashed">
								<CardContent className="py-10 text-center text-muted-foreground">
									<Server className="w-8 h-8 mx-auto mb-3 opacity-20" />
									<p className="text-xs">{t('mcp.noServers')}</p>
								</CardContent>
							</Card>
						) : (
							<div className="grid gap-3">
								{mcpServers.map(server => (
									<Card key={server.id} className="group hover:border-primary/50 transition-colors">
										<CardContent className="p-4">
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-3">
													<div>
														<div className="flex items-center gap-2">
															<span className="font-medium text-sm">{server.name}</span>
															{statusBadge(serverStatuses[server.id])}
														</div>
														<div className="text-[10px] text-muted-foreground font-mono mt-0.5 max-w-[400px] truncate">
															{server.type === 'stdio'
																? `${server.command} ${(server.args || []).join(' ')}`
																: `${server.url} ${server.headers ? '(Headers)' : ''}`
															}
														</div>
													</div>
												</div>
												<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
													{serverStatuses[server.id] === 'connected' ? (
														<Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => handleDisconnect(server.id)}>
															<PowerOff className="h-4 w-4" />
														</Button>
													) : (
														<Button size="icon" variant="ghost" className="h-8 w-8 text-green-500" onClick={() => handleConnect(server)}>
															<Power className="h-4 w-4" />
														</Button>
													)}
													<Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditForm(server)}>
														<Edit className="h-3.5 w-3.5" />
													</Button>
													<Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleRemoveServer(server.id)}>
														<Trash2 className="h-3.5 w-3.5" />
													</Button>
												</div>
											</div>
										</CardContent>
									</Card>
								))}
							</div>
						)}
					</div>

					{/* Connecting Modal */}
					{connectingPreset && (
						<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 animate-in fade-in">
							<Card className="w-[400px] shadow-2xl animate-in zoom-in-95">
								<CardContent className="p-6 text-center space-y-4">
									<div className="w-14 h-14 rounded-xl bg-muted/50 flex items-center justify-center mx-auto overflow-hidden">
										{connectingPreset.icon.startsWith('http') ? (
											<img src={connectingPreset.icon} alt={connectingPreset.name} className="w-10 h-10 rounded object-contain" />
										) : (
											<span className="text-3xl">{connectingPreset.icon}</span>
										)}
									</div>
									<div>
										<h3 className="font-semibold text-lg">
											{connectingPreset.name}{t('mcp.authModalTitle', { defaultValue: 'へのアクセスを許可' })}
										</h3>
										<p className="text-sm text-muted-foreground mt-1">
											{t('mcp.authModalDesc', { defaultValue: '新しいタブでサインインを完了してください。' })}
										</p>
									</div>
									<Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
								</CardContent>
							</Card>
						</div>
					)}
				</TabsContent>

				{/* Tools Tab */}
				<TabsContent active={activeTab === 'tools'} className="space-y-4 mt-4">
					{allTools.length === 0 ? (
						<div className="text-center py-12 text-muted-foreground">
							<Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
							<p className="text-sm">{t('mcp.noTools')}</p>
						</div>
					) : (
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
							{/* Tool List */}
							<div className="space-y-2 flex flex-col h-full min-h-[300px]">
								<h3 className="text-xs font-bold uppercase text-muted-foreground">{t('mcp.tools')}</h3>
								<div className="space-y-1 flex-1 overflow-auto border rounded-md p-2 bg-muted/20">
									{allTools.map(tool => {
										const isSelected = selectedTool?.serverId === tool.serverId && selectedTool?.name === tool.name
										return (
											<button
												key={`${tool.serverId}-${tool.name}`}
												onClick={() => {
													setSelectedTool({ serverId: tool.serverId, name: tool.name })
													setToolArgs('')
													setToolResult(null)
												}}
												className={`w-full text-left p-2 rounded-md text-xs transition-colors border ${isSelected ? 'bg-primary/10 text-primary border-primary/30' : 'hover:bg-muted border-transparent'
													}`}
											>
												<div className="font-medium flex items-center justify-between">
													{tool.name}
													<span className="text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
														{mcpServers.find(s => s.id === tool.serverId)?.name}
													</span>
												</div>
												{tool.description && (
													<div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{tool.description}</div>
												)}
											</button>
										)
									})}
								</div>
							</div>

							{/* Tool Execution */}
							<div className="flex flex-col h-full">
								{selectedTool ? (
									<Card className="flex flex-col h-full">
										<CardHeader className="pb-2 shrink-0">
											<CardTitle className="text-sm flex items-center gap-2">
												<Wrench className="w-4 h-4 text-primary" />
												{selectedTool.name}
											</CardTitle>
										</CardHeader>
										<CardContent className="space-y-3 flex-1 flex flex-col min-h-0">
											<div className="grid gap-2 shrink-0">
												<label className="text-xs font-medium">
													{t('mcp.arguments')} (JSON)
												</label>
												<Textarea
													value={toolArgs}
													onChange={e => setToolArgs(e.target.value)}
													placeholder='{ "key": "value" }'
													className="w-full h-24 font-mono text-xs resize-none"
												/>
											</div>
											<Button
												size="sm"
												className="w-full shrink-0"
												onClick={handleCallTool}
												disabled={isExecuting}
											>
												{isExecuting ? (
													<Loader2 className="w-4 h-4 mr-1 animate-spin" />
												) : (
													<Play className="w-4 h-4 mr-1" />
												)}
												{t('mcp.execute')}
											</Button>
											{toolResult && (
												<div className="relative flex-1 flex flex-col min-h-0 mt-2">
													<div className="flex items-center justify-between mb-1 shrink-0">
														<span className="text-[10px] uppercase font-bold text-muted-foreground">
															{t('query.response')}
														</span>
														<Button
															variant="ghost"
															size="sm"
															className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
															onClick={handleCopyResult}
														>
															{copiedResult ? (
																<><Check className="w-3 h-3 mr-1 text-green-500" />{t('query.copied')}</>
															) : (
																<><Copy className="w-3 h-3 mr-1" />{t('query.copy')}</>
															)}
														</Button>
													</div>
													<div className="flex-1 min-h-0 bg-muted/50 border rounded-md relative overflow-hidden">
														<pre className="absolute inset-0 p-3 overflow-auto text-[10px] whitespace-pre-wrap break-all">
															{JSON.stringify(toolResult, null, 2)}
														</pre>
													</div>
												</div>
											)}
										</CardContent>
									</Card>
								) : (
									<div className="text-center py-12 text-muted-foreground text-sm flex-1 flex items-center justify-center border rounded-lg border-dashed">
										{t('mcp.selectTool')}
									</div>
								)}
							</div>
						</div>
					)}
				</TabsContent>

				{/* Resources Tab */}
				<TabsContent active={activeTab === 'resources'} className="space-y-4 mt-4">
					{allResources.length === 0 ? (
						<div className="text-center py-12 text-muted-foreground">
							<FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
							<p className="text-sm">{t('mcp.noResources')}</p>
						</div>
					) : (
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
							<div className="space-y-2 flex flex-col h-full min-h-[300px]">
								<h3 className="text-xs font-bold uppercase text-muted-foreground">{t('mcp.resources')}</h3>
								<div className="space-y-1 flex-1 overflow-auto border rounded-md p-2 bg-muted/20">
									{allResources.map(res => (
										<button
											key={`${res.serverId}-${res.uri}`}
											onClick={() => handleReadResource(res.serverId, res.uri)}
											className="w-full text-left p-2 rounded-md text-xs hover:bg-muted transition-colors border border-transparent"
										>
											<div className="font-medium font-mono text-primary">{res.uri}</div>
											<div className="text-[10px] text-foreground mt-0.5">{res.name}</div>
											{res.description && (
												<div className="text-[10px] text-muted-foreground mt-0.5">{res.description}</div>
											)}
										</button>
									))}
								</div>
							</div>
							<div className="flex flex-col h-full">
								{resourceContent ? (
									<Card className="h-full flex flex-col">
										<CardContent className="p-0 flex-1 relative min-h-[300px] overflow-hidden">
											<pre className="absolute inset-0 p-4 overflow-auto text-[10px] whitespace-pre-wrap break-all bg-muted/50">
												{JSON.stringify(resourceContent, null, 2)}
											</pre>
										</CardContent>
									</Card>
								) : (
									<div className="text-center py-12 text-muted-foreground text-sm flex-1 flex items-center justify-center border rounded-lg border-dashed">
										{t('mcp.selectResource')}
									</div>
								)}
							</div>
						</div>
					)}
				</TabsContent>
			</Tabs>

			{/* Toast Notification */}
			{toast && (
				<div className="fixed top-4 right-4 z-[9999] animate-in slide-in-from-top-2 fade-in">
					<div className={cn(
						"flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg text-sm",
						toast.type === 'success' ? "bg-popover border-green-500/30" : "bg-destructive text-destructive-foreground border-destructive/50"
					)}>
						{toast.type === 'success' ? (
							<CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
						) : (
							<AlertCircle className="w-4 h-4 shrink-0" />
						)}
						<span>{toast.message}</span>
						<button onClick={() => setToast(null)} className="ml-2 hover:opacity-70 transition-opacity">
							<X className="w-3.5 h-3.5" />
						</button>
					</div>
				</div>
			)}
		</div>
	)
}
