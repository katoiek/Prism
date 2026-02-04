import * as React from "react"
import { cn } from "@/lib/utils"

const Tabs = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn("flex flex-col h-full", className)}
		{...props}
	/>
))
Tabs.displayName = "Tabs"

const TabsList = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn(
			"inline-flex h-10 items-center justify-start border-b w-full px-2 gap-6 text-muted-foreground",
			className
		)}
		{...props}
	/>
))
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef<
	HTMLButtonElement,
	React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }
>(({ className, active, ...props }, ref) => (
	<button
		ref={ref}
		className={cn(
			"inline-flex items-center justify-center whitespace-nowrap py-2 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border-b-2 border-transparent",
			active
				? "border-primary text-foreground"
				: "hover:text-foreground/80",
			className
		)}
		{...props}
	/>
))
TabsTrigger.displayName = "TabsTrigger"

const TabsContent = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement> & { active?: boolean }
>(({ className, active, ...props }, ref) => (
	<div
		ref={ref}
		className={cn(
			"ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 flex-1 overflow-hidden",
			className,
			!active && "hidden"
		)}
		{...props}
	/>
))
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }
