import axios from 'axios'
import { type Connection } from '@/store/appStore'
import { type ApiEndpoint } from './apiParser'

export type AiProvider = 'openai' | 'anthropic' | 'google'

interface AiHelperConfig {
	provider: AiProvider
	apiKey: string
}

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
