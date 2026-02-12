import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

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



			// Pass headers as RequestInit
			transport = new StreamableHTTPClientTransport(new URL(config.url), { requestInit: { headers } })
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

		await client.connect(transport)

		const managed = servers.get(config.id)
		if (managed) managed.status = 'connected'

		const capabilities = client.getServerCapabilities?.() || {}
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
