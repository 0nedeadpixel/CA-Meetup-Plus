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
      const redirectUri = `${window.location.origin}/auth/callback`;
      const response = await fetch(`/api/auth/url?redirectUri=${encodeURIComponent(redirectUri)}`);
      const { url } = await response.json();
      
      if (url) {
        const authWindow = window.open(
          url,
          'oauth_popup',
          'width=600,height=700'
        );
        if (!authWindow) {
          alert("Please allow popups for this site to connect your Discord account.");
        }
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
