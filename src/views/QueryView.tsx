import { useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { ApiRequestForm } from '@/components/ApiRequestForm'
import { ResponseGrid } from '@/components/ResponseGrid'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { cn } from '@/lib/utils'
import { Table, Code, ChevronDown, ChevronUp, Download } from 'lucide-react'
import { AiQueryBar } from '@/components/AiQueryBar'
import { ConnectionSettings } from '@/components/ConnectionSettings'
import { JsonResponse } from '@/components/JsonResponse'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useTranslation } from 'react-i18next'
import { flattenObject, extractDataArray } from '@/lib/jsonUtils'
import * as XLSX from 'xlsx'

export function QueryView() {
	const { t } = useTranslation()
	const { connections, selectedConnectionId, selectedEndpointPath, selectedEndpointMethod, updateConnection } = useAppStore()
	const [isLoading, setIsLoading] = useState(false)
	const [response, setResponse] = useState<any>(null)
	const [error, setError] = useState<string | null>(null)
	const [isSettingsExpanded, setIsSettingsExpanded] = useState(false)
	const [viewMode, setViewMode] = useState<'table' | 'json'>('table')

	const connection = connections.find(c => c.id === selectedConnectionId)
	const endpoint = connection?.specContent?.endpoints.find(
		ep => ep.path === selectedEndpointPath && ep.method === selectedEndpointMethod
	)

	const handleExecute = async (formData: { params: Record<string, string>, body: string }) => {
		if (!connection || !endpoint) return

		setIsLoading(true)
		setError(null)
		setResponse(null)

		try {
			// 1. Prepare URL (replace path params)
			let url = `${connection.baseUrl}${endpoint.path}`
			const queryParams: Record<string, string> = {}
			const headers: Record<string, string> = {}

			endpoint.parameters?.forEach((p: any) => {
				const value = formData.params[p.name]
				if (p.in === 'path') {
					url = url.replace(`{${p.name}}`, value || `{${p.name}}`)
				} else if (p.in === 'query' && value) {
					queryParams[p.name] = value
				} else if (p.in === 'header' && value) {
					headers[p.name] = value
				}
			})

			// 2. Add Auth Header
			const token = connection.apiToken || connection.accessToken
			if (token) {
				const isClickUp = connection.baseUrl?.includes('clickup.com') || connection.name.toLowerCase().includes('clickup')
				const hasPrefix = token.startsWith('Bearer ') || token.startsWith('pk_') || token.startsWith('access_token')

				if (isClickUp || hasPrefix) {
					// ClickUp tokens (personal start with pk_, oauth start with access_token)
					// and tokens already having a prefix should be used as-is.
					headers['Authorization'] = token
				} else {
					headers['Authorization'] = `Bearer ${token}`
				}
			}

			// 2.1 Notion Version Header
			if (connection.isNotion) {
				headers['Notion-Version'] = connection.notionVersion || '2025-09-03'
			}

			// 3. Prepare Body
			let requestBody = undefined
			if (formData.body) {
				try {
					requestBody = JSON.parse(formData.body)
				} catch (e) {
					throw new Error("Invalid JSON in request body")
				}
			}

			// 4. Call IPC
			const result = await window.ipcRenderer.apiRequest({
				method: endpoint.method.toLowerCase() as any,
				url,
				headers,
				params: queryParams,
				data: requestBody
			})

			setResponse(result)
		} catch (err: any) {
			setError(err.message || "Request failed")
		} finally {
			setIsLoading(false)
		}
	}

	if (!connection) {
		return (
			<div className="p-6 flex items-center justify-center h-full text-muted-foreground italic">
				{t('query.selectEndpointNote', { defaultValue: 'Select a connection or endpoint from the sidebar to begin.' })}
			</div>
		)
	}

	return (
		<div className="h-full overflow-hidden">
			<ResizablePanelGroup direction="horizontal" id="query-view-panels" autoSaveId="query-view-layout-v5">
				{/* Left: Form / Connection info */}
				<ResizablePanel defaultSize={50} id="query-sidebar-panel">
					<div className="h-full p-6 overflow-auto border-r space-y-6">
						{!endpoint ? (
							// Connection View
							<div className="space-y-6">
								<div className="flex items-center gap-3 border-b pb-4">
									{connection.iconUrl && (
										<img src={connection.iconUrl} alt="" className="w-12 h-12 rounded-xl p-2 bg-white shadow-sm shrink-0" />
									)}
									<div>
										<h2 className="text-3xl font-bold tracking-tight">{connection.name}</h2>
										<p className="text-muted-foreground text-sm font-mono">{connection.specUrlOrPath}</p>
									</div>
								</div>

								<div className="pt-2">
									<button
										onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
										className="flex items-center gap-2 text-lg font-bold mb-2 hover:text-primary transition-colors focus:outline-none"
									>
										{isSettingsExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
										<span>Connection Settings</span>
									</button>
									{isSettingsExpanded && (
										<div className="border rounded-xl animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
											<ConnectionSettings connection={connection} />
										</div>
									)}
								</div>

								<div className="pt-2">
									<AiQueryBar />
								</div>
							</div>
						) : (
							// Endpoint View
							<>
								<div className="border-b pb-4">
									<div className="flex items-center gap-2 mb-2">
										<Badge variant="outline" className={cn(
											"font-bold",
											endpoint.method === 'GET' ? 'text-green-500 border-green-500/20 bg-green-500/10' :
												endpoint.method === 'POST' ? 'text-blue-500 border-blue-500/20 bg-blue-500/10' :
													endpoint.method === 'PUT' ? 'text-yellow-500 border-blue-500/20 bg-yellow-500/10' :
														endpoint.method === 'DELETE' ? 'text-red-500 border-red-500/20 bg-red-500/10' : ''
										)}>
											{endpoint.method}
										</Badge>
										<code className="text-sm font-bold truncate text-muted-foreground">{endpoint.path}</code>
									</div>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-3">
											{connection.iconUrl && (
												<img src={connection.iconUrl} alt="" className="w-10 h-10 rounded-lg p-1.5 bg-white shadow-sm shrink-0" />
											)}
											<div>
												<h2 className="text-2xl font-bold tracking-tight">{endpoint.summary || "Execute API Request"}</h2>
												<p className="text-muted-foreground text-sm mt-0.5">{connection.name} API</p>
											</div>
										</div>
										{(connection.accessToken || connection.apiToken) && (
											<Button
												variant="ghost"
												size="sm"
												className="text-xs text-muted-foreground hover:text-destructive"
												onClick={() => updateConnection(connection.id, { accessToken: undefined, refreshToken: undefined, tokenExpiresAt: undefined, apiToken: undefined })}
											>
												{connection.apiToken ? 'Clear API Token' : 'Clear OAuth Token'}
											</Button>
										)}
									</div>
								</div>

								<ApiRequestForm
									endpoint={endpoint}
									onSubmit={handleExecute}
									isLoading={isLoading}
								/>
							</>
						)}
					</div>
				</ResizablePanel>

				<ResizableHandle withHandle />

				{/* Right: Response */}
				<ResizablePanel defaultSize={50} minSize={30} id="panel-response">
					<div className="bg-muted/30 overflow-hidden flex flex-col h-full border-l min-w-0">
						<div className="flex-1 overflow-hidden flex flex-col min-w-0">
							{error && (
								<div className="p-6">
									<div className="p-4 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
										<h4 className="font-bold mb-1">Error</h4>
										{error}
									</div>
								</div>
							)}
							{response ? (
								<div className="flex-1 flex flex-col overflow-hidden min-w-0">
									<Tabs className="flex-1 flex flex-col overflow-hidden min-w-0">
										<div className="px-4 pt-3 pb-2 bg-background border-b flex flex-wrap items-center justify-between gap-2">
											<TabsList className="border-b-0 p-0 h-auto gap-8 shrink-0">
												<TabsTrigger
													active={viewMode === 'table'}
													onClick={() => setViewMode('table')}
													className="text-[11px] uppercase tracking-wider font-bold py-3"
												>
													<Table className="w-3.5 h-3.5 mr-2" />
													{t('query.table', { defaultValue: 'Table' })}
												</TabsTrigger>
												<TabsTrigger
													active={viewMode === 'json'}
													onClick={() => setViewMode('json')}
													className="text-[11px] uppercase tracking-wider font-bold py-3"
												>
													<Code className="w-3.5 h-3.5 mr-2" />
													{t('query.json', { defaultValue: 'JSON' })}
												</TabsTrigger>
											</TabsList>
											<div className="flex items-center gap-3 shrink-0">
												<Button
													variant="outline"
													size="sm"
													onClick={() => {
														if (!response?.data) return
														const rawArray = extractDataArray(response.data)
														const rowData = rawArray.map((item: any) => {
															if (!item || typeof item !== 'object') return { value: item }
															return flattenObject(item)
														})
														if (rowData.length === 0) return
														const ws = XLSX.utils.json_to_sheet(rowData)
														const wb = XLSX.utils.book_new()
														XLSX.utils.book_append_sheet(wb, ws, "Data")
														XLSX.writeFile(wb, `api_export_${new Date().getTime()}.xlsx`)
													}}
													className="h-7 text-[10px]"
												>
													<Download className="w-3 h-3 mr-1" />
													{t('query.exportExcel')}
												</Button>
												<Badge variant={response.status < 400 ? 'default' : 'destructive'}>
													{response.status} {response.statusText}
												</Badge>
											</div>
										</div>
										<div className="flex-1 overflow-hidden min-w-0 w-full">
											<TabsContent active={viewMode === 'table'} className="h-full w-full flex flex-col">
												<ResponseGrid data={response.data} />
											</TabsContent>
											<TabsContent active={viewMode === 'json'} className="h-full w-full flex flex-col">
												<JsonResponse data={response.data} headers={response.headers} />
											</TabsContent>
										</div>
									</Tabs>
								</div>
							) : !isLoading && !error && (
								<div className="flex items-center justify-center h-full text-muted-foreground italic">
									{t('query.runRequestNote', { defaultValue: 'Run a request to see the response here.' })}
								</div>
							)}
							{isLoading && (
								<div className="flex items-center justify-center h-full">
									<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
								</div>
							)}
						</div>
					</div>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	)
}
