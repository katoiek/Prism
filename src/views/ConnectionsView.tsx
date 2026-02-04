import { useState, useEffect } from 'react'
import { Loader2, Trash2, Info, ChevronDown, ChevronUp, Package } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { parseOpenApi, type ParsedApi } from '@/lib/apiParser'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { ConnectionSettings } from '@/components/ConnectionSettings'
import { BUILT_IN_SPECS } from '@/specs'

export function ConnectionsView() {
	const { t } = useTranslation()
	const { connections, addConnection, removeConnection } = useAppStore()
	const [isImporting, setIsImporting] = useState(false)
	const [errorValue, setErrorValue] = useState<string | null>(null)

	// Form State
	const [name, setName] = useState('')
	const [importType, setImportType] = useState<'url' | 'file'>('url')
	const [url, setUrl] = useState('')
	const [filePath, setFilePath] = useState('')
	const [isAnalyzing, setIsAnalyzing] = useState(false)
	const [notionDetected, setNotionDetected] = useState(false)
	const [detectedIcon, setDetectedIcon] = useState<string | null>(null)
	const [expandedConnections, setExpandedConnections] = useState<Record<string, boolean>>({})
	const [selectedBuiltIn, setSelectedBuiltIn] = useState<string>('')
	const [isImportingBuiltIn, setIsImportingBuiltIn] = useState(false)

	const toggleExpand = (id: string) => {
		setExpandedConnections(prev => ({
			...prev,
			[id]: !prev[id]
		}))
	}

	const analyzeSource = async (source: string, type: 'url' | 'file') => {
		if (!source) return
		setIsAnalyzing(true)
		setErrorValue(null)
		try {
			const parsed: ParsedApi = await parseOpenApi(source, type)
			if (parsed.title && !name) {
				setName(parsed.title)
			}

			const titleLower = (parsed.title || '').toLowerCase()
			const contentString = JSON.stringify(parsed.raw).toLowerCase()

			// Detect SaaS patterns
			if (titleLower.includes('wrike') || contentString.includes('wrike')) {
				setDetectedIcon('https://www.google.com/s2/favicons?domain=wrike.com&sz=128')
			} else if (titleLower.includes('clickup') || contentString.includes('clickup')) {
				setDetectedIcon('https://www.google.com/s2/favicons?domain=clickup.com&sz=128')
			} else if (titleLower.includes('notion') || contentString.includes('notion')) {
				setDetectedIcon('https://www.google.com/s2/favicons?domain=notion.so&sz=128')
				setNotionDetected(true)
			} else if (titleLower.includes('box') || contentString.includes('box.com') || contentString.includes('api.box.com')) {
				setDetectedIcon('https://www.google.com/s2/favicons?domain=box.com&sz=128')
			} else if (titleLower.includes('kintone') || contentString.includes('kintone') || contentString.includes('cybozu')) {
				setDetectedIcon('https://www.google.com/s2/favicons?domain=kintone.com&sz=128')
			} else if (titleLower.includes('zoom') || contentString.includes('zoom.us') || contentString.includes('api.zoom.us')) {
				setDetectedIcon('https://www.google.com/s2/favicons?domain=zoom.com&sz=128')
			} else {
				setDetectedIcon(null)
			}

			// Detect Notion specifically for settings
			const isNotionLike = titleLower.includes('notion') || contentString.includes('notion')
			setNotionDetected(isNotionLike)
		} catch (err: any) {
			console.warn("Pre-analysis failed:", err)
		} finally {
			setIsAnalyzing(false)
		}
	}

	useEffect(() => {
		const timer = setTimeout(() => {
			if (importType === 'url' && url.startsWith('http')) {
				analyzeSource(url, 'url')
			}
		}, 1000)
		return () => clearTimeout(timer)
	}, [url, importType])



	const handleImport = async () => {
		setErrorValue(null)
		setIsImporting(true)

		try {
			const source = importType === 'url' ? url : filePath
			if (!source) throw new Error("Please provide a URL or File")
			if (!name) throw new Error("Please provide a name")

			const parsed: ParsedApi = await parseOpenApi(source, importType)

			const newConnectionId = crypto.randomUUID()

			addConnection({
				id: newConnectionId,
				name,
				type: importType,
				specUrlOrPath: source,
				specContent: parsed,
				authType: parsed.meta?.authType || 'none',
				baseUrl: parsed.meta?.baseUrl || '',
				authUrl: parsed.meta?.authUrl,
				tokenUrl: parsed.meta?.tokenUrl,
				scope: parsed.meta?.scope,
				isNotion: notionDetected,
				notionVersion: notionDetected ? '2025-09-03' : undefined,
				iconUrl: detectedIcon || undefined,
				apiVersion: parsed.version
			})

			// Auto-expand the new connection
			setExpandedConnections(prev => ({
				...prev,
				[newConnectionId]: true
			}))

			// Reset form
			setName('')
			setUrl('')
			setFilePath('')
			setNotionDetected(false)
			setDetectedIcon(null)
		} catch (err: any) {
			setErrorValue(err.message || "Import failed")
		} finally {
			setIsImporting(false)
		}
	}

	// Handle importing from built-in specs
	const handleImportBuiltIn = async (specId: string) => {
		if (!specId) return

		const spec = BUILT_IN_SPECS.find(s => s.id === specId)
		if (!spec) return

		setErrorValue(null)
		setIsImportingBuiltIn(true)
		setSelectedBuiltIn(specId)

		try {
			// Parse the built-in spec directly through main process
			const parsed: ParsedApi = await parseOpenApi(spec.fileName, 'builtin' as any)

			const newConnectionId = crypto.randomUUID()
			const isNotion = spec.id === 'notion'

			addConnection({
				id: newConnectionId,
				name: spec.title,
				type: 'file',
				specUrlOrPath: `[Built-in] ${spec.fileName}`,
				specContent: parsed,
				authType: parsed.meta?.authType || 'none',
				baseUrl: parsed.meta?.baseUrl || '',
				authUrl: parsed.meta?.authUrl,
				tokenUrl: parsed.meta?.tokenUrl,
				scope: parsed.meta?.scope,
				isNotion,
				notionVersion: isNotion ? '2025-09-03' : undefined,
				iconUrl: `https://www.google.com/s2/favicons?domain=${spec.iconDomain}&sz=128`,
				apiVersion: parsed.version
			})

			// Auto-expand the new connection
			setExpandedConnections(prev => ({
				...prev,
				[newConnectionId]: true
			}))

			setSelectedBuiltIn('')
		} catch (err: any) {
			setErrorValue(err.message || "Failed to import built-in spec")
		} finally {
			setIsImportingBuiltIn(false)
		}
	}

	return (
		<div className="h-full overflow-auto">
			<div className="p-6 space-y-8">
				<div>
					<h2 className="text-3xl font-bold tracking-tight">{t('connections.title')}</h2>
					<p className="text-muted-foreground">{t('connections.titleSubtitle', { defaultValue: 'Manage your API connections.' })}</p>
				</div>

				{/* Built-in API Selector */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Package className="w-5 h-5" />
							{t('connections.builtInApis', { defaultValue: 'Built-in APIs' })}
						</CardTitle>
						<CardDescription>{t('connections.builtInDescription', { defaultValue: 'Select from pre-configured API definitions.' })}</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex gap-4 items-end">
							<div className="flex-1 grid gap-2">
								<label className="text-sm font-medium">{t('connections.selectApi', { defaultValue: 'Select API' })}</label>
								<select
									className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
									value={selectedBuiltIn}
									onChange={e => setSelectedBuiltIn(e.target.value)}
									disabled={isImportingBuiltIn}
								>
									<option value="">{t('connections.selectPlaceholder', { defaultValue: '-- Select an API --' })}</option>
									{BUILT_IN_SPECS.map(spec => (
										<option key={spec.id} value={spec.id}>
											{spec.title} ({spec.version})
										</option>
									))}
								</select>
							</div>
							<Button
								onClick={() => handleImportBuiltIn(selectedBuiltIn)}
								disabled={!selectedBuiltIn || isImportingBuiltIn}
							>
								{isImportingBuiltIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
								{isImportingBuiltIn ? t('connections.importing', { defaultValue: 'Importing...' }) : t('connections.addBtn', { defaultValue: 'Add Connection' })}
							</Button>
						</div>
					</CardContent>
				</Card>

				{/* Import Form */}
				<Card>
					<CardHeader>
						<CardTitle>{t('connections.addNew', { defaultValue: 'Add New Connection' })}</CardTitle>
						<CardDescription>{t('connections.description', { defaultValue: 'Import an OpenAPI/Swagger definition from a URL or local file.' })}</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid gap-2">
							<label className="text-sm font-medium">{t('connections.nameLabel', { defaultValue: 'Name' })}</label>
							<Input
								placeholder={t('connections.namePlaceholder')}
								value={name}
								onChange={e => setName(e.target.value)}
							/>
							{isAnalyzing && (
								<p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
									<Loader2 className="w-3 h-3 animate-spin" /> {t('connections.analyzing')}
								</p>
							)}
							{notionDetected && (
								<div className="flex items-center gap-2 mt-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-md text-blue-500">
									<Info className="w-4 h-4" />
									<span className="text-xs font-semibold">{t('connections.notionDetected')}</span>
								</div>
							)}
						</div>

						<div className="grid gap-2">
							<label className="text-sm font-medium">{t('connections.sourceType', { defaultValue: 'Source Type' })}</label>
							<div className="flex gap-4">
								<label className="flex items-center gap-2 text-sm">
									<input
										type="radio"
										name="type"
										checked={importType === 'url'}
										onChange={() => setImportType('url')}
									/>
									{t('connections.urlType', { defaultValue: 'URL' })}
								</label>
								<label className="flex items-center gap-2 text-sm">
									<input
										type="radio"
										name="type"
										checked={importType === 'file'}
										onChange={() => setImportType('file')}
									/>
									{t('connections.fileType', { defaultValue: 'File' })}
								</label>
							</div>
						</div>

						{importType === 'url' ? (
							<div className="grid gap-2">
								<label className="text-sm font-medium">{t('connections.urlLabel', { defaultValue: 'OpenAPI URL' })}</label>
								<Input
									placeholder={t('connections.urlPlaceholder')}
									value={url}
									onChange={e => setUrl(e.target.value)}
								/>
							</div>
						) : (
							<div className="grid gap-2">
								<label className="text-sm font-medium">{t('connections.fileLabel', { defaultValue: 'Local File' })}</label>
								<div className="flex gap-2">
									<Input
										value={filePath}
										readOnly
										placeholder={t('connections.filePlaceholder', { defaultValue: 'Select a file...' })}
									/>
									<Button variant="outline" onClick={async () => {
										const path = await window.ipcRenderer.openFileDialog()
										if (path) {
											setFilePath(path)
											analyzeSource(path, 'file')
										}
									}}>
										{t('connections.browse', { defaultValue: 'Browse' })}
									</Button>
								</div>
							</div>
						)}

						{errorValue && (
							<div className="text-destructive text-sm font-medium p-2 bg-destructive/10 rounded">
								Error: {errorValue}
							</div>
						)}
					</CardContent>
					<CardFooter>
						<Button onClick={handleImport} disabled={isImporting}>
							{isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							{isImporting ? t('connections.importing', { defaultValue: 'Importing...' }) : t('connections.importBtn')}
						</Button>
					</CardFooter>
				</Card>

				{/* List */}
				<div className="grid gap-6 grid-cols-1">
					{connections.map(c => (
						<Card key={c.id} className="overflow-hidden border-2">
							<div
								className="bg-muted/30 p-4 border-b flex justify-between items-center cursor-pointer hover:bg-muted/50 transition-colors"
								onClick={() => toggleExpand(c.id)}
							>
								<div className="flex items-center gap-4">
									{expandedConnections[c.id] ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
									{c.iconUrl && (
										<img src={c.iconUrl} alt={c.name} className="w-8 h-8 rounded p-1 bg-white shadow-sm" />
									)}
									<div className="space-y-1">
										<CardTitle className="text-xl">{c.name}</CardTitle>
										<CardDescription className="font-mono text-xs">{c.specUrlOrPath}</CardDescription>
									</div>
									{c.apiVersion && (
										<div className="bg-secondary/50 text-secondary-foreground px-3 py-1 rounded-full text-sm font-medium">
											v{c.apiVersion}
										</div>
									)}
									<div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold">
										{c.specContent?.endpoints.length || 0} {t('connections.endpoints', { defaultValue: 'Endpoints' })}
									</div>
								</div>
								<Button
									variant="ghost"
									size="icon"
									className="text-muted-foreground hover:text-destructive transition-colors"
									onClick={(e) => {
										e.stopPropagation()
										removeConnection(c.id)
									}}
								>
									<Trash2 className="h-5 w-5" />
								</Button>
							</div>
							{expandedConnections[c.id] && (
								<CardContent className="p-0 border-t">
									<ConnectionSettings connection={c} />
								</CardContent>
							)}
						</Card>
					))}
				</div>
			</div>
		</div>
	)
}
