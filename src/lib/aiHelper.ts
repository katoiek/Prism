import axios from 'axios'
import { type Connection } from '@/store/appStore'
import { type ApiEndpoint } from './apiParser'

export type AiProvider = 'openai' | 'anthropic' | 'google'

interface AiHelperConfig {
	provider: AiProvider
	apiKey: string
}

// ---- Chat message types for multi-turn conversation ----

export interface ChatMessage {
	role: 'user' | 'assistant' | 'system' | 'tool'
	content: string
	// For assistant messages with tool calls
	toolCalls?: ToolCall[]
	// For tool result messages
	toolCallId?: string
	toolName?: string
}

export interface ToolCall {
	id: string
	name: string
	arguments: Record<string, unknown>
	// Filled after execution
	result?: any
	serverId?: string
}

export interface McpToolInfo {
	serverId: string
	serverName: string
	tool: {
		name: string
		description?: string
		inputSchema?: any
	}
}

// ---- Convert MCP tools to provider-specific formats ----

function convertToOpenAITools(mcpTools: McpToolInfo[]) {
	return mcpTools.map(t => ({
		type: 'function' as const,
		function: {
			name: `${t.serverName}__${t.tool.name}`,
			description: t.tool.description || t.tool.name,
			parameters: t.tool.inputSchema || { type: 'object', properties: {} }
		}
	}))
}

function convertToAnthropicTools(mcpTools: McpToolInfo[]) {
	return mcpTools.map(t => ({
		name: `${t.serverName}__${t.tool.name}`,
		description: t.tool.description || t.tool.name,
		input_schema: t.tool.inputSchema || { type: 'object', properties: {} }
	}))
}

function convertToGeminiTools(mcpTools: McpToolInfo[]) {
	return [{
		functionDeclarations: mcpTools.map(t => {
			// Gemini doesn't support additionalProperties in schema
			const schema = { ...(t.tool.inputSchema || { type: 'object', properties: {} }) }
			delete schema.additionalProperties
			delete schema.$schema
			return {
				name: `${t.serverName}__${t.tool.name}`,
				description: t.tool.description || t.tool.name,
				parameters: schema
			}
		})
	}]
}

// Resolve prefixed tool name back to serverId + toolName
function resolveToolName(prefixedName: string, mcpTools: McpToolInfo[]): { serverId: string; toolName: string } | null {
	for (const t of mcpTools) {
		const prefix = `${t.serverName}__${t.tool.name}`
		if (prefix === prefixedName) {
			return { serverId: t.serverId, toolName: t.tool.name }
		}
	}
	return null
}

// ---- Multi-turn chat with Function Calling ----

export interface ChatWithToolsResult {
	messages: ChatMessage[]
	// Final text response
	response: string
}

export async function chatWithTools(
	config: AiHelperConfig,
	messages: ChatMessage[],
	mcpTools: McpToolInfo[],
	language: string = 'en',
	onToolCall?: (toolName: string, args: Record<string, unknown>) => void,
	onToolResult?: (toolName: string, result: any) => void
): Promise<ChatWithToolsResult> {
	const { provider, apiKey } = config
	if (!apiKey) return { messages, response: 'API key is not set.' }

	const langName = language === 'ja' ? 'Japanese' : 'English'
	const systemMessage = `You are a helpful assistant that can use tools to fetch and manipulate data from connected services. When the user asks about their data, use the available tools to get real information. Always respond in ${langName}. If a tool call fails, explain the error and suggest what the user can do.`

	const MAX_TOOL_ROUNDS = 5
	let currentMessages = [...messages]
	let round = 0

	while (round < MAX_TOOL_ROUNDS) {
		round++

		let result: { content: string; toolCalls: ToolCall[] } | null = null

		try {
			if (provider === 'openai') {
				result = await callOpenAIWithTools(apiKey, systemMessage, currentMessages, mcpTools)
			} else if (provider === 'anthropic') {
				result = await callAnthropicWithTools(apiKey, systemMessage, currentMessages, mcpTools)
			} else if (provider === 'google') {
				result = await callGeminiWithTools(apiKey, systemMessage, currentMessages, mcpTools)
			}
		} catch (error: any) {
			console.error(`AI Request failed (${provider}):`, error)
			return {
				messages: currentMessages,
				response: `AI request failed: ${error.message}`
			}
		}

		if (!result) {
			return { messages: currentMessages, response: 'Failed to get response from AI.' }
		}

		// If no tool calls, return the text response
		if (!result.toolCalls || result.toolCalls.length === 0) {
			const assistantMsg: ChatMessage = { role: 'assistant', content: result.content }
			currentMessages.push(assistantMsg)
			return { messages: currentMessages, response: result.content }
		}

		// Add assistant message with tool calls
		const assistantMsg: ChatMessage = {
			role: 'assistant',
			content: result.content || '',
			toolCalls: result.toolCalls
		}
		currentMessages.push(assistantMsg)

		// Execute each tool call via MCP
		for (const tc of result.toolCalls) {
			const resolved = resolveToolName(tc.name, mcpTools)
			if (!resolved) {
				const toolResultMsg: ChatMessage = {
					role: 'tool',
					content: JSON.stringify({ error: `Unknown tool: ${tc.name}` }),
					toolCallId: tc.id,
					toolName: tc.name
				}
				currentMessages.push(toolResultMsg)
				continue
			}

			tc.serverId = resolved.serverId
			onToolCall?.(resolved.toolName, tc.arguments)

			try {
				const toolResult = await window.ipcRenderer.mcpCallTool(
					resolved.serverId,
					resolved.toolName,
					tc.arguments || {}
				)
				tc.result = toolResult

				const toolResultMsg: ChatMessage = {
					role: 'tool',
					content: JSON.stringify(toolResult),
					toolCallId: tc.id,
					toolName: tc.name
				}
				currentMessages.push(toolResultMsg)
				onToolResult?.(resolved.toolName, toolResult)
			} catch (err: any) {
				const errorResult = { error: err.message }
				tc.result = errorResult

				const toolResultMsg: ChatMessage = {
					role: 'tool',
					content: JSON.stringify(errorResult),
					toolCallId: tc.id,
					toolName: tc.name
				}
				currentMessages.push(toolResultMsg)
				onToolResult?.(resolved.toolName, errorResult)
			}
		}
		// Loop to send tool results back to AI
	}

	return {
		messages: currentMessages,
		response: 'Maximum tool call rounds reached.'
	}
}

