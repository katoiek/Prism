/**
 * Flattens a nested JSON object into a single-level object with dot-notated keys.
 * Handles arrays by indexing them.
 */
export function flattenObject(obj: any, prefix = ''): Record<string, any> {
	return Object.keys(obj).reduce((acc: any, k: string) => {
		const pre = prefix.length ? prefix + '.' : ''
		if (obj[k] !== null && typeof obj[k] === 'object' && !Array.isArray(obj[k])) {
			Object.assign(acc, flattenObject(obj[k], pre + k))
		} else if (Array.isArray(obj[k])) {
			// For arrays, we often want to keep them as strings or handle them specially
			// but for basic flattening, we can join them or index them.
			// Here we keep them as is or stringify them for the grid.
			acc[pre + k] = JSON.stringify(obj[k])
		} else {
			acc[pre + k] = obj[k]
		}
		return acc
	}, {})
}

/**
 * Extracts a list of objects from a potentially nested API response.
 * Often APIs return { data: [...], total: 100 } or similar.
 */
export function extractDataArray(response: any): any[] {
	if (Array.isArray(response)) return response
	if (response && typeof response === 'object') {
		// 1. Check if this object looks like a Single Entity (has ID)
		// Prioritize this over "common array fields" because an entity might have a 'tasks' list but still be a single entity.
		const keys = Object.keys(response)
		const hasId = keys.some(k => /^id$|^_id$|^uuid$/i.test(k))
		if (hasId) {
			return [response]
		}

		// 2. Look for common array fields (Standard Wrappers)
		const commonKeys = ['data', 'items', 'results', 'tasks', 'rows']
		for (const key of commonKeys) {
			if (Array.isArray(response[key])) return response[key]
		}

		// 3. Check if it has primitive properties (indicates it's an entity, not just a container)
		// e.g. { name: "Idea", tags: [...] } -> Should be treated as one row, not unwrapped to tags.
		const values = Object.values(response)
		const hasPrimitives = values.some(v => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
		if (hasPrimitives) {
			return [response]
		}

		// 4. If no common keys and not an entity, but there's a single array property, return it
		// (This handles custom wrappers like { "custom_users": [...] })
		const arrays = Object.values(response).filter(v => Array.isArray(v))
		if (arrays.length === 1) return arrays[0] as any[]
	}
	// Fallback to wrapping single object in array
	return response ? [response] : []
}
