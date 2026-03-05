import { useTranslation } from 'react-i18next'
import { useEffect, useRef } from 'react'

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

	// Notify parent of matches and scroll to active
	useEffect(() => {
		if (!containerRef.current || !onMatchesFound || !searchQuery) {
			onMatchesFound?.({ positions: [], count: 0 })
			return
		}

		// Small delay to allow react to render the <mark> tags
		const timer = setTimeout(() => {
			if (!containerRef.current) return
			const marks = Array.from(containerRef.current.querySelectorAll('mark'))

			// Remove previous active highlights
			marks.forEach(m => m.classList.remove('ring-2', 'ring-blue-500', 'z-10', 'relative', 'bg-blue-300'))

			if (marks.length > 0) {
				const containerHeight = containerRef.current.scrollHeight || 1
				const positions = marks.map(mark => {
					// Get position relative to the scrollable container
					const top = mark.offsetTop
					return (top / containerHeight) * 100
				})

				onMatchesFound({ positions, count: marks.length })

				// Highlight and scroll to the active match
				const targetIdx = Math.min(Math.max(0, activeMatchIdx), marks.length - 1)
				const targetMark = marks[targetIdx]

				if (targetMark) {
					targetMark.classList.add('ring-2', 'ring-blue-500', 'z-10', 'relative', 'bg-blue-300')
					targetMark.scrollIntoView({ behavior: 'smooth', block: 'center' })
				}
			} else {
				onMatchesFound({ positions: [], count: 0 })
			}
		}, 50)

		return () => clearTimeout(timer)
	}, [searchQuery, activeMatchIdx, onMatchesFound, data, headers])

	const highlightText = (text: string, query?: string) => {
		if (!query) return text

		const parts = text.split(new RegExp(`(${query})`, 'gi'))
		return (
			<>
				{parts.map((part, index) =>
					part.toLowerCase() === query.toLowerCase() ? (
						<mark key={index} className="bg-yellow-400/80 text-black rounded-sm px-0.5">
							{part}
						</mark>
					) : (
						part
					)
				)}
			</>
		)
	}

	return (
		<div className="h-full w-full overflow-hidden min-w-0 flex flex-col relative" ref={containerRef}>
			<div className="flex-1 overflow-auto p-4 min-w-0 relative">
				<div className="space-y-4">
					{headers && (
						<div className="shrink-0">
							<h4 className="text-[10px] uppercase font-bold text-muted-foreground mb-1">
								{t('query.headers', { defaultValue: 'Headers' })}
							</h4>
							<pre className="bg-muted/50 border rounded-md p-3 overflow-auto max-h-[150px] text-[10px] whitespace-pre-wrap break-all">
								{highlightText(JSON.stringify(headers, null, 2), searchQuery)}
							</pre>
						</div>
					)}
					<div>
						<h4 className="text-[10px] uppercase font-bold text-muted-foreground mb-1">
							{t('query.body', { defaultValue: 'Body' })}
						</h4>
						<pre className="bg-muted/50 border rounded-md p-3 overflow-auto max-h-[70vh] whitespace-pre-wrap break-all">
							{highlightText(JSON.stringify(data, null, 2), searchQuery)}
						</pre>
					</div>
				</div>
			</div>
		</div>
	)
}
