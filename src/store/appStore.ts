import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type ParsedApi } from '@/lib/apiParser'

export type View = 'connections' | 'query' | 'settings'

export interface Connection {
	id: string
	name: string
	specUrlOrPath: string
	type: 'url' | 'file'
	specContent?: ParsedApi // Cache parsed spec
	// Auth details
	baseUrl?: string
	authType: 'none' | 'oauth2'
	clientId?: string
	clientSecret?: string
	authUrl?: string
	tokenUrl?: string
	scope?: string

	// Tokens
	accessToken?: string
	refreshToken?: string
	tokenExpiresAt?: number
	apiToken?: string // Permanent token
	isNotion?: boolean
	notionVersion?: string
	iconUrl?: string
	apiVersion?: string // Parsed from OpenAPI spec info.version
}

interface AppState {
	activeView: View
	setActiveView: (view: View) => void
	connections: Connection[]
	addConnection: (conn: Connection) => void
	updateConnection: (id: string, updates: Partial<Connection>) => void
	removeConnection: (id: string) => void

	// LLM Settings
	openaiApiKey?: string
	setOpenaiApiKey: (key: string) => void
	anthropicApiKey?: string
	setAnthropicApiKey: (key: string) => void
	googleApiKey?: string
	setGoogleApiKey: (key: string) => void
	aiProvider: 'openai' | 'anthropic' | 'google'
	setAiProvider: (provider: 'openai' | 'anthropic' | 'google') => void
	language: string
	setLanguage: (lang: string) => void

	// Token Management
	refreshToken: (connectionId: string) => Promise<void>

	// Query Selection
	selectedConnectionId?: string
	selectedEndpointPath?: string
	selectedEndpointMethod?: string
	setSelectedEndpoint: (connectionId: string, path: string, method: string) => void
	setSelectedConnection: (connectionId: string) => void
}

