import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'

import SwaggerParser from '@apidevtools/swagger-parser'
import yaml from 'js-yaml'
import axios from 'axios'
import https from 'https'
import { getConnectionSecrets, setConnectionSecrets, deleteConnectionSecrets, getApiKeys, setApiKey } from './secureStore'

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

// Set app name for macOS dock
app.name = 'Prism'

let win: BrowserWindow | null

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

// Connection Secrets管理
ipcMain.handle('get-connection-secrets', async (_, connectionId: string) => {
	return getConnectionSecrets(connectionId)
})

ipcMain.handle('set-connection-secrets', async (_, connectionId: string, secrets: any) => {
	setConnectionSecrets(connectionId, secrets)
})

ipcMain.handle('delete-connection-secrets', async (_, connectionId: string) => {
	deleteConnectionSecrets(connectionId)
})

// API Keys管理
ipcMain.handle('get-api-keys', async () => {
	return getApiKeys()
})

ipcMain.handle('set-api-key', async (_, provider: 'openai' | 'anthropic' | 'google', key: string) => {
	setApiKey(provider, key)
})

ipcMain.handle('read-file', async (_event, filePath) => {
	try {
		return await fs.promises.readFile(filePath, 'utf-8')
	} catch (err: any) {
		throw new Error(`Failed to read file: ${err.message}`)
	}
})

// Read built-in spec file
ipcMain.handle('read-builtin-spec', async (_event, fileName: string) => {
	try {
		// In development, specs are in src/specs
		// In production, they're bundled in the app resources
		let specsDir: string
		if (app.isPackaged) {
			specsDir = path.join(process.resourcesPath, 'specs')
		} else {
			specsDir = path.join(__dirname, '../src/specs')
		}

		const filePath = path.join(specsDir, fileName)
		if (!fs.existsSync(filePath)) {
			throw new Error(`Built-in spec not found: ${fileName}`)
		}
		return await fs.promises.readFile(filePath, 'utf-8')
	} catch (err: any) {
		throw new Error(`Failed to read built-in spec: ${err.message}`)
	}
})

ipcMain.handle('parse-openapi', async (_event, source, type) => {
	try {
		let api: any;
		let filePath = source;

		// Handle built-in specs
		if (type === 'builtin') {
			let specsDir: string
			if (app.isPackaged) {
				specsDir = path.join(process.resourcesPath, 'specs')
			} else {
				specsDir = path.join(__dirname, '../src/specs')
			}
			filePath = path.join(specsDir, source)
		}

		// Validate file existence if local or built-in
		if (type === 'file' || type === 'builtin') {
			if (!fs.existsSync(filePath)) {
				throw new Error(`File not found: ${filePath}`)
			}
		}

		// SwaggerParser.dereference handles both File paths and URLs
		// It also handles JSON and YAML automatically.
		api = await SwaggerParser.dereference(filePath)

		return api
	} catch (err: any) {
		throw new Error(`Failed to parse OpenAPI: ${err.message}`)
	}
})

ipcMain.handle('fetch-url', async (_event, url) => {
	try {
		const response = await fetch(url)
		if (!response.ok) {
			throw new Error(`HTTP Error: ${response.status} ${response.statusText}`)
		}
		const text = await response.text()
		return text
	} catch (err: any) {
		throw new Error(`Failed to fetch URL: ${err.message}`)
	}
})

ipcMain.handle('open-file-dialog', async () => {
	const result = await dialog.showOpenDialog(win!, {
		properties: ['openFile'],
		filters: [{ name: 'OpenAPI Definitions', extensions: ['json', 'yaml', 'yml'] }]
	})

	if (result.canceled || result.filePaths.length === 0) {
		return null
	}
	return result.filePaths[0]
})

import express from 'express'
import { shell } from 'electron'
import type { Server } from 'http'

// OAuth2 Handler
let activeOAuthServer: Server | null = null;

