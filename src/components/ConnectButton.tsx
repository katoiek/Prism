import { useState } from 'react'
import { Link2, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAppStore, type Connection } from '@/store/appStore'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'

export function ConnectButton({ connection }: { connection: Connection }) {
	const { t } = useTranslation()
	const { updateConnection } = useAppStore()
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const isConnected = !!connection.accessToken

	const handleConnect = async () => {
		if (isLoading || isConnected) return
		if (!connection.authUrl || !connection.tokenUrl || !connection.clientId || !connection.clientSecret) {
			setError(t('query.oauthMissing'))
			return
		}

		setIsLoading(true)
		setError(null)

		// Detect Freee for extra params
		const isFreee = connection.name?.toLowerCase().includes('freee') ||
			connection.baseUrl?.toLowerCase().includes('freee.co.jp') ||
			connection.specUrlOrPath?.toLowerCase().includes('freee')

		try {
			const tokenData = await window.ipcRenderer.startOAuth2({
				authUrl: connection.authUrl,
				tokenUrl: connection.tokenUrl,
				clientId: connection.clientId,
				clientSecret: connection.clientSecret,
				scope: connection.scope,
				isNotion: connection.isNotion,
				extraParams: isFreee ? 'prompt=select_company' : undefined
			})

			// Build update object
			const updateData: Partial<Connection> = {
				accessToken: tokenData.access_token,
				refreshToken: tokenData.refresh_token,
				// Calculate expiry if provided (usually, 'expires_in' seconds)
				tokenExpiresAt: tokenData.expires_in ? Date.now() + (tokenData.expires_in * 1000) : undefined
			}

			// For Freee: save company_id from token response
			if (tokenData.company_id) {
				updateData.companyId = String(tokenData.company_id)
			}

			updateConnection(connection.id, updateData)
		} catch (err: any) {
			setError(err.message || t('query.oauthFailed'))
		} finally {
			setIsLoading(false)
		}
	}

	if (connection.authType !== 'oauth2') return null

	return (
		<div className="flex flex-col items-end gap-1">
			<div className="flex items-center gap-2">
				<Button
					onClick={handleConnect}
					disabled={isLoading || isConnected}
					variant={isConnected ? "outline" : "default"}
					className={isConnected ? "border-green-500 text-green-600 hover:text-green-700 h-9" : "h-9"}
				>
					{isConnected ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}
					{isLoading ? t('query.connecting') : isConnected ? t('query.connected') : t('query.connectBtn')}
				</Button>
				{isConnected && (
					<Button
						variant="ghost"
						size="sm"
						className="text-muted-foreground text-xs h-9 hover:text-destructive hover:bg-destructive/10"
						onClick={() => updateConnection(connection.id, { accessToken: undefined, refreshToken: undefined })}
					>
						{t('query.disconnect')}
					</Button>
				)}
			</div>
			{error && <p className="text-[10px] text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {error}</p>}
		</div>
	)
}