export const useAppStore = create<AppState>()(
	persist(
		(set) => ({
			activeView: 'connections',
			setActiveView: (view) => set({ activeView: view }),
			connections: [],
			addConnection: (conn) => set((state) => ({
				connections: [...state.connections, {
					...conn,
					authType: conn.authType || 'none',
					baseUrl: conn.baseUrl || ''
				}]
			})),
			updateConnection: (id, updates) => {
				// Sync sensitive fields to secure storage if they are present in updates
				const { clientSecret, clientId, accessToken, refreshToken, apiToken } = updates
				const secrets: any = {}
				if (clientSecret !== undefined) secrets.clientSecret = clientSecret
				if (clientId !== undefined) secrets.clientId = clientId
				if (accessToken !== undefined) secrets.accessToken = accessToken
				if (refreshToken !== undefined) secrets.refreshToken = refreshToken
				if (apiToken !== undefined) secrets.apiToken = apiToken

				if (Object.keys(secrets).length > 0) {
					console.log(`[Store] Syncing secrets for connection ${id} to secure storage...`)
						; (window.ipcRenderer as any).setConnectionSecrets(id, secrets)
				}

				set((state) => ({
					connections: state.connections.map(c => c.id === id ? { ...c, ...updates } : c)
				}))
			},
			removeConnection: (id) => {
				console.log(`[Store] Deleting secrets for connection ${id} from secure storage...`)
					; (window.ipcRenderer as any).deleteConnectionSecrets(id)
				set((state) => ({ connections: state.connections.filter((c) => c.id !== id) }))
			},
			openaiApiKey: '',
			setOpenaiApiKey: (key) => {
				console.log('[Store] Syncing OpenAI API key to secure storage...')
					; (window.ipcRenderer as any).setApiKey('openai', key)
				set({ openaiApiKey: key })
			},
			anthropicApiKey: '',
			setAnthropicApiKey: (key) => {
				console.log('[Store] Syncing Anthropic API key to secure storage...')
					; (window.ipcRenderer as any).setApiKey('anthropic', key)
				set({ anthropicApiKey: key })
			},
			googleApiKey: '',
			setGoogleApiKey: (key) => {
				console.log('[Store] Syncing Google API key to secure storage...')
					; (window.ipcRenderer as any).setApiKey('google', key)
				set({ googleApiKey: key })
			},
			aiProvider: 'openai',
			setAiProvider: (provider) => set({ aiProvider: provider }),
			language: 'en',
			setLanguage: (lang) => set({ language: lang }),
			refreshToken: async (id) => {
				const state = useAppStore.getState()
				const conn = state.connections.find(c => c.id === id)
				if (!conn || !conn.refreshToken || !conn.tokenUrl || !conn.clientId || !conn.clientSecret) return

				try {
					const tokenData = await window.ipcRenderer.refreshToken({
						tokenUrl: conn.tokenUrl,
						clientId: conn.clientId,
						clientSecret: conn.clientSecret,
						refreshToken: conn.refreshToken
					})

					state.updateConnection(id, {
						accessToken: tokenData.access_token,
						refreshToken: tokenData.refresh_token || conn.refreshToken, // Some providers don't return new refresh token
						tokenExpiresAt: tokenData.expires_in ? Date.now() + (tokenData.expires_in * 1000) : undefined
					})
				} catch (err) {
					console.error("Token refresh failed:", err)
					// Maybe clear tokens if refresh fails permanently
					state.updateConnection(id, { accessToken: undefined, refreshToken: undefined })
				}
			},
			setSelectedEndpoint: (connectionId, path, method) => set({
				selectedConnectionId: connectionId,
				selectedEndpointPath: path,
				selectedEndpointMethod: method,
				activeView: 'query' // Auto switch to query view when an endpoint is selected
			}),
			setSelectedConnection: (connectionId) => set({
				selectedConnectionId: connectionId,
				selectedEndpointPath: undefined,
				selectedEndpointMethod: undefined,
				activeView: 'query'
			}),
		}),
		{
			name: 'prism-storage',
			// Don't persist sensitive fields in localStorage
			partialize: (state) => {
				const {
					connections,
					openaiApiKey,
					anthropicApiKey,
					googleApiKey,
					...rest
				} = state
				return {
					...rest,
					connections: connections.map(({
						clientSecret,
						clientId,
						accessToken,
						refreshToken,
						apiToken,
						...c
					}) => c)
				}
			},
			onRehydrateStorage: () => (state) => {
				if (!state) return

				// Migration and secrets loading logic
				const migrateAndLoad = async () => {
					console.log('[Store] Checking for migration and loading secrets...')

					// 1. Migrate and Load Connection Secrets
					const newConnections = [...state.connections]
					let hasChanges = false

					for (let i = 0; i < newConnections.length; i++) {
						const conn = newConnections[i]

						// Migration: Move secrets out of state (localStorage) to secure store
						if (conn.clientSecret || conn.clientId || conn.accessToken || conn.refreshToken || conn.apiToken) {
							console.log(`[Store] Migrating secrets for connection: ${conn.name}`)
							await (window.ipcRenderer as any).setConnectionSecrets(conn.id, {
								clientSecret: conn.clientSecret,
								clientId: conn.clientId,
								accessToken: conn.accessToken,
								refreshToken: conn.refreshToken,
								apiToken: conn.apiToken
							})
							// Remove from state object so they don't get persisted back to localStorage
							newConnections[i] = {
								...conn,
								clientSecret: undefined,
								clientId: undefined,
								accessToken: undefined,
								refreshToken: undefined,
								apiToken: undefined
							}
							hasChanges = true
						}

						// Loading: Fetch secrets from secure store into memory state
						const secrets = await (window.ipcRenderer as any).getConnectionSecrets(conn.id)
						if (secrets && Object.keys(secrets).length > 0) {
							console.log(`[Store] Loaded secure secrets for: ${conn.name}`, {
								hasAccessToken: !!secrets.accessToken,
								hasApiToken: !!secrets.apiToken,
								hasClientSecret: !!secrets.clientSecret,
								hasClientId: !!secrets.clientId
							})
							newConnections[i] = {
								...newConnections[i],
								...secrets
							}
							hasChanges = true
						} else {
							console.log(`[Store] No secure secrets found for: ${conn.name}`)
						}
					}

					// 2. Migrate and Load API Keys
					let apiKeys: any = {}
					let keysLoaded = false

					if (state.openaiApiKey || state.anthropicApiKey || state.googleApiKey) {
						console.log('[Store] Migrating API keys...')
						if (state.openaiApiKey) await (window.ipcRenderer as any).setApiKey('openai', state.openaiApiKey)
						if (state.anthropicApiKey) await (window.ipcRenderer as any).setApiKey('anthropic', state.anthropicApiKey)
						if (state.googleApiKey) await (window.ipcRenderer as any).setApiKey('google', state.googleApiKey)

						apiKeys = {
							openaiApiKey: undefined,
							anthropicApiKey: undefined,
							googleApiKey: undefined
						}
						keysLoaded = true
					}

					// Load API Keys from secure store
					const secureApiKeys = await (window.ipcRenderer as any).getApiKeys()
					if (Object.keys(secureApiKeys).length > 0) {
						console.log('[Store] Loaded secure API keys.')
						apiKeys = {
							...apiKeys,
							openaiApiKey: secureApiKeys.openai,
							anthropicApiKey: secureApiKeys.anthropic,
							googleApiKey: secureApiKeys.google
						}
						keysLoaded = true
					}

					if (hasChanges || keysLoaded) {
						useAppStore.setState({
							connections: newConnections,
							...apiKeys
						})
					}

					console.log('[Store] Initialization complete.')
				}

				migrateAndLoad()
			}
		}
	)
)
