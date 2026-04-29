import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, ProtectedRoute } from './components/auth';
import { TaskMasterProvider } from './contexts/TaskMasterContext';
import { TasksSettingsProvider } from './contexts/TasksSettingsContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { PluginsProvider } from './contexts/PluginsContext';
import AppContent from './components/app/AppContent';
import NolmeDemo from './components/demo/view/NolmeDemo';
import { NolmeAppRoute } from './components/nolme-app';
import ErrorBoundary from './components/main-content/view/ErrorBoundary';
import i18n from './i18n/config.js';

export default function App() {
  return (
    <ErrorBoundary showDetails>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <AuthProvider>
            <WebSocketProvider>
              <PluginsProvider>
                <TasksSettingsProvider>
                  <TaskMasterProvider>
                    <Router basename={window.__ROUTER_BASENAME__ || ''}>
                      <Routes>
                        <Route path="/demo/nolme" element={<NolmeDemo />} />
                        <Route
                          path="/app"
                          element={
                            <ProtectedRoute>
                              <NolmeAppRoute />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/"
                          element={
                            <ProtectedRoute>
                              <AppContent />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/session/:sessionId"
                          element={
                            <ProtectedRoute>
                              <AppContent />
                            </ProtectedRoute>
                          }
                        />
                        {/* Catch-all: any unknown URL (e.g. a stale Safari
                            autofill like /projects/root/cosmic) redirects to
                            root so the app never lands on a route that
                            renders null (which looked like a mobile-only
                            blank screen because desktop stayed at /). */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </Router>
                  </TaskMasterProvider>
                </TasksSettingsProvider>
              </PluginsProvider>
            </WebSocketProvider>
          </AuthProvider>
        </ThemeProvider>
      </I18nextProvider>
    </ErrorBoundary>
  );
}
