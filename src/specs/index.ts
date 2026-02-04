// Built-in API specifications bundled with Prism
// These are official OpenAPI definitions from SaaS providers

export interface BuiltInSpec {
	id: string
	title: string
	version: string
	fileName: string
	iconDomain: string  // For favicon lookup
}

// List of built-in specifications (alphabetically sorted)
export const BUILT_IN_SPECS: BuiltInSpec[] = [
	{
		id: 'box',
		title: 'Box',
		version: '2025.0',
		fileName: 'box openapi v2025.0.json',
		iconDomain: 'box.com'
	},
	{
		id: 'clickup',
		title: 'ClickUp',
		version: '2.0',
		fileName: 'clickup openapi v2.json',
		iconDomain: 'clickup.com'
	},
	{
		id: 'wrike',
		title: 'Wrike',
		version: '4.0',
		fileName: 'wrike openapi v4.yaml',
		iconDomain: 'wrike.com'
	},
	{
		id: 'zoom',
		title: 'Zoom',
		version: '2.0.0',
		fileName: 'zoom openapi v2.json',
		iconDomain: 'zoom.com'
	}
]
