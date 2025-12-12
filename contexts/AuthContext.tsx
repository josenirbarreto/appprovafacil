import { createContext, useContext } from 'react';
import { User } from '../types';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({ 
    user: null, 
    loading: true, 
    refreshUser: async () => {} 
});

export const useAuth = () => useContext(AuthContext);
