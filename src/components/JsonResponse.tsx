import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface JsonResponseProps {
	data: any
	headers?: any
}

export function JsonResponse({ data, headers }: JsonResponseProps) {
	const { t } = useTranslation()
	const [headerCopied, setHeaderCopied] = useState(false)
	const [bodyCopied, setBodyCopied] = useState(false)

	const handleCopy = useCallback((content: any, setCopied: (v: boolean) => void) => {
		const text = JSON.stringify(content, null, 2)
		navigator.clipboard.writeText(text).then(() => {
			setCopied(true)
			setTimeout(() => setCopied(false), 1500)
		})
	}, [])

	return (
		<div className="h-full w-full overflow-hidden min-w-0">
			<div className="h-full w-full overflow-auto p-4 min-w-0">
				<div className="space-y-4">
					{headers && (
						<div className="shrink-0">
							<div className="flex items-center justify-between mb-1">
								<h4 className="text-[10px] uppercase font-bold text-muted-foreground">
									{t('query.headers', { defaultValue: 'Headers' })}
								</h4>
								<Button
									variant="ghost"
									size="sm"
									className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
									onClick={() => handleCopy(headers, setHeaderCopied)}
								>
									{headerCopied ? (
										<><Check className="w-3 h-3 mr-1 text-green-500" />{t('query.copied', { defaultValue: 'Copied!' })}</>
									) : (
										<><Copy className="w-3 h-3 mr-1" />{t('query.copy', { defaultValue: 'Copy' })}</>
									)}
								</Button>
							</div>
							<pre className="bg-muted/50 border rounded-md p-3 overflow-auto max-h-[150px] text-[10px] whitespace-pre-wrap break-all">
								{JSON.stringify(headers, null, 2)}
							</pre>
						</div>
					)}
					<div>
						<div className="flex items-center justify-between mb-1">
							<h4 className="text-[10px] uppercase font-bold text-muted-foreground">
								{t('query.body', { defaultValue: 'Body' })}
							</h4>
							<Button
								variant="ghost"
								size="sm"
								className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
								onClick={() => handleCopy(data, setBodyCopied)}
							>
								{bodyCopied ? (
									<><Check className="w-3 h-3 mr-1 text-green-500" />{t('query.copied', { defaultValue: 'Copied!' })}</>
								) : (
									<><Copy className="w-3 h-3 mr-1" />{t('query.copy', { defaultValue: 'Copy' })}</>
								)}
							</Button>
						</div>
						<pre className="bg-muted/50 border rounded-md p-3 overflow-auto max-h-[70vh] whitespace-pre-wrap break-all">
							{JSON.stringify(data, null, 2)}
						</pre>
					</div>
				</div>
			</div>
		</div>
	)
}
