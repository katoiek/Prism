import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js'
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import type { OAuthClientMetadata, OAuthClientInformationMixed, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js'
import http from 'http'
import { URL } from 'url'

export interface McpServerConfig {
	id: string
	name: string
	type: 'stdio' | 'http'
	// stdio
	command?: string
	args?: string[]
	env?: Record<string, string>
	// http
	url?: string
	headers?: Record<string, string>
}

export type McpServerStatus = 'connected' | 'disconnected' | 'connecting' | 'error'

interface ManagedServer {
	client: Client
	transport: StdioClientTransport | StreamableHTTPClientTransport
	config: McpServerConfig
	status: McpServerStatus
}

// Callback to open URLs in the user's browser (injected from main.ts)
let openExternalUrl: (url: string) => void = () => { }

export function setOpenExternalUrl(fn: (url: string) => void) {
	openExternalUrl = fn
}

// ---- MCP OAuth Provider for Electron ----

const CALLBACK_PORT = 54321
const CALLBACK_URL = `http://localhost:${CALLBACK_PORT}/callback`

/**
 * OAuthClientProvider implementation for Electron desktop app.
 * Handles dynamic client registration, PKCE, and token storage in memory.
 * Opens the user's browser for authorization and listens for the callback.
 */
class ElectronOAuthProvider implements OAuthClientProvider {
	private _clientInformation?: OAuthClientInformationMixed
	private _tokens?: OAuthTokens
	private _codeVerifier?: string

	get redirectUrl(): string | URL {
		return CALLBACK_URL
	}

	get clientMetadata(): OAuthClientMetadata {
		return {
			client_name: 'Prism MCP Client',
			redirect_uris: [CALLBACK_URL] as any,
			grant_types: ['authorization_code', 'refresh_token'],
			response_types: ['code'],
			token_endpoint_auth_method: 'client_secret_post'
		}
	}

	clientInformation(): OAuthClientInformationMixed | undefined {
		return this._clientInformation
	}

	saveClientInformation(clientInformation: OAuthClientInformationMixed): void {
		this._clientInformation = clientInformation
	}

	tokens(): OAuthTokens | undefined {
		return this._tokens
	}

	saveTokens(tokens: OAuthTokens): void {
		this._tokens = tokens
	}

	redirectToAuthorization(authorizationUrl: URL): void {
		console.log(`[MCP OAuth] Opening browser for authorization: ${authorizationUrl.toString()}`)
		openExternalUrl(authorizationUrl.toString())
	}

	saveCodeVerifier(codeVerifier: string): void {
		this._codeVerifier = codeVerifier
	}

	codeVerifier(): string {
		return this._codeVerifier || ''
	}
}

// ---- OAuth callback server ----

let activeCallbackServer: http.Server | null = null

/**
 * Starts a temporary HTTP server to receive the OAuth callback.
 * Returns a promise that resolves with the authorization code.
 */
function waitForOAuthCallback(): Promise<string> {
	return new Promise((resolve, reject) => {
		// Close any existing server
		if (activeCallbackServer) {
			activeCallbackServer.close()
			activeCallbackServer = null
		}

		const server = http.createServer((req, res) => {
			if (req.url === '/favicon.ico') {
				res.writeHead(404)
				res.end()
				return
			}

			const parsedUrl = new URL(req.url || '', `http://localhost:${CALLBACK_PORT}`)
			const code = parsedUrl.searchParams.get('code')
			const error = parsedUrl.searchParams.get('error')

			if (code) {
				console.log(`[MCP OAuth] Authorization code received`)
				res.writeHead(200, { 'Content-Type': 'text/html' })
				res.end(`
					<html>
					<body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8f9fa;">
						<div style="text-align: center;">
							<h1 style="color: #22c55e;">✓ Authentication Successful</h1>
							<p style="color: #6b7280;">You can close this window and return to Prism.</p>
						</div>
					</body>
					</html>
				`)
				resolve(code)
				setTimeout(() => {
					server.close()
					if (activeCallbackServer === server) activeCallbackServer = null
				}, 2000)
			} else if (error) {
				res.writeHead(400, { 'Content-Type': 'text/html' })
				res.end(`
					<html>
					<body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8f9fa;">
						<div style="text-align: center;">
							<h1 style="color: #ef4444;">✗ Authentication Failed</h1>
							<p style="color: #6b7280;">${error}</p>
						</div>
					</body>
					</html>
				`)
				reject(new Error(`OAuth authorization failed: ${error}`))
				server.close()
				if (activeCallbackServer === server) activeCallbackServer = null
			} else {
				res.writeHead(400)
				res.end('Bad request')
			}
		})

		server.listen(CALLBACK_PORT, () => {
			console.log(`[MCP OAuth] Callback server started on port ${CALLBACK_PORT}`)
		})

		activeCallbackServer = server

		// Timeout after 5 minutes
		setTimeout(() => {
			if (activeCallbackServer === server) {
				server.close()
				activeCallbackServer = null
				reject(new Error('OAuth callback timeout (5 minutes)'))
			}
		}, 5 * 60 * 1000)
	})
}

// ---- Server Management ----

const servers = new Map<string, ManagedServer>()

export async function connectServer(config: McpServerConfig): Promise<{ success: boolean; capabilities?: any; error?: string }> {
	// Disconnect if already connected
	if (servers.has(config.id)) {
		await disconnectServer(config.id)
	}

	try {
		const client = new Client({
			name: 'prism-mcp-client',
			version: '1.0.0'
		})

		let transport: StdioClientTransport | StreamableHTTPClientTransport

		// Shared Environment setup for substitution
		const rawEnv = { ...process.env, ...(config.env || {}) }
		const env: Record<string, string> = {}
		for (const key in rawEnv) {
			const val = rawEnv[key]
			if (val !== undefined) {
				env[key] = val
			}
		}

		if (config.type === 'stdio') {
			if (!config.command) throw new Error('Command is required for stdio transport')

			const args = (config.args || []).map(arg => {
				return arg.replace(/\$\{([^}]+)\}/g, (_, key) => env[key] || '')
			})

			transport = new StdioClientTransport({
				command: config.command,
				args: args,
				env: env
			})
		} else {
			if (!config.url) throw new Error('URL is required for HTTP transport')

			const headers: Record<string, string> = {}
			if (config.headers) {
				for (const key in config.headers) {
					headers[key] = config.headers[key].replace(/\$\{([^}]+)\}/g, (_, k) => env[k] || '')
				}
			}

			// Create OAuth provider for HTTP connections
			const authProvider = new ElectronOAuthProvider()

			// Pass headers as RequestInit + authProvider for OAuth support
			transport = new StreamableHTTPClientTransport(new URL(config.url), {
				requestInit: { headers },
				authProvider
			})
		}

		let heartbeatErrorLogged = false

		transport.onerror = (error) => {
			// ZodError from heartbeat/non-RPC messages should not change server status
			// (Wrike sends heartbeat events that fail JSON-RPC validation - this is expected)
			const isZodError = error?.constructor?.name === 'ZodError' || (error as any)?.name === 'ZodError'
			if (isZodError) {
				if (!heartbeatErrorLogged) {
					console.warn(`[MCP] Non-fatal transport error for ${config.name} (heartbeat): suppressing further identical warnings`)
					heartbeatErrorLogged = true
				}
			} else {
				console.error(`[MCP] Transport error for ${config.name}:`, error)
				const managed = servers.get(config.id)
				if (managed) managed.status = 'error'
			}
		}

		transport.onclose = () => {
			console.log(`[MCP] Transport closed for ${config.name}`)
			const managed = servers.get(config.id)
			if (managed) managed.status = 'disconnected'
		}

		servers.set(config.id, { client, transport, config, status: 'connecting' })

		let currentClient = client
		let currentTransport = transport

		try {
			await currentClient.connect(currentTransport)
		} catch (error) {
			if (error instanceof UnauthorizedError && currentTransport instanceof StreamableHTTPClientTransport) {
				// OAuth flow: wait for callback, then finish auth and reconnect
				console.log(`[MCP] OAuth required for ${config.name} - waiting for authorization...`)
				const authCode = await waitForOAuthCallback()
				console.log(`[MCP] Authorization code received for ${config.name}, finishing auth...`)
				await currentTransport.finishAuth(authCode)

				// IMPORTANT: Recreate instances for authenticated retry to avoid "already started" error
				console.log(`[MCP] Recreating transport and client for authenticated retry...`)
				currentClient = new Client({
					name: 'prism-mcp-client',
					version: '1.0.0'
				})
				// authProvider and headers are still the same, we reuse the authProvider which now has tokens
				const authProvider = (currentTransport as any)._authProvider
				const headers = (currentTransport as any)._requestInit?.headers || {}

				currentTransport = new StreamableHTTPClientTransport(new URL(config.url!), {
					requestInit: { headers },
					authProvider
				})

				// Set up event handlers again for the new transport
				currentTransport.onclose = transport.onclose
				currentTransport.onerror = transport.onerror

				// Update the server map with new instances
				servers.set(config.id, {
					client: currentClient,
					transport: currentTransport,
					config,
					status: 'connecting'
				})

				// Reconnect with authenticated transport
				console.log(`[MCP] Reconnecting ${config.name} with authenticated transport...`)
				await currentClient.connect(currentTransport)
			} else {
				throw error
			}
		}

		const managed = servers.get(config.id)
		if (managed) {
			managed.status = 'connected'
			// Make sure the managed object has the final used client/transport
			managed.client = currentClient
			managed.transport = currentTransport
		}

		const capabilities = currentClient.getServerCapabilities?.() || {}
		console.log(`[MCP] Connected to ${config.name}`, capabilities)

		return { success: true, capabilities }
	} catch (err: any) {
		console.error(`[MCP] Failed to connect to ${config.name}:`, err)
		servers.delete(config.id)
		return { success: false, error: err.message }
	}
}

