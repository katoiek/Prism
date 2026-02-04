import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { type ApiEndpoint } from '@/lib/apiParser'
import { Play, Sparkles, Loader2, Zap } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { suggestParameterValues } from '@/lib/aiHelper'
import { useTranslation } from 'react-i18next'

interface ApiRequestFormProps {
	endpoint: ApiEndpoint
	onSubmit: (data: any) => void
	isLoading: boolean
}

export function ApiRequestForm({ endpoint, onSubmit, isLoading }: ApiRequestFormProps) {
	const { t } = useTranslation()
	const {
		openaiApiKey,
		anthropicApiKey,
		googleApiKey,
		aiProvider
	} = useAppStore()
	const [params, setParams] = useState<Record<string, string>>({})
	const [body, setBody] = useState('')
	const [aiPrompt, setAiPrompt] = useState('')
	const [isAiLoading, setIsAiLoading] = useState(false)
	const [showAiInput, setShowAiInput] = useState(false)

	// Categorize parameters (cast to any for easier access to 'in', 'name', etc.)
	const pathParams = (endpoint.parameters as any[])?.filter(p => p.in === 'path') || []
	const queryParams = (endpoint.parameters as any[])?.filter(p => p.in === 'query') || []
	const headerParams = (endpoint.parameters as any[])?.filter(p => p.in === 'header') || []

	useEffect(() => {
		// Initialize params if needed
		const initial: Record<string, string> = {}
			; (endpoint.parameters as any[])?.forEach(p => {
				if (p.name) initial[p.name] = ''
			})
		setParams(initial)
		setBody('')
	}, [endpoint])

	const handleParamChange = (name: string, value: string) => {
		setParams(prev => ({ ...prev, [name]: value }))
	}

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		onSubmit({ params, body })
	}

	const handleAiFill = async (e: React.FormEvent) => {
		e.preventDefault()

		const apiKey = aiProvider === 'openai' ? openaiApiKey :
			aiProvider === 'anthropic' ? anthropicApiKey :
				googleApiKey

		if (!apiKey) {
			alert(`Please set your ${aiProvider.toUpperCase()} API Key in Settings first.`)
			return
		}
		if (!aiPrompt.trim()) return

		setIsAiLoading(true)
		try {
			const result = await suggestParameterValues({ provider: aiProvider, apiKey }, aiPrompt, endpoint)
			if (result) {
				if (result.params) {
					setParams(prev => ({ ...prev, ...result.params }))
				}
				if (result.body) {
					setBody(typeof result.body === 'string' ? result.body : JSON.stringify(result.body, null, 2))
				}
				setShowAiInput(false)
				setAiPrompt('')
			}
		} catch (err) {
			console.error(err)
		} finally {
			setIsAiLoading(false)
		}
	}

	return (
		<div className="space-y-4">
			<div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2 text-primary">
						<Sparkles className="w-4 h-4" />
						<span className="text-sm font-semibold">{t('query.aiAssistant')} ({aiProvider})</span>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-7 text-[10px]"
						onClick={() => setShowAiInput(!showAiInput)}
					>
						{showAiInput ? t('query.close') : t('query.openAiFill')}
					</Button>
				</div>

				{showAiInput && (
					<form onSubmit={handleAiFill} className="relative animate-in fade-in slide-in-from-top-1">
						<Input
							autoFocus
							placeholder={t('query.aiPromptPlaceholder')}
							className="h-9 text-xs bg-background pr-10"
							value={aiPrompt}
							onChange={(e) => setAiPrompt(e.target.value)}
							disabled={isAiLoading}
						/>
						<button
							type="submit"
							disabled={isAiLoading || !aiPrompt.trim()}
							className="absolute right-2 top-2 text-primary hover:text-primary/80 disabled:opacity-50"
						>
							{isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-current" />}
						</button>
					</form>
				)}
				<p className="text-[10px] text-muted-foreground flex items-center gap-1">
					<Zap className="w-3 h-3 fill-current text-primary" />
					{t('query.aiDescription')}
				</p>
			</div>

			<form onSubmit={handleSubmit} className="space-y-6">
				<Card>
					<CardHeader>
						<CardTitle className="text-sm font-medium">{t('query.params')}</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{pathParams.length > 0 && (
							<div className="space-y-2">
								<h4 className="text-xs font-bold uppercase text-muted-foreground">{t('query.pathParams')}</h4>
								{pathParams.map(p => (
									<div key={p.name} className="grid gap-1">
										<label className="text-xs font-medium">{p.name} {p.required && <span className="text-red-500">*</span>}</label>
										<Input
											value={params[p.name] || ''}
											onChange={e => handleParamChange(p.name, e.target.value)}
											placeholder={p.description || p.name}
											required={p.required}
										/>
									</div>
								))}
							</div>
						)}

						{queryParams.length > 0 && (
							<div className="space-y-2">
								<h4 className="text-xs font-bold uppercase text-muted-foreground">{t('query.queryParams')}</h4>
								{queryParams.map(p => (
									<div key={p.name} className="grid gap-1">
										<label className="text-xs font-medium">{p.name} {p.required && <span className="text-red-500">*</span>}</label>
										<Input
											value={params[p.name] || ''}
											onChange={e => handleParamChange(p.name, e.target.value)}
											placeholder={p.description || p.name}
											required={p.required}
										/>
									</div>
								))}
							</div>
						)}

						{headerParams.length > 0 && (
							<div className="space-y-2">
								<h4 className="text-xs font-bold uppercase text-muted-foreground">{t('query.headers')}</h4>
								{headerParams.map(p => (
									<div key={p.name} className="grid gap-1">
										<label className="text-xs font-medium">{p.name} {p.required && <span className="text-red-500">*</span>}</label>
										<Input
											value={params[p.name] || ''}
											onChange={e => handleParamChange(p.name, e.target.value)}
											placeholder={p.description || p.name}
											required={p.required}
										/>
									</div>
								))}
							</div>
						)}

						{pathParams.length === 0 && queryParams.length === 0 && headerParams.length === 0 && (
							<p className="text-xs text-muted-foreground italic">{t('query.noParams')}</p>
						)}
					</CardContent>
				</Card>

				{['POST', 'PUT', 'PATCH'].includes(endpoint.method) && (
					<Card>
						<CardHeader>
							<CardTitle className="text-sm font-medium">{t('query.requestBody')}</CardTitle>
						</CardHeader>
						<CardContent>
							<Textarea
								className="font-mono text-xs h-48"
								value={body}
								onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)}
								placeholder='{ "key": "value" }'
							/>
						</CardContent>
					</Card>
				)}

				<Button type="submit" className="w-full" disabled={isLoading}>
					{isLoading ? t('query.running') : (
						<>
							<Play className="w-4 h-4 mr-2" />
							{t('query.executeBtn')}
						</>
					)}
				</Button>
			</form>
		</div>
	)
}
