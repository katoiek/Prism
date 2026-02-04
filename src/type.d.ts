export interface IpcRenderer {
	on: (channel: string, listener: (event: any, ...args: any[]) => void) => any
	off: (channel: string, listener: (...args: any[]) => void) => any
	send: (channel: string, ...args: any[]) => any
	invoke: (channel: string, ...args: any[]) => Promise<any>
	readFile: (path: string) => Promise<string>
	fetchUrl: (url: string) => Promise<string>
	parseOpenApi: (source: string, type: 'url' | 'file') => Promise<any>
	openFileDialog: () => Promise<string | null>
	startOAuth2: (config: any) => Promise<any>
	refreshToken: (config: any) => Promise<any>
	apiRequest: (config: any) => Promise<any>
}

declare global {
	interface Window {
		ipcRenderer: IpcRenderer
	}
}
