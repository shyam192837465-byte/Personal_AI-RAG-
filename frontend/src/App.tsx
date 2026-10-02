import React, { useState, useEffect } from 'react';
import type { AppSettings, ServerHealth, DocumentMetadata } from './types';
import { loadSettings, saveSettings, fetchHealth } from './utils/api';
import { useChatStream } from './hooks/useChatStream';
import { useKnowledgeBase } from './hooks/useKnowledgeBase';
import { Header } from './components/Header';
import { ChatContainer } from './components/ChatContainer';
import { PromptInput } from './components/PromptInput';
import { KnowledgeDrawer } from './components/KnowledgeDrawer';
import { SettingsModal } from './components/SettingsModal';
import { DocumentViewerModal } from './components/DocumentViewerModal';
import { ErrorBanner } from './components/ErrorBanner';

export const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [isKnowledgeOpen, setIsKnowledgeOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentMetadata | null>(null);
  const [inputText, setInputText] = useState('');

  const {
    messages,
    isStreaming,
    errorBanner,
    sendMessage,
    stopGeneration,
    clearChat,
    setErrorBanner,
  } = useChatStream({ settings });

  const {
    documents,
    isUploading,
    uploadProgress,
    statusMessage,
    refreshDocuments,
    uploadFile,
    addTextSnippet,
    deleteFile,
  } = useKnowledgeBase(settings.backendUrl);

  // Check backend health on mount and every 30s
  useEffect(() => {
    let isMounted = true;
    const check = async () => {
      const h = await fetchHealth(settings.backendUrl);
      if (isMounted) setHealth(h);
    };
    check();
    const interval = setInterval(check, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [settings.backendUrl]);

  const handleUpdateSettings = (newPartial: Partial<AppSettings>) => {
    const updated = { ...settings, ...newPartial };
    setSettings(updated);
    saveSettings(updated);
  };

  const handleOpenSourceByName = (sourceName: string) => {
    const doc: DocumentMetadata = documents.find((d) => d.source === sourceName) || {
      source: sourceName,
      chunks: 1,
      type: sourceName.split('.').pop()?.toUpperCase() || 'TXT',
      size: 0,
      created_at: new Date().toISOString(),
    };
    setSelectedDocument(doc);
  };

  return (
    <div className="flex flex-col h-screen bg-[#f8fafc] text-slate-900 antialiased selection:bg-blue-500/20 selection:text-blue-700 overflow-hidden">
      {/* Background ambient lighting effects for light theme */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-sky-200/40 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl" />
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <Header
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onOpenKnowledge={() => setIsKnowledgeOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onClearChat={clearChat}
          docCount={documents.length}
          health={health}
        />

        {/* Actionable Error Banner */}
        <ErrorBanner error={errorBanner} onDismiss={() => setErrorBanner(null)} />

        {/* Chat History & Auto-scrolling Messages */}
        <ChatContainer
          messages={messages}
          isStreaming={isStreaming}
          onSelectPrompt={(text) => {
            setInputText(text);
            sendMessage(text);
          }}
          onOpenSource={handleOpenSourceByName}
        />

        {/* Bottom Floating Prompt Area */}
        <PromptInput
          input={inputText}
          setInput={setInputText}
          onSend={(query) => sendMessage(query)}
          isStreaming={isStreaming}
          onStop={stopGeneration}
          onOpenKnowledge={() => setIsKnowledgeOpen(true)}
        />
      </div>

      {/* Slide-over Knowledge Base Drawer */}
      <KnowledgeDrawer
        isOpen={isKnowledgeOpen}
        onClose={() => setIsKnowledgeOpen(false)}
        documents={documents}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        statusMessage={statusMessage}
        onUploadFile={uploadFile}
        onAddTextSnippet={addTextSnippet}
        onRefresh={refreshDocuments}
        onDeleteDocument={deleteFile}
        onOpenDocument={(doc) => setSelectedDocument(doc)}
      />

      {/* Full-featured Document Viewer & Preview Modal */}
      <DocumentViewerModal
        document={selectedDocument}
        backendUrl={settings.backendUrl}
        onClose={() => setSelectedDocument(null)}
      />

      {/* Settings Dialog Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={(newSettings) => {
          setSettings(newSettings);
          saveSettings(newSettings);
        }}
      />
    </div>
  );
};

export default App;
