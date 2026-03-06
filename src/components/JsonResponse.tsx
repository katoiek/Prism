import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useMemo } from 'react'

interface JsonResponseProps {
	data: any
	headers?: any
	searchQuery?: string
	onMatchesFound?: (matches: { positions: number[], count: number }) => void
	activeMatchIdx?: number
}

export function JsonResponse({ data, headers, searchQuery, onMatchesFound, activeMatchIdx = 0 }: JsonResponseProps) {
	const { t } = useTranslation()
	const containerRef = useRef<HTMLDivElement>(null)

	// Memoize stringified JSON to avoid heavy processing on every re-render
	const bodyString = useMemo(() => JSON.stringify(data, null, 2), [data])
	const headersString = useMemo(() => headers ? JSON.stringify(headers, null, 2) : '', [headers])

	// Efficiently highlight text using dangerouslySetInnerHTML
	// This is much faster than React.map for large data
	const highlightedHeadersContent = useMemo(() => {
		if (!searchQuery || !headersString) return headersString
		const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
		return headersString.replace(regex, '<mark class="bg-yellow-400/80 text-black rounded-sm px-0.5">$1</mark>')
	}, [headersString, searchQuery])

	const highlightedBodyContent = useMemo(() => {
		if (!searchQuery) return bodyString
		// Defensive check: if string is too large, you might want to limit regex but let's try standard first
		const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
		return bodyString.replace(regex, '<mark class="bg-yellow-400/80 text-black rounded-sm px-0.5">$1</mark>')
	}, [bodyString, searchQuery])

	// Notify parent of matches and handle active scroll
	useEffect(() => {
		if (!onMatchesFound) return

		// We use a small timeout to let the dangerouslySetInnerHTML content settle
		const timer = setTimeout(() => {
			if (!containerRef.current) return
			const marks = Array.from(containerRef.current.querySelectorAll('mark'))

			// Remove previous active highlights
			marks.forEach(m => {
				m.classList.remove('ring-2', 'ring-blue-500', 'z-10', 'relative', 'bg-blue-300', 'active-match')
			})

			if (marks.length > 0 && searchQuery) {
				onMatchesFound({ positions: [], count: marks.length })

				const targetIdx = Math.min(Math.max(0, activeMatchIdx), marks.length - 1)
				const targetMark = marks[targetIdx]

				if (targetMark) {
					targetMark.classList.add('ring-2', 'ring-blue-500', 'z-10', 'relative', 'bg-blue-300', 'active-match')
					// Scroll to center
					targetMark.scrollIntoView({ behavior: 'auto', block: 'center' })
				}
			} else {
				onMatchesFound({ positions: [], count: 0 })
			}
		}, 10)

		return () => clearTimeout(timer)
	}, [searchQuery, activeMatchIdx, onMatchesFound, highlightedBodyContent, highlightedHeadersContent])

	return (
		<div className="h-full w-full overflow-hidden min-w-0 flex flex-col relative" ref={containerRef}>
			<div className="flex-1 overflow-auto p-4 min-w-0 relative">
				<div className="space-y-4">
					{headers && (
						<div className="shrink-0">
							<h4 className="text-[10px] uppercase font-bold text-muted-foreground mb-1">
								{t('query.headers', { defaultValue: 'Headers' })}
							</h4>
							<pre
								className="bg-muted/50 border rounded-md p-3 overflow-auto max-h-[150px] text-[10px] whitespace-pre-wrap break-all"
								dangerouslySetInnerHTML={{ __html: highlightedHeadersContent }}
							/>
						</div>
					)}
					<div>
						<h4 className="text-[10px] uppercase font-bold text-muted-foreground mb-1">
							{t('query.body', { defaultValue: 'Body' })}
						</h4>
						<pre
							className="bg-muted/50 border rounded-md p-3 overflow-auto max-h-[70vh] whitespace-pre-wrap break-all text-xs"
							dangerouslySetInnerHTML={{ __html: highlightedBodyContent }}
						/>
					</div>
				</div>
			</div>
		</div>
	)
}

