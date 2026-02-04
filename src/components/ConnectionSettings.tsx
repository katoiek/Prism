import { useState, useEffect } from 'react'
import { Save, Check, Copy } from 'lucide-react'
import { useAppStore, type Connection } from '@/store/appStore'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { ConnectButton } from '@/components/ConnectButton'

// Known OAuth configurations for auto-detection
const OAUTH_PRESETS: Record<string, { authUrl: string; tokenUrl: string; scope?: string }> = {
	wrike: {
		authUrl: 'https://login.wrike.com/oauth2/authorize/v4',
		tokenUrl: 'https://login.wrike.com/oauth2/token',
	},
}

function detectProvider(connection: Connection): string | null {
	const name = connection.name?.toLowerCase() || ''
	const baseUrl = connection.baseUrl?.toLowerCase() || ''
	const specUrl = connection.specUrlOrPath?.toLowerCase() || ''

	if (name.includes('wrike') || baseUrl.includes('wrike.com') || specUrl.includes('wrike')) {
		return 'wrike'
	}
	return null
}

export function ConnectionSettings({ connection }: { connection: Connection }) {
	const { t } = useTranslation()
	const { updateConnection } = useAppStore()
	const [baseUrl, setBaseUrl] = useState(connection.baseUrl || '')
	const [clientId, setClientId] = useState(connection.clientId || '')
	const [clientSecret, setClientSecret] = useState(connection.clientSecret || '')
	const [authUrl, setAuthUrl] = useState(connection.authUrl || '')
	const [tokenUrl, setTokenUrl] = useState(connection.tokenUrl || '')
	const [scope, setScope] = useState(connection.scope || '')
	const [apiToken, setApiToken] = useState(connection.apiToken || '')

	const [notionVersion, setNotionVersion] = useState(connection.notionVersion || '2025-09-03')
	const [copied, setCopied] = useState(false)

	// Auto-detect provider and set default OAuth URLs
	useEffect(() => {
		const provider = detectProvider(connection)
		if (provider && OAUTH_PRESETS[provider]) {
			const preset = OAUTH_PRESETS[provider]
			// Only set if current values are empty (allow manual override)
			if (!authUrl && preset.authUrl) {
				setAuthUrl(preset.authUrl)
			}
			if (!tokenUrl && preset.tokenUrl) {
				setTokenUrl(preset.tokenUrl)
			}
			if (!scope && preset.scope) {
				setScope(preset.scope)
			}
		}
	}, [connection.id]) // Re-run when connection changes

	const CALLBACK_URL = 'http://localhost:54321/callback'

	const copyToClipboard = async () => {
		try {
			await navigator.clipboard.writeText(CALLBACK_URL)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch (err) {
			console.error('Failed to copy!', err)
		}
	}

	const handleSave = () => {
		updateConnection(connection.id, {
			baseUrl,
			clientId,
			clientSecret,
			authUrl,
			tokenUrl,
			scope,
			apiToken,
			notionVersion,
			authType: 'oauth2'
		})
	}

	return (
		<div className="p-6 space-y-6">
			<div>
				<h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">{t('connSettings.authTitle')}</h3>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{connection.isNotion && (
						<div className="flex items-center gap-2 col-span-full mb-2">
							<label htmlFor="notionVersion" className="text-sm font-medium whitespace-nowrap">{t('connSettings.notionVersion')}</label>
							<Input
								id="notionVersion"
								value={notionVersion}
								onChange={e => setNotionVersion(e.target.value)}
								placeholder="2025-09-03"
								className="h-8 w-32"
							/>
						</div>
					)}

					<div className="grid gap-2">
						<label className="text-sm font-medium">{t('connSettings.baseUrl')}</label>
						<input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" />
					</div>

					<div className="grid gap-2 col-span-full border-b pb-4 mb-2">
						<label className="text-sm font-medium">{t('connSettings.apiToken')}</label>
						<Input type="password" value={apiToken} onChange={e => setApiToken(e.target.value)} placeholder="Enter permanent API token (if available)" />
						<p className="text-xs text-muted-foreground">
							{t('connSettings.apiTokenNote')}
						</p>
					</div>

					<div className="grid gap-2">
						<label className="text-sm font-medium">{t('connSettings.clientId')}</label>
						<Input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="Required for OAuth2" />
					</div>

					<div className="grid gap-2">
						<label className="text-sm font-medium">{t('connSettings.clientSecret')}</label>
						<Input type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)} placeholder="Required" />
					</div>

					<div className="grid gap-2">
						<label className="text-sm font-medium">{t('connSettings.authUrl')}</label>
						<Input value={authUrl} onChange={e => setAuthUrl(e.target.value)} />
					</div>

					<div className="grid gap-2">
						<label className="text-sm font-medium">{t('connSettings.tokenUrl')}</label>
						<Input value={tokenUrl} onChange={e => setTokenUrl(e.target.value)} />
					</div>

					<div className="grid gap-2">
						<label className="text-sm font-medium">{t('connSettings.scope')}</label>
						<Input value={scope} onChange={e => setScope(e.target.value)} />
					</div>

					<div className="grid gap-2 col-span-full border-t pt-4">
						<label className="text-sm font-medium">{t('connSettings.callbackUrl')}</label>
						<div className="flex gap-2">
							<Input value={CALLBACK_URL} readOnly className="bg-muted font-mono" />
							<Button variant="outline" size="icon" onClick={copyToClipboard} title="Copy to clipboard">
								{copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
							</Button>
						</div>
						<p className="text-xs text-muted-foreground">
							{t('connSettings.callbackNote', { defaultValue: 'Register this URL as Redirect URI in your SaaS settings.' })}
						</p>
					</div>
				</div>
			</div>

			<div className="flex items-center justify-between pt-4 border-t">
				<Button onClick={handleSave}>
					<Save className="w-4 h-4 mr-2" />
					{t('connSettings.save')}
				</Button>
				<ConnectButton connection={connection} />
			</div>
		</div>
	)
}
