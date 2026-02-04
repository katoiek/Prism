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


	// You can expose other apts you need here.
	// ...
})
