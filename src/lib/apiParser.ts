import type { OpenAPI } from 'openapi-types'

export interface ApiEndpoint {
	method: string
	path: string
	summary?: string
	operationId?: string
	parameters?: OpenAPI.Parameter[]
	requestBody?: any
}

export interface ParsedApi {
	title: string
	version: string
	endpoints: ApiEndpoint[]
	raw: any
	meta?: {
		baseUrl?: string
		authType?: 'none' | 'oauth2'
		authUrl?: string
		tokenUrl?: string
		scope?: string
	}
}

export async function parseOpenApi(source: string, type: 'url' | 'file'): Promise<ParsedApi> {
	try {
		// Call Main process to do the heavy lifting (Node.js env)
		const api = await window.ipcRenderer.parseOpenApi(source, type)

		// Extract basic info
		const title = api.info?.title || 'Untitled'
		const version = api.info?.version || '1.0.0'

		// Extract Base URL
		let baseUrl = ''
		if (api.servers && api.servers.length > 0) {
			baseUrl = api.servers[0].url
		} else if (api.host) {
			const scheme = (api.schemes && api.schemes.length > 0) ? api.schemes[0] : 'https'
			baseUrl = `${scheme}://${api.host}${api.basePath || ''}`
		}

		// Extract Auth details (OAuth2)
		let authType: 'none' | 'oauth2' = 'none'
		let authUrl = ''
		let tokenUrl = ''
		const allScopes = new Set<string>()

		const securitySchemes = api.components?.securitySchemes || api.securityDefinitions
		if (securitySchemes) {
			Object.values(securitySchemes).forEach((scheme: any) => {
				if (scheme.type === 'oauth2') {
					authType = 'oauth2'
					// OpenAPI 3
					if (scheme.flows) {
						const flow = scheme.flows.authorizationCode || scheme.flows.implicit || scheme.flows.password || scheme.flows.clientCredentials
						if (flow) {
							authUrl = flow.authorizationUrl || ''
							tokenUrl = flow.tokenUrl || ''
							if (flow.scopes) {
								Object.keys(flow.scopes).forEach(s => allScopes.add(s))
							}
						}
					}
					// Swagger 2
					else {
						authUrl = scheme.authorizationUrl || ''
						tokenUrl = scheme.tokenUrl || ''
						if (scheme.scopes) {
							Object.keys(scheme.scopes).forEach(s => allScopes.add(s))
						}
					}
				}
			})
		}

		const scope = Array.from(allScopes).join(' ')

		const endpoints: ApiEndpoint[] = []

		if (api.paths) {
			Object.entries(api.paths).forEach(([path, pathItem]: [string, any]) => {
				['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].forEach(method => {
					if (pathItem[method]) {
						const op = pathItem[method]
						endpoints.push({
							method: method.toUpperCase(),
							path,
							summary: op.summary || op.description || '',
							operationId: op.operationId,
							parameters: [
								...(pathItem.parameters || []),
								...(op.parameters || [])
							],
							requestBody: op.requestBody
						})
					}
				})
			})
		}

		return {
			title,
			version,
			endpoints,
			raw: api,
			meta: {
				baseUrl,
				authType,
				authUrl,
				tokenUrl,
				scope
			}
		}
	} catch (err: any) {
		console.error("Parse error:", err)
		throw new Error(err.message || "Failed to parse OpenAPI")
	}
}
