import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

axios.defaults.baseURL = 'https://chainfree.site:7001';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('authToken');
            if (token) {
                axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                await fetchUserProfile();
            } else {
                setLoading(false);
            }
        };
        initAuth();
    }, []);

    const fetchUserProfile = async () => {
        try {
            const response = await axios.get('/user/profile');
            if (response.data.success) {
                setUser(response.data.data);
            } else {
                // Server explicitly rejected the token — clear it
                localStorage.removeItem('authToken');
                delete axios.defaults.headers.common['Authorization'];
            }
        } catch (error) {
            const status = error.response?.status;
            if (status === 401 || status === 403) {
                // Token is invalid or expired — clear it
                localStorage.removeItem('authToken');
                delete axios.defaults.headers.common['Authorization'];
            }
            // Any other error (network, timeout, 5xx) — keep the token.
            // The user is still authenticated; we just can't reach the server right now.
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const signup = async (formData) => {
        try {
            const serverData = {
                full_name: `${formData.firstName} ${formData.lastName}`,
                email: formData.email,
                password: formData.password,
                phone_number: formData.phone || null,
                date_of_birth: formData.dateOfBirth || null,
                newsletter_subscribed: formData.newsletter || false,
                marketing_emails: formData.marketing || false,
            };
            const response = await axios.post('/auth/signup', serverData);
            if (response.data.success) {
                localStorage.setItem('authToken', response.data.token);
                axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
                setUser(response.data.data);
                return { success: true, message: response.data.message };
            }
        } catch (error) {
            console.error('Signup error:', error);
            if (error.response?.data?.errors) {
                const msgs = error.response.data.errors.map(e => e.msg).join(', ');
                return { success: false, error: msgs };
            }
            return { success: false, error: error.response?.data?.message || 'Signup failed' };
        }
    };

    const login = async (email, password) => {
        try {
            const response = await axios.post('/auth/login', { email, password });
            if (response.data.success) {
                localStorage.setItem('authToken', response.data.token);
                axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
                setUser(response.data.data);
                return { success: true };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: error.response?.data?.message || 'Login failed' };
        }
    };

    const logout = () => {
        localStorage.removeItem('authToken');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, signup, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};
