import { Sidebar } from '@/components/layout/Sidebar'
import { ConnectionsView } from '@/views/ConnectionsView'
import { QueryView } from '@/views/QueryView'
import { SettingsView } from '@/views/SettingsView'
import { McpView } from '@/views/McpView'
import { useAppStore } from '@/store/appStore'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { useEffect } from 'react'
import i18n from '@/i18n'

function App() {
  const { activeView, language } = useAppStore()

  useEffect(() => {
    if (language && i18n.language !== language) {
      i18n.changeLanguage(language)
    }
  }, [language])

  return (
    <div className="h-screen bg-background text-foreground overflow-hidden">
      <ResizablePanelGroup direction="horizontal" id="root-layout-group" autoSaveId="root-layout">
        <ResizablePanel defaultSize={20} minSize={10} id="sidebar-panel">
          <Sidebar />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={80} id="main-panel">
          <main className="h-full overflow-hidden bg-background">
            {activeView === 'connections' && <ConnectionsView />}
            {activeView === 'query' && <QueryView />}
            {activeView === 'settings' && <SettingsView />}
            {activeView === 'mcp' && <McpView />}
          </main>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

export default App
