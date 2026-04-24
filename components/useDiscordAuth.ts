import { useState, useEffect } from 'react';

export interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
  inServer: boolean;
}

export function useDiscordAuth() {
  const [user, setUser] = useState<DiscordUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      setUser(data.user);
    } catch (err) {
      console.error("Failed to fetch user:", err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();

    const handleMessage = (event: MessageEvent) => {
      // Allow local development and run.app environments
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.endsWith('.google.com')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        fetchUser(); // Refresh user state upon successful login
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const login = async () => {
    try {
      // 1. OPEN BLANK WINDOW IMMEDIATELY (Synchronously bypasses pop-up blockers)
      const authWindow = window.open('', 'oauth_popup', 'width=600,height=700');
      
      const redirectUri = `${window.location.origin}/auth/callback`;
      const response = await fetch(`/api/auth/url?redirectUri=${encodeURIComponent(redirectUri)}`);
      const { url } = await response.json();
      
      if (url) {
        if (authWindow) {
          // 2. If pop-up worked, send it to Discord
          authWindow.location.href = url;
        } else {
          // 3. FULL PAGE REDIRECT FALLBACK
          // If a strict mobile browser completely blocks pop-ups, just redirect the main tab
          window.location.href = url;
        }
      } else if (authWindow) {
        // Close the blank window if the API failed to return a URL
        authWindow.close();
      }
    } catch (error) {
      console.error('Failed to get Discord Auth URL', error);
      alert('Could not start Discord login. Please check configuration.');
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return { user, isLoading, login, logout, refresh: fetchUser };
}
