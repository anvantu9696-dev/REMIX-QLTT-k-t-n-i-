import { PendingGuard } from './components/PendingGuard';
import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppLayout } from './components/layout/AppLayout';
import ErrorBoundary from './components/common/ErrorBoundary';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { GuidesPage } from './pages/GuidesPage';
import { SubstationsPage } from './pages/SubstationsPage';
import { FeedersPage } from './pages/FeedersPage';
import { DevicesPage } from './pages/DevicesPage';
import { DeviceDetailPage } from './pages/DeviceDetailPage';
import { MapPage } from './pages/MapPage';
import { LoopsPage } from './pages/LoopsPage';
import { LoopDetailPage } from './pages/LoopDetailPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { TasksAndInspectionsWrapper } from './pages/TasksAndInspectionsWrapper';
import { IssuesPage } from './pages/IssuesPage';
import { ImportPage } from './pages/ImportPage';
import { ReportsPage } from './pages/ReportsPage';
import { AuditPage } from './pages/AuditPage';
import { MyProposalsPage } from './pages/MyProposalsPage';
import { SettingsPage } from './pages/SettingsPage';
import { DynamicGraphPage } from './components/DynamicGraphPage';
import { RealtimeNotifier } from './components/RealtimeNotifier';
import { PlaceholderModulePage } from './pages/PlaceholderModulePage';

function AppContent() {
  const { user, isLoading } = useAuth();
  const [currentPath, setCurrentPath] = useState(() => (window.location.pathname || '/') + (window.location.search || ''));

  useEffect(() => {
    // Listen to browser URL path changes
    const handlePopState = () => {
      setCurrentPath((window.location.pathname || '/') + (window.location.search || ''));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    setCurrentPath(path);
    window.history.pushState({}, '', path);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-xs font-sans">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="font-semibold text-slate-300">Đang khởi tạo Hệ thống Quản lý Thiết bị...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderCurrentView = () => {
    // Parse URL path and query parameters
    const [pathBase, queryString] = currentPath.split('?');
    const cleanPath = pathBase.replace(/\/+$/, '') || '/';
    const queryParams = new URLSearchParams(queryString || '');

    // Check if path is device detail: /equipment/detail/:id, /devices/:id, /device/:id, or /equipment/:id
    let rawDeviceId: string | null = null;
    if (cleanPath.startsWith('/equipment/detail/')) {
      rawDeviceId = cleanPath.slice('/equipment/detail/'.length);
    } else if (cleanPath.startsWith('/devices/')) {
      rawDeviceId = cleanPath.slice('/devices/'.length);
    } else if (cleanPath.startsWith('/device/')) {
      rawDeviceId = cleanPath.slice('/device/'.length);
    }

    if (rawDeviceId !== null && rawDeviceId.trim().length > 0) {
      const decodedId = decodeURIComponent(rawDeviceId.trim());
      const parsedNum = parseInt(decodedId, 10);
      const deviceId = !isNaN(parsedNum) && String(parsedNum) === decodedId ? parsedNum : decodedId;

      console.log('[Router] Parsed deviceId from path:', {
        currentPath,
        cleanPath,
        rawDeviceId,
        deviceId,
        idType: typeof deviceId
      });

      return <DeviceDetailPage deviceId={deviceId} onBack={() => navigateTo('/equipment')} />;
    }

    // Check if path is loop detail: /loops/:id
    if (cleanPath.startsWith('/loops/') && cleanPath !== '/loops') {
      return <LoopDetailPage />;
    }

    switch (cleanPath) {
      case '/':
        return <DashboardPage onNavigate={navigateTo} />;
      case '/users':
        return <UsersPage />;
      case '/audit-logs':
      case '/audit':
        return <AuditPage />;
      case '/documents':
        return <DocumentsPage />;
      case '/guides':
        return <GuidesPage />;
      case '/equipment': {
        const feederIdParam = queryParams.get('feeder');
        const initialFeederId = feederIdParam || undefined;
        return (
          <DevicesPage
            initialFeederId={initialFeederId}
            onNavigateToDetail={(id) => navigateTo(`/equipment/detail/${id}`)}
          />
        );
      }
      case '/stations':
        return (
          <SubstationsPage
            onNavigateToFeeders={(stationId) => navigateTo(`/feeders?station=${stationId}`)}
          />
        );
      case '/feeders': {
        const stationIdParam = queryParams.get('station');
        const selectedSubstationId = stationIdParam || undefined;
        return (
          <FeedersPage
            selectedSubstationId={selectedSubstationId}
            onNavigateToDevices={(feederId) => navigateTo(`/equipment?feeder=${feederId}`)}
            onNavigateToLoops={() => navigateTo('/loops')}
          />
        );
      }
      case '/gis-map':
        return (
          <MapPage
            onNavigateToDetail={(id) => navigateTo(`/equipment/detail/${id}`)}
          />
        );
      case '/loops':
        return <LoopsPage />;
      case '/dynamic-graph':
        return <DynamicGraphPage />;
      case '/approvals':
        return <ApprovalsPage />;
      case '/tasks':
        return <TasksAndInspectionsWrapper />;
      case '/my-proposals':
        return <MyProposalsPage />;
      case '/anomalies':
        return <IssuesPage />;
      case '/reports':
        return <ReportsPage />;
      case '/import':
        return <ImportPage />;
      case '/settings':
        return <SettingsPage />;
      default:
        return <DashboardPage onNavigate={navigateTo} />;
    }
  };

  return (
    <AppLayout currentPath={currentPath} onNavigate={navigateTo}>
      <RealtimeNotifier />
      <ErrorBoundary fallbackTitle="Đã xảy ra lỗi khi tải trang">
        {renderCurrentView()}
      </ErrorBoundary>
    </AppLayout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PendingGuard><AppContent /></PendingGuard>
      </AuthProvider>
    </ThemeProvider>
  );
}
