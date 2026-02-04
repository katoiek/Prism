import Store from 'electron-store'
import { safeStorage } from 'electron'

// 機密情報用のセキュアストア（暗号化）
// electron-storeは自動的に暗号化キーを生成・保存する
export const secureStore = new Store({
	name: 'prism-secure',
	// encryptionKeyオプションで暗号化を有効化
	// safeStorageが利用可能な場合は最大限のセキュリティを提供
	encryptionKey: safeStorage.isEncryptionAvailable() ? 'prism-encryption-key-v1' : undefined,
	// スキーマ定義（型安全性）
	schema: {
		connections: {
			type: 'object',
			additionalProperties: {
				type: 'object',
				properties: {
					clientSecret: { type: 'string' },
					clientId: { type: 'string' },
					accessToken: { type: 'string' },
					refreshToken: { type: 'string' },
					apiToken: { type: 'string' }
				}
			}
		},
		apiKeys: {
			type: 'object',
			properties: {
				openai: { type: 'string' },
				anthropic: { type: 'string' },
				google: { type: 'string' }
			}
		}
	}
})

// 非機密情報用の通常ストア
export const appStore = new Store({
	name: 'prism-app',
	// 非機密データは暗号化不要（パフォーマンス向上）
})

// ヘルパー関数
export function getConnectionSecrets(connectionId: string) {
	const connections = (secureStore as any).get('connections', {}) as Record<string, any>
	return connections[connectionId] || {}
}

export function setConnectionSecrets(connectionId: string, secrets: any) {
	const connections = (secureStore as any).get('connections', {}) as Record<string, any>
	connections[connectionId] = { ...connections[connectionId], ...secrets }
		; (secureStore as any).set('connections', connections)
}

export function deleteConnectionSecrets(connectionId: string) {
	const connections = (secureStore as any).get('connections', {}) as Record<string, any>
	delete connections[connectionId]
		; (secureStore as any).set('connections', connections)
}

export function getApiKeys() {
	return (secureStore as any).get('apiKeys', {}) as Record<string, string>
}

export function setApiKey(provider: 'openai' | 'anthropic' | 'google', key: string) {
	const apiKeys = getApiKeys()
	apiKeys[provider] = key
		; (secureStore as any).set('apiKeys', apiKeys)
}