ipcMain.handle('start-oauth2', async (__, config: {
	authUrl: string,
	tokenUrl: string,
	clientId: string,
	clientSecret: string,
	scope: string,
	isNotion?: boolean,
	extraParams?: string
}) => {
	return new Promise((resolve, reject) => {
		const app = express()
		let server: Server;
		const PORT = 54321; // Hardcoded convenient port for now. Make sure redirect URI matches this.
		const redirectUri = `http://localhost:${PORT}/callback`;

		// Close any existing server before starting a new one
		if (activeOAuthServer) {
			console.log("[OAuth2] Closing existing active server.");
			activeOAuthServer.close();
			activeOAuthServer = null;
		}

		let isExchanging = false;
		app.get('/callback', async (req, res) => {
			const code = req.query.code as string;

			if (code) {
				if (isExchanging) {
					console.log("[OAuth2] Callback already processing, ignoring duplicate request.");
					return;
				}
				isExchanging = true;
				res.send("Authentication successful! You can close this window now.")

				// Exchange code for token
				try {
					let tokenData;
					const headers: any = { 'Content-Type': 'application/x-www-form-urlencoded' };
					let body: any;

					if (config.isNotion) {
						// Notion specific token exchange
						const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
						headers['Authorization'] = `Basic ${basicAuth}`;
						headers['Content-Type'] = 'application/json';
						body = {
							grant_type: 'authorization_code',
							code: code,
							redirect_uri: redirectUri
						};
					} else {
						// Generic OAuth2
						body = new URLSearchParams({
							grant_type: 'authorization_code',
							client_id: config.clientId,
							client_secret: config.clientSecret,
							redirect_uri: redirectUri,
							code: code
						}).toString();
					}

					const client = axios.create();
					const response = await client({
						method: 'POST',
						url: config.tokenUrl,
						headers,
						data: body,
						httpsAgent: new https.Agent({
							rejectUnauthorized: false
						}),
						timeout: 10000
					});

					tokenData = response.data;

					if (tokenData.error) {
						console.error('[OAuth2] Token response has error:', tokenData);
						reject(new Error(tokenData.error_description || tokenData.error))
					} else {
						resolve(tokenData)
					}
				} catch (err: any) {
					const errorMsg = err.response?.data?.error_description || err.response?.data?.message || err.message;
					reject(new Error("Failed to exchange token: " + errorMsg))
				} finally {
					server.close()
					if (activeOAuthServer === server) activeOAuthServer = null;
				}
			} else {
				res.send("Authentication failed: No code received.")
				reject(new Error("No code received"))
				server.close()
				if (activeOAuthServer === server) activeOAuthServer = null;
			}
		});

		server = app.listen(PORT, () => {
			activeOAuthServer = server;

			// Construct Auth URL
			// Assuming standard OAuth2 query params
			const params = new URLSearchParams({
				response_type: 'code',
				client_id: config.clientId,
				redirect_uri: redirectUri,
				scope: config.scope || ''
			})

			// Append extra params if provided (e.g., prompt=select_company for Freee)
			let fullAuthUrl = `${config.authUrl}?${params.toString()}`
			if (config.extraParams) {
				fullAuthUrl += `&${config.extraParams}`
			}
			shell.openExternal(fullAuthUrl)
		})

		// Timeout 2 mins
		setTimeout(() => {
			if (server && server.listening) {
				server.close()
				reject(new Error("OAuth2 timed out"))
			}
		}, 120000)
	})
})

ipcMain.handle('refresh-token', async (_event, config: {
	tokenUrl: string,
	clientId: string,
	clientSecret: string,
	refreshToken: string
}) => {
	try {
		const response = await fetch(config.tokenUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'refresh_token',
				client_id: config.clientId,
				client_secret: config.clientSecret,
				refresh_token: config.refreshToken
			})
		})

		const data = await response.json()
		if (data.error) {
			throw new Error(data.error_description || data.error)
		}
		return data
	} catch (err: any) {
		throw new Error(`Failed to refresh token: ${err.message}`)
	}
})

ipcMain.handle('api-request', async (_event, config: {
	method: string,
	url: string,
	headers?: Record<string, string>,
	params?: Record<string, string>,
	data?: any
}) => {
	try {
		const client = axios.create();
		const response = await client({
			method: config.method,
			url: config.url,
			headers: config.headers,
			params: config.params,
			data: config.data,
			validateStatus: () => true, // Don't throw on 4xx/5xx
			httpsAgent: new https.Agent({
				rejectUnauthorized: false
			}),
			timeout: 30000 // 30s for API requests
		})

		return {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
			data: response.data
		}
	} catch (err: any) {
		throw new Error(`API Request failed: ${err.message}`)
	}
})

function createWindow() {
	win = new BrowserWindow({
		width: 1200,
		height: 800,
		icon: path.join(process.env.VITE_PUBLIC || '', 'icon.png'),
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			nodeIntegration: false,
			contextIsolation: true,
		},
	})

	// Test active push message to Console when script loads
	win.webContents.on('did-finish-load', () => {
		win?.webContents.send('main-process-message', (new Date).toLocaleString())
	})

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL)
	} else {
		// win.loadFile('dist/index.html')
		win.loadFile(path.join(process.env.DIST || '', 'index.html'))
	}
}

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit()
	}
})

app.on('activate', () => {
	if (BrowserWindow.getAllWindows().length === 0) {
		if (process.platform === 'darwin' && app.dock) {
			const iconPath = path.join(process.env.VITE_PUBLIC || '', 'icon.png')
			if (fs.existsSync(iconPath)) {
				app.dock.setIcon(iconPath)
			}
		}
		createWindow()
	}
})

app.whenReady().then(() => {
	if (process.platform === 'darwin' && app.dock) {
		const iconPath = path.join(process.env.VITE_PUBLIC || '', 'icon.png')
		if (fs.existsSync(iconPath)) {
			app.dock.setIcon(iconPath)
		}
	}
	createWindow()
})
