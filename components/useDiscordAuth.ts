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
      setIsLoading(true); // Updates the UI instantly so they know it's working
      const authWindow = window.open('', 'oauth_popup', 'width=600,height=700');
      
      const redirectUri = `${window.location.origin}/auth/callback`;
      const response = await fetch(`/api/auth/url?redirectUri=${encodeURIComponent(redirectUri)}`);
      const { url } = await response.json();
      
      if (url) {
        if (authWindow) {
          authWindow.location.href = url;

          // Polling fallback to catch successful login automatically
          const pollTimer = setInterval(async () => {
            try {
              const res = await fetch('/api/auth/me');
              if (res.ok) {
                const data = await res.json();
                if (data.user) {
                  clearInterval(pollTimer);
                  setUser(data.user);
                  authWindow.close(); // Auto-close popup if backend didn't do it
                  setIsLoading(false);
                  return;
                }
              }
              
              // Stop polling if user closed the window manually before finishing
              if (authWindow.closed) {
                clearInterval(pollTimer);
                fetchUser(); // Do one final check, just in case
              }
            } catch (e) {
              // Ignore network errors during polling
            }
          }, 1500);

        } else {
          // Fallback for strict mobile browsers
          window.location.href = url;
        }
      } else {
        if (authWindow) authWindow.close();
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Failed to get Discord Auth URL', error);
      alert('Could not start Discord login. Please check configuration.');
      setIsLoading(false);
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