export async function disconnectServer(id: string): Promise<void> {
	const managed = servers.get(id)
	if (!managed) return

	try {
		await managed.transport.close()
	} catch (err) {
		console.error(`[MCP] Error closing transport for ${managed.config.name}:`, err)
	}
	servers.delete(id)
}

export async function listTools(id: string) {
	const managed = getServer(id)
	const result = await managed.client.listTools()
	return result.tools
}

export async function callTool(id: string, name: string, args?: Record<string, unknown>) {
	const managed = getServer(id)
	const result = await managed.client.callTool({ name, arguments: args })
	return result
}

export async function listResources(id: string) {
	const managed = getServer(id)
	const result = await managed.client.listResources()
	return result.resources
}

export async function readResource(id: string, uri: string) {
	const managed = getServer(id)
	const result = await managed.client.readResource({ uri })
	return result
}

export async function listPrompts(id: string) {
	const managed = getServer(id)
	const result = await managed.client.listPrompts()
	return result.prompts
}

export async function getPrompt(id: string, name: string, args?: Record<string, string>) {
	const managed = getServer(id)
	const result = await managed.client.getPrompt({ name, arguments: args })
	return result
}

export function getServerStatus(id: string): McpServerStatus {
	const managed = servers.get(id)
	return managed?.status || 'disconnected'
}

export async function disconnectAll(): Promise<void> {
	const ids = Array.from(servers.keys())
	await Promise.all(ids.map(id => disconnectServer(id)))
}

export function listConnectedServerIds(): string[] {
	return Array.from(servers.entries())
		.filter(([_, s]) => s.status === 'connected')
		.map(([id]) => id)
}

export async function listAllTools(): Promise<Array<{ serverId: string; serverName: string; tool: any }>> {
	const connectedIds = listConnectedServerIds()
	const results: Array<{ serverId: string; serverName: string; tool: any }> = []

	for (const id of connectedIds) {
		try {
			const managed = servers.get(id)
			if (!managed) continue
			const result = await managed.client.listTools()
			for (const tool of result.tools) {
				results.push({ serverId: id, serverName: managed.config.name, tool })
			}
		} catch {
			// Server may not support tools, skip
		}
	}

	return results
}

function getServer(id: string): ManagedServer {
	const managed = servers.get(id)
	if (!managed) throw new Error(`MCP server not found: ${id}`)
	if (managed.status !== 'connected') throw new Error(`MCP server not connected: ${managed.config.name}`)
	return managed
}
