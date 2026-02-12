import { contextBridge, ipcRenderer } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
	on(...args: Parameters<typeof ipcRenderer.on>) {
		const [channel, listener] = args
		return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
	},
	off(...args: Parameters<typeof ipcRenderer.off>) {
		const [channel, ...omit] = args
		return ipcRenderer.off(channel, ...omit)
	},
	send(...args: Parameters<typeof ipcRenderer.send>) {
		const [channel, ...omit] = args
		return ipcRenderer.send(channel, ...omit)
	},
	invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
		const [channel, ...omit] = args
		return ipcRenderer.invoke(channel, ...omit)
	},

	readFile: (path: string) => ipcRenderer.invoke('read-file', path),
	readBuiltinSpec: (fileName: string) => ipcRenderer.invoke('read-builtin-spec', fileName),
	fetchUrl: (url: string) => ipcRenderer.invoke('fetch-url', url),
	parseOpenApi: (source: string, type: 'url' | 'file') => ipcRenderer.invoke('parse-openapi', source, type),
	openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
	startOAuth2: (config: any) => ipcRenderer.invoke('start-oauth2', config),
	refreshToken: (config: any) => ipcRenderer.invoke('refresh-token', config),
	apiRequest: (config: any) => ipcRenderer.invoke('api-request', config),

	// Secure Storage
	getConnectionSecrets: (connectionId: string) => ipcRenderer.invoke('get-connection-secrets', connectionId),
	setConnectionSecrets: (connectionId: string, secrets: any) => ipcRenderer.invoke('set-connection-secrets', connectionId, secrets),
	deleteConnectionSecrets: (connectionId: string) => ipcRenderer.invoke('delete-connection-secrets', connectionId),
	getApiKeys: () => ipcRenderer.invoke('get-api-keys'),
	setApiKey: (provider: string, key: string) => ipcRenderer.invoke('set-api-key', provider, key),


	// MCP Server Client
	mcpConnect: (config: any) => ipcRenderer.invoke('mcp:connect', config),
	mcpDisconnect: (serverId: string) => ipcRenderer.invoke('mcp:disconnect', serverId),
	mcpListTools: (serverId: string) => ipcRenderer.invoke('mcp:list-tools', serverId),
	mcpCallTool: (serverId: string, name: string, args?: any) => ipcRenderer.invoke('mcp:call-tool', serverId, name, args),
	mcpListResources: (serverId: string) => ipcRenderer.invoke('mcp:list-resources', serverId),
	mcpReadResource: (serverId: string, uri: string) => ipcRenderer.invoke('mcp:read-resource', serverId, uri),
	mcpListPrompts: (serverId: string) => ipcRenderer.invoke('mcp:list-prompts', serverId),
	mcpGetPrompt: (serverId: string, name: string, args?: any) => ipcRenderer.invoke('mcp:get-prompt', serverId, name, args),
	mcpGetStatus: (serverId: string) => ipcRenderer.invoke('mcp:get-status', serverId),
	mcpListAllTools: () => ipcRenderer.invoke('mcp:list-all-tools'),

	// You can expose other apts you need here.
	// ...
})
