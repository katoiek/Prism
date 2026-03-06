import { useMemo, useRef, useCallback, useEffect } from 'react'
import { AgGridReact } from 'ag-grid-react'
import {
	ModuleRegistry,
	ClientSideRowModelModule,
	TextFilterModule,
	NumberFilterModule,
	DateFilterModule,
	PaginationModule,
	ValidationModule,
	type ColDef
} from 'ag-grid-community'

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

export interface ExactMatchInfo {
	rowIndex: number
	colId: string
}

interface ResponseGridProps {
	data: any
	searchQuery?: string
	onGridReady?: (api: any) => void
	onMatchesFound?: (matches: { positions: number[], count: number, exactMatches?: ExactMatchInfo[] }) => void
}

export function ResponseGrid({ data, searchQuery, onGridReady, onMatchesFound }: ResponseGridProps) {
	const gridApiRef = useRef<any>(null)
	const wrapperRef = useRef<HTMLDivElement>(null)
	const rawArray = useMemo(() => extractDataArray(data), [data])

	// Robust Flattening: Always flatten objects to ensure consistent keys
	const rowData = useMemo(() => {
		return rawArray.map(item => {
			if (!item || typeof item !== 'object') return { value: item }
			return flattenObject(item)
		})
	}, [rawArray])

	// Calculate matches whenever data or searchQuery changes
	useMemo(() => {
		if (!searchQuery || !onMatchesFound || rowData.length === 0) {
			onMatchesFound?.({ positions: [], count: 0, exactMatches: [] })
			return
		}

		let count = 0
		const positions: number[] = []
		const exactMatches: ExactMatchInfo[] = []
		// Escape regex special chars for accurate string matching
		const query = searchQuery.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

		rowData.forEach((row, idx) => {
			Object.entries(row).forEach(([key, val]) => {
				if (val === null || val === undefined) return
				const text = typeof val === 'object' ? JSON.stringify(val) : String(val)
				if (text.toLowerCase().includes(query)) {
					// Add one match position per matching cell to avoid being stuck navigating multiple hits in the same cell
					positions.push((idx / rowData.length) * 100)
					exactMatches.push({ rowIndex: idx, colId: key })
					count++
				}
			})
		})

		onMatchesFound({ positions, count, exactMatches })
	}, [rowData, searchQuery, onMatchesFound])

	const columnDefs = useMemo<ColDef[]>(() => {
		if (rowData.length === 0) return []

		// Extract all unique keys from all rows
		const keys = new Set<string>()
		rowData.forEach(row => Object.keys(row).forEach(k => keys.add(k)))

		const baseCols: ColDef[] = Array.from(keys).map(key => ({
			field: key,
			colId: key,
			headerName: key.split('.').pop() || key,
			valueGetter: (params) => params.data?.[key],
			getQuickFilterText: (params) => {
				const val = params.data?.[key]
				if (val === null || val === undefined) return ''
				return typeof val === 'object' ? JSON.stringify(val) : String(val)
			},
			cellRenderer: (params: any) => {
				const val = params.value
				if (val === null || val === undefined) return ''
				const text = typeof val === 'object' ? JSON.stringify(val) : String(val)
				if (!searchQuery) return text

				const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'))
				return (
					<span>
						{parts.map((part, index) =>
							part.toLowerCase() === searchQuery.toLowerCase() ? (
								<mark key={index} className="bg-yellow-400/80 text-black px-0.5 rounded-sm">
									{part}
								</mark>
							) : (
								part
							)
						)}
					</span>
				)
			},
			sortable: true,
			filter: true,
			resizable: true,
			tooltipField: key
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
	}, [rowData, searchQuery])

	const defaultColDef = useMemo(() => ({
		flex: 1,
		minWidth: 100,
	}), [])

	// Listen for Ctrl+C / Cmd+C on the grid wrapper to copy the focused cell value
	useEffect(() => {
		const wrapper = wrapperRef.current
		if (!wrapper) return

		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
				// Don't interfere if user has selected text manually (double-click selection)
				const selection = window.getSelection()
				if (selection && selection.toString().length > 0) return

				const api = gridApiRef.current
				if (!api) return
				const focusedCell = api.getFocusedCell()
				if (!focusedCell) return
				const rowNode = api.getDisplayedRowAtIndex(focusedCell.rowIndex)
				if (!rowNode) return
				const colId = focusedCell.column.getColId()
				const val = rowNode.data?.[colId]
				if (val === null || val === undefined) return
				const text = typeof val === 'object' ? JSON.stringify(val) : String(val)
				e.preventDefault()
				navigator.clipboard.writeText(text)
			}
		}

		wrapper.addEventListener('keydown', handleKeyDown)
		return () => wrapper.removeEventListener('keydown', handleKeyDown)
	}, [])

	return (
		<div ref={wrapperRef} className="h-full w-full overflow-hidden p-4 min-w-0 flex flex-col relative" tabIndex={-1}>
			<style>{`
				.ag-theme-quartz-dark .ag-cell-focus {
					border: 2px solid #3b82f6 !important;
					background-color: rgba(59, 130, 246, 0.1) !important;
				}
			`}</style>
			<div className="ag-theme-quartz-dark h-full w-full min-w-0">
				<AgGridReact
					rowData={rowData}
					columnDefs={columnDefs}
					defaultColDef={defaultColDef}
					pagination={true}
					paginationPageSize={100}
					paginationPageSizeSelector={[100, 500, 1000]}
					quickFilterText={searchQuery}
					enableCellTextSelection={true}
					ensureDomOrder={true}
					onGridReady={(params) => {
						gridApiRef.current = params.api
						onGridReady?.(params.api)
					}}
				/>
			</div>
		</div>
	)
}
