import { ApartmentsListPage } from './pages/ApartmentsListPage';
import { ApartmentDetailsPage } from './pages/ApartmentDetailsPage';
import { LoginPage } from './pages/LoginPage';
import { AdminPage } from './pages/AdminPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { ChatProvider } from './contexts/ChatContext';
import { SiteSettingsProvider } from './contexts/SiteSettingsContext';

export default function App() : JSX.Element {
  return (
    <SiteSettingsProvider>
    <ChatProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path='/'
            element={
              <AppLayout>
                <HomePage />
              </AppLayout>
            }
          />
          <Route
            path='/apartments'
            element={
              <AppLayout>
                <ApartmentsListPage />
              </AppLayout>
            }
          />
          <Route
            path='/apartments/:id'
            element={
              <AppLayout>
                <ApartmentDetailsPage />
              </AppLayout>
            }
          />
          <Route
            path='/login'
            element={
              <AppLayout>
                <LoginPage />
              </AppLayout>
            }
          />
          <Route
            path='/admin'
            element={
              <ProtectedRoute>
                <AppLayout>
                  <AdminPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
      </Routes>
    </BrowserRouter>
    </ChatProvider>
    </SiteSettingsProvider>
  );
}

