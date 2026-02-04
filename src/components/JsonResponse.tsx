import { useTranslation } from 'react-i18next'

interface JsonResponseProps {
	data: any
	headers?: any
}

export function JsonResponse({ data, headers }: JsonResponseProps) {
	const { t } = useTranslation()

	return (
		<div className="h-full w-full overflow-hidden min-w-0">
			<div className="h-full w-full overflow-auto p-4 min-w-0">
				<div className="space-y-4">
					{headers && (
						<div className="shrink-0">
							<h4 className="text-[10px] uppercase font-bold text-muted-foreground mb-1">
								{t('query.headers', { defaultValue: 'Headers' })}
							</h4>
							<pre className="bg-muted/50 border rounded-md p-3 overflow-auto max-h-[150px] text-[10px] whitespace-pre-wrap break-all">
								{JSON.stringify(headers, null, 2)}
							</pre>
						</div>
					)}
					<div>
						<h4 className="text-[10px] uppercase font-bold text-muted-foreground mb-1">
							{t('query.body', { defaultValue: 'Body' })}
						</h4>
						<pre className="bg-muted/50 border rounded-md p-3 overflow-auto max-h-[70vh] whitespace-pre-wrap break-all">
							{JSON.stringify(data, null, 2)}
						</pre>
					</div>
				</div>
			</div>
		</div>
	)
}
