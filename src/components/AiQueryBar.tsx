import { useState } from 'react'
import { Sparkles, Loader2, Search, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/store/appStore'
import { askAiForExplanation } from '@/lib/aiHelper'
import { useTranslation } from 'react-i18next'

export function AiQueryBar() {
	const {
		connections,
		openaiApiKey,
		anthropicApiKey,
		googleApiKey,
		aiProvider,
		language
	} = useAppStore()
	const { t } = useTranslation()

	const [prompt, setPrompt] = useState('')
	const [explanation, setExplanation] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(false)

	const handleAiQuery = async (e: React.FormEvent) => {
		e.preventDefault()
		const apiKey = aiProvider === 'openai' ? openaiApiKey :
			aiProvider === 'anthropic' ? anthropicApiKey :
				googleApiKey

		if (!apiKey) {
			alert(`Please set your ${aiProvider.toUpperCase()} API Key in Settings first.`)
			return
		}
		if (!prompt.trim()) return

		setIsLoading(true)
		setExplanation(null)

		try {
			const config = { provider: aiProvider, apiKey }
			const response = await askAiForExplanation(config, prompt, connections, language)

			if (response) {
				setExplanation(response)
			} else {
				setExplanation("Failed to get explanation.")
			}
		} catch (err) {
			console.error("AI Assistant failed:", err)
			setExplanation("An error occurred.")
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-4 shadow-sm">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 text-primary">
					<Sparkles className="w-5 h-5 fill-primary/20" />
					<div className="flex flex-col">
						<span className="text-sm font-bold">{t('query.orchestratorTitle')} Assistant</span>
						<span className="text-[10px] text-muted-foreground uppercase tracking-tight">
							{t('query.orchestratorSubtitle', { provider: aiProvider })}
						</span>
					</div>
				</div>
			</div>

			<form onSubmit={handleAiQuery} className="group relative">
				<Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
				<Input
					placeholder="Ask how to use the APIs... (e.g. 'How do I create a new task in Wrike?')"
					className="pl-10 pr-24 h-10 text-sm bg-background/50 border-primary/10 focus:border-primary/40 focus:ring-primary/20"
					value={prompt}
					onChange={(e) => setPrompt(e.target.value)}
					disabled={isLoading}
				/>
				<div className="absolute right-1 top-1 bottom-1 flex gap-1">
					<Button
						type="submit"
						size="sm"
						className="h-full px-3 text-xs gap-1"
						disabled={isLoading || !prompt.trim()}
					>
						{isLoading ? (
							<Loader2 className="w-3 h-3 animate-spin" />
						) : (
							<>
								<Sparkles className="w-3 h-3 fill-current" />
								<span>Ask Assistant</span>
							</>
						)}
					</Button>
				</div>
			</form>

			{explanation && (
				<div className="bg-background/80 border border-primary/10 rounded-lg p-3 text-sm animate-in fade-in slide-in-from-top-2 duration-300">
					<div className="flex items-start gap-2">
						<Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
						<div className="whitespace-pre-wrap leading-relaxed text-foreground">
							{explanation}
						</div>
					</div>
					<div className="mt-3 pt-2 border-t flex justify-end">
						<Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setExplanation(null)}>
							Clear
						</Button>
					</div>
				</div>
			)}

			<p className="text-[11px] text-muted-foreground px-1">
				Ask anything about the available API endpoints and their usage.
			</p>
		</div>
	)
}
