import { LayoutDashboard, Settings, ChevronDown, ChevronRight, Globe, Search, X, Plug, Server } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useAppStore, type View } from '@/store/appStore'
import { Input } from '@/components/ui/input'
import { useTranslation } from 'react-i18next'

export function Sidebar() {
	const {
		activeView,
		setActiveView,
		connections,
		selectedConnectionId,
		selectedEndpointPath,
		selectedEndpointMethod,
		setSelectedEndpoint,
		setSelectedConnection
	} = useAppStore()
	const { t } = useTranslation()

	const [expandedConnections, setExpandedConnections] = useState<Record<string, boolean>>({})
	const [searchQuery, setSearchQuery] = useState('')

	// Auto-expand connection if it's the only one or if it contains the selected endpoint
	useEffect(() => {
		if (connections.length === 1 && searchQuery === '') {
			setExpandedConnections(prev => ({ ...prev, [connections[0].id]: true }))
		}
		if (selectedConnectionId) {
			setExpandedConnections(prev => ({ ...prev, [selectedConnectionId]: true }))
		}
	}, [connections.length, selectedConnectionId])

	// Filter connections and endpoints based on search query
	const filteredConnections = useMemo(() => {
		if (!searchQuery) return connections

		const query = searchQuery.toLowerCase()
		return connections.map(conn => {
			const filteredEndpoints = conn.specContent?.endpoints.filter(ep =>
				ep.path.toLowerCase().includes(query) ||
				ep.method.toLowerCase().includes(query) ||
				(ep.summary && ep.summary.toLowerCase().includes(query))
			) || []

			// Show connection if name matches or any endpoint matches
			const nameMatches = conn.name.toLowerCase().includes(query)
			if (nameMatches || filteredEndpoints.length > 0) {
				return { ...conn, filteredEndpoints: nameMatches ? conn.specContent?.endpoints : filteredEndpoints }
			}
			return null
		}).filter(Boolean) as any[]
	}, [connections, searchQuery])

	// Automatically expand connections when searching
	useEffect(() => {
		if (searchQuery) {
			const expanded: Record<string, boolean> = {}
			filteredConnections.forEach(c => {
				expanded[c.id] = true
			})
			setExpandedConnections(expanded)
		}
	}, [searchQuery, filteredConnections])

	const toggleConnection = (id: string) => {
		setExpandedConnections(prev => ({ ...prev, [id]: !prev[id] }))
	}

	const NavItem = ({ view, icon: Icon, label }: { view: View; icon: any; label: string }) => (
		<button
			onClick={() => setActiveView(view)}
			className={cn(
				"w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
				activeView === view
					? "bg-primary/10 text-primary"
					: "hover:bg-muted text-muted-foreground hover:text-foreground"
			)}
		>
			<Icon className="w-4 h-4" />
			{label}
		</button>
	)

	return (
		<aside className="w-full border-r bg-muted/20 flex flex-col h-full overflow-hidden">
			<div className="p-4 border-b">
				<div className="flex items-center gap-2">

					<h1 className="font-bold text-2xl tracking-tight bg-gradient-to-r from-violet-600 via-blue-500 to-cyan-400 bg-clip-text text-transparent">Prism</h1>
				</div>
			</div>

			<nav className="p-2 space-y-1">
				<NavItem view="connections" icon={Plug} label={t('sidebar.connections')} />
				<NavItem view="query" icon={LayoutDashboard} label={t('sidebar.query')} />
				<NavItem view="mcp" icon={Server} label={t('sidebar.mcp', { defaultValue: 'MCP' })} />
				<NavItem view="settings" icon={Settings} label={t('sidebar.settings')} />
			</nav>

			<div className="flex-1 overflow-auto p-2 border-t flex flex-col min-h-0">
				<div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
					<span>Endpoints</span>
					<span className="text-[10px] lowercase bg-muted px-1 rounded">{filteredConnections.reduce((acc, c) => acc + (c.filteredEndpoints?.length || 0), 0)}</span>
				</div>

				<div className="px-2 pb-2 space-y-2">
					<div className="relative group">
						<Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
						<Input
							placeholder={t('sidebar.searchEndpoints', { defaultValue: 'Search endpoints...' })}
							className="pl-8 pr-8 h-8 text-xs bg-muted/50 border-none"
							value={searchQuery}
							onChange={e => setSearchQuery(e.target.value)}
						/>
						{searchQuery && (
							<button
								onClick={() => setSearchQuery('')}
								className="absolute right-2 top-2 p-0.5 rounded-full hover:bg-muted text-muted-foreground transition-colors"
							>
								<X className="w-3 h-3" />
							</button>
						)}
					</div>
				</div>

				<div className="flex-1 overflow-auto space-y-1">
					{filteredConnections.map(conn => {
						const isExpanded = expandedConnections[conn.id]
						const endpoints = conn.filteredEndpoints || conn.specContent?.endpoints || []

						return (
							<div key={conn.id} className="space-y-1">
								<div
									className={cn(
										"w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm hover:bg-muted text-foreground transition-colors group cursor-pointer",
										selectedConnectionId === conn.id && !selectedEndpointPath && "bg-primary/10 text-primary"
									)}
									onClick={() => setSelectedConnection(conn.id)}
								>
									<span
										className="p-1 hover:bg-muted rounded transition-colors"
										onClick={(e) => {
											e.stopPropagation()
											toggleConnection(conn.id)
										}}
									>
										{isExpanded ? (
											<ChevronDown className="w-3 h-3 text-muted-foreground" />
										) : (
											<ChevronRight className="w-3 h-3 text-muted-foreground" />
										)}
									</span>
									{conn.iconUrl ? (
										<img src={conn.iconUrl} alt="" className="w-3.5 h-3.5 rounded-sm object-contain bg-white shrink-0" />
									) : (
										<Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
									)}
									<span className="truncate flex-1 text-left font-medium">{conn.name}</span>
								</div>

								{isExpanded && (
									<div className="ml-4 pl-2 border-l space-y-0.5">
										{endpoints.map((ep: any) => {
											const isSelected = selectedConnectionId === conn.id &&
												selectedEndpointPath === ep.path &&
												selectedEndpointMethod === ep.method

											return (
												<button
													key={`${ep.method}-${ep.path}`}
													onClick={() => setSelectedEndpoint(conn.id, ep.path, ep.method)}
													className={cn(
														"w-full text-left px-2 py-1 rounded text-xs transition-colors truncate block",
														isSelected
															? "bg-primary text-primary-foreground font-medium"
															: "hover:bg-muted text-muted-foreground hover:text-foreground"
													)}
													title={ep.path}
												>
													<span className={cn(
														"font-bold mr-1.5 inline-block w-14",
														ep.method === 'GET' ? 'text-green-500' :
															ep.method === 'POST' ? 'text-blue-500' :
																ep.method === 'PUT' ? 'text-yellow-500' :
																	ep.method === 'DELETE' ? 'text-red-500' : ''
													)}>
														{ep.method}
													</span>
													{ep.path}
												</button>
											)
										})}
										{endpoints.length === 0 && (
											<div className="text-[10px] text-muted-foreground italic pl-2 py-1">No matches found</div>
										)}
									</div>
								)}
							</div>
						)
					})}
					{filteredConnections.length === 0 && (
						<div className="text-center py-8 text-muted-foreground text-xs">
							No endpoints match your search.
						</div>
					)}
				</div>
			</div>
		</aside>
	)
}
