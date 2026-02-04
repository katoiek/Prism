import { useAppStore } from '@/store/appStore'
import { useTranslation } from 'react-i18next'

export function SettingsView() {
	const { t, i18n } = useTranslation()
	const {
		openaiApiKey, setOpenaiApiKey,
		anthropicApiKey, setAnthropicApiKey,
		googleApiKey, setGoogleApiKey,
		aiProvider, setAiProvider,
		language, setLanguage
	} = useAppStore()

	const handleLanguageChange = (lang: string) => {
		setLanguage(lang)
		i18n.changeLanguage(lang)
	}

	return (
		<div className="h-full overflow-auto">
			<div className="p-6 max-w-2xl">
				<h2 className="text-2xl font-bold mb-6">{t('settings.title')}</h2>

				<div className="space-y-8">
					{/* Language Selection */}
					<div className="space-y-4">
						<h3 className="text-lg font-semibold">{t('settings.language')}</h3>
						<select
							value={language}
							onChange={(e) => handleLanguageChange(e.target.value)}
							className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						>
							<option value="en">{t('settings.english')}</option>
							<option value="ja">{t('settings.japanese')}</option>
						</select>
					</div>

					{/* AI Provider Selection */}
					<div className="space-y-4">
						<h3 className="text-lg font-semibold">{t('settings.aiProvider')}</h3>
						<div className="flex gap-4">
							{(['openai', 'anthropic', 'google'] as const).map((p) => {
								const hasApiKey = p === 'openai' ? !!openaiApiKey :
									p === 'anthropic' ? !!anthropicApiKey :
										!!googleApiKey
								const isSelected = aiProvider === p
								const isDisabled = !hasApiKey

								return (
									<label
										key={p}
										className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${isDisabled
												? 'border-border bg-muted/20 opacity-50 cursor-not-allowed'
												: isSelected
													? 'border-primary bg-primary/5 shadow-sm cursor-pointer'
													: 'border-border bg-muted/30 hover:bg-muted/50 cursor-pointer'
											}`}
									>
										<input
											type="radio"
											className="sr-only"
											name="aiProvider"
											checked={isSelected}
											onChange={() => !isDisabled && setAiProvider(p)}
											disabled={isDisabled}
										/>
										<span className={`capitalize font-bold ${isDisabled ? 'text-muted-foreground' : ''}`}>{p}</span>
										<span className="text-[10px] text-muted-foreground">
											{p === 'openai' && 'GPT-4o mini'}
											{p === 'anthropic' && 'Claude Sonnet 4'}
											{p === 'google' && 'Gemini 2.0 Flash'}
										</span>
										{isDisabled && (
											<span className="text-[9px] text-orange-500 font-medium">
												{t('settings.apiKeyRequired', { defaultValue: 'API Key Required' })}
											</span>
										)}
									</label>
								)
							})}
						</div>
					</div>

					{/* API Keys */}
					<div className="space-y-6">
						<h3 className="text-lg font-semibold">{t('settings.apiKeys')}</h3>

						{/* OpenAI */}
						<div className="grid gap-2">
							<label htmlFor="openaiKey" className="text-sm font-medium">OpenAI API Key</label>
							<input
								id="openaiKey"
								type="password"
								className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
								placeholder="sk-..."
								value={openaiApiKey}
								onChange={(e) => setOpenaiApiKey(e.target.value)}
							/>
						</div>

						{/* Anthropic */}
						<div className="grid gap-2">
							<label htmlFor="anthropicKey" className="text-sm font-medium">Anthropic (Claude) API Key</label>
							<input
								id="anthropicKey"
								type="password"
								className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
								placeholder="sk-ant-..."
								value={anthropicApiKey}
								onChange={(e) => setAnthropicApiKey(e.target.value)}
							/>
						</div>

						{/* Google */}
						<div className="grid gap-2">
							<label htmlFor="googleKey" className="text-sm font-medium">Google (Gemini) API Key</label>
							<input
								id="googleKey"
								type="password"
								className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
								placeholder="AIza..."
								value={googleApiKey}
								onChange={(e) => setGoogleApiKey(e.target.value)}
							/>
						</div>
					</div>

					<p className="text-xs text-muted-foreground bg-muted p-4 rounded-lg">
						{t('settings.keysNote')}
					</p>
				</div>
			</div>
		</div>
	)
}
