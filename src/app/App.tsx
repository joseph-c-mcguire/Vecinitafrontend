import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { AccessibilityProvider, useAccessibility } from './context/AccessibilityContext';
import { BackendSettingsProvider } from './context/BackendSettingsContext';
import { AuthProvider } from './context/AuthContext';
import { AccessibilityPanel } from './components/AccessibilityPanel';
import { KeyboardShortcutsHelp } from './components/KeyboardShortcutsHelp';
import { SkipToContent } from './components/SkipToContent';
import { NavBar } from './components/NavBar';
import ChatPage from './pages/ChatPage';
import DocumentsDashboard from './pages/DocumentsDashboard';
import AdminDashboard from './pages/AdminDashboard';
import LoginPage from './pages/LoginPage';

// ── Shell — theme + accessibility overlays ─────────────────────────────────

function AppShell() {
  const { settings: accessibilitySettings } = useAccessibility();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('vecinita-theme');
    return (saved as 'light' | 'dark') || 'light';
  });
  const [isAccessibilityOpen, setIsAccessibilityOpen] = useState(false);
  const [isKeyboardShortcutsOpen, setIsKeyboardShortcutsOpen] = useState(false);

  // Persist and apply theme
  useEffect(() => {
    localStorage.setItem('vecinita-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Screen reader class
  useEffect(() => {
    document.documentElement.classList.toggle(
      'screen-reader-active',
      !!accessibilitySettings.screenReader,
    );
  }, [accessibilitySettings.screenReader]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key === 'a') { e.preventDefault(); setIsAccessibilityOpen(true); }
      if (e.key === 'k') { e.preventDefault(); setIsKeyboardShortcutsOpen(true); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <SkipToContent />
      <NavBar theme={theme} setTheme={setTheme} onOpenAccessibility={() => setIsAccessibilityOpen(true)} />
      <div className="flex-1 flex flex-col" id="main-content" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/documents" element={<DocumentsDashboard />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
          {/* Catch-all → chat */}
          <Route path="*" element={<ChatPage />} />
        </Routes>
      </div>

      {isAccessibilityOpen && (
        <AccessibilityPanel isOpen={isAccessibilityOpen} onClose={() => setIsAccessibilityOpen(false)} />
      )}
      {isKeyboardShortcutsOpen && (
        <KeyboardShortcutsHelp onClose={() => setIsKeyboardShortcutsOpen(false)} />
      )}
    </div>
  );
}

// ── Root export ─────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <LanguageProvider>
        <AccessibilityProvider>
          <BackendSettingsProvider>
            <AuthProvider>
              <AppShell />
            </AuthProvider>
          </BackendSettingsProvider>
        </AccessibilityProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}