// ---- Provider-specific implementations ----

async function callOpenAIWithTools(
	apiKey: string,
	systemPrompt: string,
	messages: ChatMessage[],
	mcpTools: McpToolInfo[]
): Promise<{ content: string; toolCalls: ToolCall[] }> {
	const openAIMessages = [
		{ role: 'system', content: systemPrompt },
		...messages.map(m => {
			if (m.role === 'assistant' && m.toolCalls?.length) {
				return {
					role: 'assistant' as const,
					content: m.content || null,
					tool_calls: m.toolCalls.map(tc => ({
						id: tc.id,
						type: 'function' as const,
						function: { name: tc.name, arguments: JSON.stringify(tc.arguments) }
					}))
				}
			}
			if (m.role === 'tool') {
				return {
					role: 'tool' as const,
					content: m.content,
					tool_call_id: m.toolCallId
				}
			}
			return { role: m.role, content: m.content }
		})
	]

	const tools = convertToOpenAITools(mcpTools)

	const response = await axios.post(
		'https://api.openai.com/v1/chat/completions',
		{
			model: 'gpt-4o-mini',
			messages: openAIMessages,
			...(tools.length > 0 ? { tools } : {})
		},
		{
			headers: {
				'Authorization': `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			}
		}
	)

	const choice = response.data.choices[0]
	const content = choice.message.content || ''
	const toolCalls: ToolCall[] = (choice.message.tool_calls || []).map((tc: any) => ({
		id: tc.id,
		name: tc.function.name,
		arguments: JSON.parse(tc.function.arguments || '{}')
	}))

	return { content, toolCalls }
}

async function callAnthropicWithTools(
	apiKey: string,
	systemPrompt: string,
	messages: ChatMessage[],
	mcpTools: McpToolInfo[]
): Promise<{ content: string; toolCalls: ToolCall[] }> {
	// Convert messages to Anthropic format
	const anthropicMessages: any[] = []

	for (const m of messages) {
		if (m.role === 'user') {
			anthropicMessages.push({ role: 'user', content: m.content })
		} else if (m.role === 'assistant') {
			const content: any[] = []
			if (m.content) content.push({ type: 'text', text: m.content })
			if (m.toolCalls?.length) {
				for (const tc of m.toolCalls) {
					content.push({
						type: 'tool_use',
						id: tc.id,
						name: tc.name,
						input: tc.arguments
					})
				}
			}
			anthropicMessages.push({ role: 'assistant', content })
		} else if (m.role === 'tool') {
			// Anthropic tool results go inside a user message
			const lastMsg = anthropicMessages[anthropicMessages.length - 1]
			const toolResultBlock = {
				type: 'tool_result',
				tool_use_id: m.toolCallId,
				content: m.content
			}
			if (lastMsg?.role === 'user' && Array.isArray(lastMsg.content)) {
				lastMsg.content.push(toolResultBlock)
			} else {
				anthropicMessages.push({ role: 'user', content: [toolResultBlock] })
			}
		}
	}

	const tools = convertToAnthropicTools(mcpTools)

	const response = await axios.post(
		'https://api.anthropic.com/v1/messages',
		{
			model: 'claude-sonnet-4-20250514',
			max_tokens: 4096,
			system: systemPrompt,
			messages: anthropicMessages,
			...(tools.length > 0 ? { tools } : {})
		},
		{
			headers: {
				'x-api-key': apiKey,
				'anthropic-version': '2023-06-01',
				'Content-Type': 'application/json',
				'anthropic-dangerous-direct-browser-access': 'true'
			}
		}
	)

	let content = ''
	const toolCalls: ToolCall[] = []

	for (const block of response.data.content) {
		if (block.type === 'text') {
			content += block.text
		} else if (block.type === 'tool_use') {
			toolCalls.push({
				id: block.id,
				name: block.name,
				arguments: block.input || {}
			})
		}
	}

	return { content, toolCalls }
}

async function callGeminiWithTools(
	apiKey: string,
	systemPrompt: string,
	messages: ChatMessage[],
	mcpTools: McpToolInfo[]
): Promise<{ content: string; toolCalls: ToolCall[] }> {
	// Convert messages to Gemini format
	const geminiContents: any[] = []

	for (const m of messages) {
		if (m.role === 'user') {
			geminiContents.push({ role: 'user', parts: [{ text: m.content }] })
		} else if (m.role === 'assistant') {
			const parts: any[] = []
			if (m.content) parts.push({ text: m.content })
			if (m.toolCalls?.length) {
				for (const tc of m.toolCalls) {
					parts.push({
						functionCall: { name: tc.name, args: tc.arguments }
					})
				}
			}
			geminiContents.push({ role: 'model', parts })
		} else if (m.role === 'tool') {
			geminiContents.push({
				role: 'user',
				parts: [{
					functionResponse: {
						name: m.toolName,
						response: JSON.parse(m.content)
					}
				}]
			})
		}
	}

	const tools = convertToGeminiTools(mcpTools)

	const response = await axios.post(
		`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
		{
			systemInstruction: { parts: [{ text: systemPrompt }] },
			contents: geminiContents,
			...(mcpTools.length > 0 ? { tools } : {})
		}
	)

	const candidate = response.data.candidates[0]
	let content = ''
	const toolCalls: ToolCall[] = []

	for (const part of candidate.content.parts) {
		if (part.text) {
			content += part.text
		} else if (part.functionCall) {
			toolCalls.push({
				id: `gemini_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
				name: part.functionCall.name,
				arguments: part.functionCall.args || {}
			})
		}
	}

	return { content, toolCalls }
}


// ---- Legacy single-shot functions (kept for backward compatibility) ----

async function callAi(
	config: AiHelperConfig,
	systemPrompt: string,
	userPrompt: string,
	jsonMode: boolean = true
): Promise<string | null> {
	const { provider, apiKey } = config
	if (!apiKey) return null

	try {
		if (provider === 'openai') {
			const response = await axios.post(
				'https://api.openai.com/v1/chat/completions',
				{
					model: 'gpt-4o-mini',
					messages: [
						{ role: 'system', content: systemPrompt },
						{ role: 'user', content: userPrompt }
					],
					...(jsonMode ? { response_format: { type: 'json_object' } } : {})
				},
				{
					headers: {
						'Authorization': `Bearer ${apiKey}`,
						'Content-Type': 'application/json'
					}
				}
			)
			return response.data.choices[0].message.content
		} else if (provider === 'anthropic') {
			// Anthropic doesn't have a strict 'json_object' mode like OpenAI,
			// so we reinforce it in the system prompt.
			const response = await axios.post(
				'https://api.anthropic.com/v1/messages',
				{
					model: 'claude-sonnet-4-20250514',
					max_tokens: 1024,
					system: systemPrompt + (jsonMode ? " Respond ONLY with a valid JSON object." : ""),
					messages: [
						{ role: 'user', content: userPrompt }
					]
				},
				{
					headers: {
						'x-api-key': apiKey,
						'anthropic-version': '2023-06-01',
						'Content-Type': 'application/json',
						'anthropic-dangerous-direct-browser-access': 'true'
					}
				}
			)
			return response.data.content[0].text
		} else if (provider === 'google') {
			// Google Gemini
			const response = await axios.post(
				`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
				{
					contents: [{
						parts: [{ text: `${systemPrompt}\n\nUser Question: ${userPrompt}` }]
					}],
					generationConfig: jsonMode ? {
						responseMimeType: "application/json"
					} : {}
				}
			)
			return response.data.candidates[0].content.parts[0].text
		}
	} catch (error) {
		console.error(`AI Request failed (${provider}):`, error)
	}

	return null
}

export async function askAiToFindEndpoint(
	config: AiHelperConfig,
	userPrompt: string,
	connections: Connection[]
): Promise<{ connectionId: string; path: string; method: string } | null> {
	if (!config.apiKey || !userPrompt) return null

	const endpointsData = connections.flatMap(c =>
		c.specContent?.endpoints.map(ep => ({
			connectionId: c.id,
			connectionName: c.name,
			path: ep.path,
			method: ep.method,
			summary: ep.summary
		})) || []
	)

	if (endpointsData.length === 0) return null

	const systemPrompt = 'You identify the correct API endpoint from a list based on user natural language queries. Response must be valid JSON or null.'
	const prompt = `
A user wants to do the following: "${userPrompt}"
Based on the available API endpoints below, identify the BEST matching endpoint.

Endpoints:
${endpointsData.map((e, i) => `${i}: [${e.connectionName}] ${e.method} ${e.path} - ${e.summary || ''}`).join('\n')}

Return ONLY a JSON object with the following fields:
{
  "index": number,
  "reason": "short explanation"
}
If no endpoint matches, return null.
`

	const content = await callAi(config, systemPrompt, prompt)
	if (!content || content.toLowerCase() === 'null') return null

	try {
		const result = JSON.parse(content)
		if (result.index !== undefined && endpointsData[result.index]) {
			const match = endpointsData[result.index]
			return {
				connectionId: match.connectionId,
				path: match.path,
				method: match.method
			}
		}
	} catch (e) {
		console.error('Failed to parse AI response:', content)
	}

	return null
}

export async function suggestParameterValues(
	config: AiHelperConfig,
	userPrompt: string,
	endpoint: ApiEndpoint
): Promise<{ params: Record<string, string>; body: string } | null> {
	if (!config.apiKey || !userPrompt || !endpoint) return null

	const systemPrompt = 'You suggest API parameter values based on user intent. Response must be valid JSON matching the requested structure.'
	const prompt = `
A user wants to execute the following API request:
${endpoint.method} ${endpoint.path}
Summary: ${endpoint.summary || ''}

User's Intent/Context: "${userPrompt}"

Based on the intent and the API definition, suggest realistic values for the parameters and request body.

Parameters:
${endpoint.parameters?.map((p: any) => `- ${p.name || 'Unknown'} (${p.in || 'Unknown'}): ${p.description || ''}`).join('\n') || 'None'}

Request Body Schema:
${endpoint.requestBody ? JSON.stringify(endpoint.requestBody, null, 2) : 'None'}

Return ONLY a JSON object with the following fields:
{
  "params": { "paramName": "value", ... },
  "body": "JSON string"
}
If a parameter is not relevant, omit it. If there is no body, return an empty string for "body".
`

	const content = await callAi(config, systemPrompt, prompt)
	if (!content) return null

	try {
		return JSON.parse(content)
	} catch (e) {
		console.error('Failed to parse AI suggestion:', content)
	}

	return null
}

export async function askAiForExplanation(
	config: AiHelperConfig,
	userPrompt: string,
	connections: Connection[],
	language: string = 'en',
	selectedEndpoint?: { path: string, method: string, summary?: string }
): Promise<string | null> {
	if (!config.apiKey || !userPrompt) return null

	const langName = language === 'ja' ? 'Japanese' : 'English'
	const systemPrompt = `You are a helpful API assistant. Explain how to use the APIs based on user questions. Provide clear, step-by-step instructions and examples. You MUST respond in ${langName}.`

	let context = ''
	if (selectedEndpoint) {
		context = `Current focused endpoint: ${selectedEndpoint.method} ${selectedEndpoint.path} (${selectedEndpoint.summary || ''})\n\n`
	}

	const endpointsData = connections.flatMap(c =>
		c.specContent?.endpoints.map(ep => ({
			connectionName: c.name,
			path: ep.path,
			method: ep.method,
			summary: ep.summary
		})) || []
	)

	const prompt = `
${context}
Available APIs:
${endpointsData.map(e => `- [${e.connectionName}] ${e.method} ${e.path}: ${e.summary || ''}`).join('\n')}

User Question: "${userPrompt}"

Explain how the user can achieve their goal using the available APIs. If specific parameters or a body are needed, mention them. Do not return JSON. Return a plain text explanation.
`

	return await callAi(config, systemPrompt, prompt, false)
}
