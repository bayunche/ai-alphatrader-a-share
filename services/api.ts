
import { User, Workspace, ApiResponse } from "../types";

const API_BASE = "http://localhost:3001/api";

// Helper to check if backend is available (simple heuristic for this demo)
let isBackendAvailable = false;

const checkBackend = async () => {
    try {
        // Try a health check or just assume true if a fetch succeeds
        // For simplicity, we'll just try to use it and fallback on error
        isBackendAvailable = true; 
    } catch (e) {
        isBackendAvailable = false;
    }
};

// --- Auth API ---

export const authApi = {
    login: async (username: string): Promise<ApiResponse<User>> => {
        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            if (!res.ok) throw new Error("Network response not ok");
            return await res.json();
        } catch (e) {
            // Fallback to LocalStorage Mock
            console.warn("Backend unavailable, using LocalStorage for Login");
            const usersStr = localStorage.getItem('alpha_trader_users');
            const users: User[] = usersStr ? JSON.parse(usersStr) : [];
            const found = users.find(u => u.username.toLowerCase() === username.toLowerCase());
            if (found) return { success: true, data: found };
            return { success: false, error: 'User not found (Local)' };
        }
    },

    register: async (username: string): Promise<ApiResponse<User>> => {
        try {
             const res = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            return await res.json();
        } catch (e) {
             // Fallback
             console.warn("Backend unavailable, using LocalStorage for Register");
             const usersStr = localStorage.getItem('alpha_trader_users');
             const users: User[] = usersStr ? JSON.parse(usersStr) : [];
             if (users.find(u => u.username === username)) return { success: false, error: 'User exists' };
             
             const newUser = { id: Math.random().toString(36).substr(2, 9), username };
             localStorage.setItem('alpha_trader_users', JSON.stringify([...users, newUser]));
             return { success: true, data: newUser };
        }
    }
};

// --- Data API ---

export const dataApi = {
    loadWorkspace: async (userId: string): Promise<Workspace | null> => {
        try {
            const res = await fetch(`${API_BASE}/workspace/${userId}`);
            const json: ApiResponse<Workspace> = await res.json();
            if (json.success && json.data) return json.data;
            return null;
        } catch (e) {
            console.warn("Backend unavailable, loading from LocalStorage");
            const agents = localStorage.getItem(`alpha_trader_${userId}_agents`);
            const history = localStorage.getItem(`alpha_trader_${userId}_history`);
            const logs = localStorage.getItem(`alpha_trader_${userId}_logs`);
            const pools = localStorage.getItem(`alpha_trader_${userId}_pools`);
            
            if (!agents) return null;

            return {
                agents: JSON.parse(agents),
                tradeHistory: history ? JSON.parse(history) : [],
                logs: logs ? JSON.parse(logs) : [],
                stockPools: pools ? JSON.parse(pools) : [],
                lastUpdated: new Date().toISOString()
            };
        }
    },

    saveWorkspace: async (userId: string, workspace: Workspace): Promise<void> => {
        try {
            await fetch(`${API_BASE}/workspace`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, data: workspace })
            });
        } catch (e) {
            // Fallback silently to local storage
            localStorage.setItem(`alpha_trader_${userId}_agents`, JSON.stringify(workspace.agents));
            localStorage.setItem(`alpha_trader_${userId}_history`, JSON.stringify(workspace.tradeHistory));
            localStorage.setItem(`alpha_trader_${userId}_logs`, JSON.stringify(workspace.logs));
            localStorage.setItem(`alpha_trader_${userId}_pools`, JSON.stringify(workspace.stockPools));
        }
    }
};
