import { useMemo, useState, useCallback } from 'react'
import { AgGridReact } from 'ag-grid-react'
import {
	ModuleRegistry,
	ClientSideRowModelModule,
	TextFilterModule,
	NumberFilterModule,
	DateFilterModule,
	PaginationModule,
	ValidationModule,
	type ColDef,
	type CellClickedEvent
} from 'ag-grid-community'
import { useTranslation } from 'react-i18next'

// AG Grid styles (v35 style imports)
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'

import { flattenObject, extractDataArray } from '@/lib/jsonUtils'

// Register modules
ModuleRegistry.registerModules([
	ClientSideRowModelModule,
	TextFilterModule,
	NumberFilterModule,
	DateFilterModule,
	PaginationModule,
	ValidationModule
])

interface ResponseGridProps {
	data: any
}

export function ResponseGrid({ data }: ResponseGridProps) {
	const { t } = useTranslation()
	const [copiedToast, setCopiedToast] = useState(false)
	const rawArray = useMemo(() => extractDataArray(data), [data])

	// Robust Flattening: Always flatten objects to ensure consistent keys
	const rowData = useMemo(() => {
		return rawArray.map(item => {
			if (!item || typeof item !== 'object') return { value: item }
			return flattenObject(item)
		})
	}, [rawArray])

	const handleCellClicked = useCallback((event: CellClickedEvent) => {
		// Skip row number column
		if (event.colDef.headerName === '#') return

		const value = event.value
		if (value == null) return

		const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
		navigator.clipboard.writeText(text).then(() => {
			setCopiedToast(true)
			setTimeout(() => setCopiedToast(false), 1500)
		})
	}, [])

	const columnDefs = useMemo<ColDef[]>(() => {
		if (rowData.length === 0) return []

		// Extract all unique keys from all rows
		const keys = new Set<string>()
		rowData.forEach(row => Object.keys(row).forEach(k => keys.add(k)))

		const baseCols: ColDef[] = Array.from(keys).map(key => ({
			field: key,
			headerName: key.split('.').pop() || key,
			valueGetter: (params) => params.data?.[key],
			sortable: true,
			filter: true,
			resizable: true,
			tooltipField: key,
			cellStyle: { cursor: 'pointer' }
		}))

		// Add row number column at the start
		return [
			{
				headerName: '#',
				valueGetter: "node.rowIndex + 1",
				width: 70,
				pinned: 'left',
				sortable: false,
				filter: false,
				suppressMenu: true,
				cellStyle: { fontWeight: 'bold', color: 'var(--primary)' }
			},
			...baseCols
		]
	}, [rowData])

	const defaultColDef = useMemo(() => ({
		flex: 1,
		minWidth: 100,
	}), [])

	return (
		<div className="h-full w-full overflow-hidden p-4 min-w-0 relative">
			<div className="ag-theme-quartz-dark h-full w-full min-w-0">
				<AgGridReact
					rowData={rowData}
					columnDefs={columnDefs}
					defaultColDef={defaultColDef}
					pagination={true}
					paginationPageSize={100}
					paginationPageSizeSelector={[100, 500, 1000]}
					onCellClicked={handleCellClicked}
				/>
			</div>
			{copiedToast && (
				<div className="absolute top-6 right-6 bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-md shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
					{t('query.copied', { defaultValue: 'Copied!' })}
				</div>
			)}
		</div>
	)
}
