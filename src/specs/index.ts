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
		id: 'freee-accounting',
		title: 'freee会計',
		version: '1.0',
		fileName: 'freee accounting openapi v2020.json',
		iconDomain: 'freee.co.jp'
	},
	{
		id: 'freee-hr',
		title: 'freee人事労務',
		version: '2022-02-01',
		fileName: 'freee hr openapi v2022.json',
		iconDomain: 'freee.co.jp'
	},
	{
		id: 'freee-invoice',
		title: 'freee請求書',
		version: '1',
		fileName: 'freee invoice openapi.yml',
		iconDomain: 'freee.co.jp'
	},
	{
		id: 'freee-pm',
		title: 'freeeプロジェクト管理',
		version: '1.1.0',
		fileName: 'freee pm openapi.yml',
		iconDomain: 'freee.co.jp'
	},
	{
		id: 'freee-sm',
		title: 'freee販売管理',
		version: '2025-11-17',
		fileName: 'freee sm openapi.yml',
		iconDomain: 'freee.co.jp'
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
