import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSelector } from 'react-redux';
import { userAPI } from '../services/api';
import { IRootState } from '../store';

interface AppSettings {
  notifications: boolean;
  emailAlerts: boolean;
  autoRefresh: boolean;
  refreshInterval: number; // in seconds
}

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  saveSettings: () => Promise<void>;
  loading: boolean;
}

const defaultSettings: AppSettings = {
  notifications: true,
  emailAlerts: true,
  autoRefresh: false,
  refreshInterval: 30
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const token = useSelector((state: IRootState) => state.auth.token);
  const user = useSelector((state: IRootState) => state.auth.user);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(false);

  // Load settings from server and localStorage only when user is authenticated
  useEffect(() => {
    // Only load settings if user is authenticated
    if (!token || !user) {
      // Load from localStorage only if user is not authenticated
      try {
        const savedSettings = localStorage.getItem('appSettings');
        if (savedSettings) {
          const parsedSettings = JSON.parse(savedSettings);
          setSettings({ ...defaultSettings, ...parsedSettings });
        }
      } catch (localError) {
        console.error('Error loading settings from localStorage:', localError);
      }
      return;
    }

    const loadSettings = async () => {
      try {
        // First try to load from server (only when authenticated)
        // const response = await userAPI.getProfile();
        // if (response.data.user && response.data.user.preferences) {
        //   const serverSettings = { ...defaultSettings, ...response.data.user.preferences };
        //   setSettings(serverSettings);
        //   localStorage.setItem('appSettings', JSON.stringify(serverSettings));
        // } else {
        //   // Fallback to localStorage
        //   const savedSettings = localStorage.getItem('appSettings');
        //   if (savedSettings) {
        //     const parsedSettings = JSON.parse(savedSettings);
        //     setSettings({ ...defaultSettings, ...parsedSettings });
        //   }
        // }
      } catch (error) {
        console.error('Error loading settings from server:', error);
        // Fallback to localStorage
        try {
          const savedSettings = localStorage.getItem('appSettings');
          if (savedSettings) {
            const parsedSettings = JSON.parse(savedSettings);
            setSettings({ ...defaultSettings, ...parsedSettings });
          }
        } catch (localError) {
          console.error('Error loading settings from localStorage:', localError);
        }
      }
    };

    loadSettings();
  }, [token, user]); // Depend on token and user

  // Save settings to localStorage whenever settings change
  useEffect(() => {
    try {
      localStorage.setItem('appSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings to localStorage:', error);
    }
  }, [settings]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const saveSettings = async (): Promise<void> => {
    setLoading(true);
    try {
      // Only save to server if user is authenticated
      if (token && user) {
        await userAPI.updatePreferences(settings);
      }
      
      // Always save to localStorage as backup
      localStorage.setItem('appSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings to server:', error);
      // Fallback to localStorage only
      try {
        localStorage.setItem('appSettings', JSON.stringify(settings));
      } catch (localError) {
        console.error('Error saving settings to localStorage:', localError);
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const value: SettingsContextType = {
    settings,
    updateSettings,
    saveSettings,
    loading
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

