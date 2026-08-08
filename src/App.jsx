import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { WalletProvider } from './context/WalletContext.js';
import Home from './pages/Home.jsx';
import BusinessHome from './pages/BusinessHome.jsx';
import WidgetPage from './pages/WidgetPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import MobileDashboardPage from './pages/MobileDashboardPage.jsx';
import WalletPage from './pages/WalletPage.jsx';
import PaymentsPage from './pages/PaymentsPage.jsx';
import SubscriptionsPage from './pages/SubscriptionsPage.jsx';
import CreateCardPage from './pages/CreateCardPage.jsx';
import TestStorePage from './pages/TestStorePage.jsx';
import AppLayout from './components/AppLayout.jsx';

const Spinner = () => (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: '#F5F7FA' }}>
        <div style={{ width: 28, height: 28, border: '2.5px solid #EAECF0', borderTopColor: '#100196', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
);

const ProtectedRoute = () => {
    const { user, loading } = useAuth();
    if (loading) return <Spinner />;
    // If loading is done but user is null, only redirect if there's
    // genuinely no token — a failed profile fetch should not log the user out.
    if (!user) {
        const hasToken = !!localStorage.getItem('authToken');
        if (hasToken) return <Spinner />;
        return <Navigate to="/login" replace />;
    }
    return <Outlet />;
};

const DashboardRoute = () => {
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
    useEffect(() => {
        const handler = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);
    return isMobile ? <MobileDashboardPage /> : <DashboardPage />;
};

// Redirects authenticated users away from /login and /signup
const GuestRoute = () => {
    const { user, loading } = useAuth();
    if (loading) return <Spinner />;
    return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
};

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <WalletProvider>
                    <Routes>
                        {/* Standalone widget — no auth, no layout */}
                        <Route path="/widget" element={<WidgetPage />} />

                        {/* Public */}
                        <Route path="/" element={<Home />} />
                        <Route path="/business" element={<BusinessHome />} />

                        {/* Auth routes — redirect to dashboard if already logged in */}
                        <Route element={<GuestRoute />}>
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/signup" element={<SignupPage />} />
                        </Route>

                        {/* Protected — wrapped in sidebar layout */}
                        <Route element={<ProtectedRoute />}>
                            <Route element={<AppLayout />}>
                                <Route path="/dashboard" element={<DashboardRoute />} />
                                <Route path="/wallet" element={<WalletPage />} />
                                <Route path="/payments" element={<PaymentsPage />} />
                                <Route path="/subscriptions" element={<SubscriptionsPage />} />
                                <Route path="/createcard" element={<CreateCardPage />} />
                                <Route path="/store" element={<TestStorePage />} />
                            </Route>
                        </Route>

                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </WalletProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
