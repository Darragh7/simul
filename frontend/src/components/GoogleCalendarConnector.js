import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const GoogleCalendarConnector = ({ groups, onSync }) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle', 'syncing', 'success', 'error'

  // API base URL - change this to match your Flask backend
  const API_BASE_URL = 'http://127.0.0.1:5000';

  // Check if user has calendar connected
  useEffect(() => {
    if (user) {
      checkCalendarStatus();
    }
  }, [user]);

  // Function to check if calendar is connected
  const checkCalendarStatus = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/user-status`, {
        credentials: 'include' // Important for session cookies
      });
      
      const data = await response.json();
      setIsConnected(data.calendar_connected || false);
      console.log('Calendar status response: ', data);
      // If connected, fetch last sync time from Firestore
      if (data.calendar_connected && user) {
        const userDoc = await fetch(`${API_BASE_URL}/api/last-sync-time`, {
          credentials: 'include'
        });
        
        const userData = await userDoc.json();
        if (userData.lastCalendarSync) {
          setLastSyncTime(new Date(userData.lastCalendarSync));
        }
      }
    } catch (error) {
      console.error('Error checking calendar status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Connect Google Calendar
  const connectGoogleCalendar = () => {
    // Open a popup window for the OAuth flow
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(
      `${API_BASE_URL}/auth/google`,
      'Connect Google Calendar',
      `width=${width},height=${height},left=${left},top=${top}`
    );
    
    // Listen for messages from the popup
    window.addEventListener('message', function(event) {
      if (event.data.type === 'CALENDAR_CONNECTED' && event.data.success) {
        setIsConnected(true);
        checkCalendarStatus(); // Refresh the status
      }
    });
  };

  // Sync calendar data for all groups
  const syncCalendar = async () => {
    if (!isConnected || !user) return;
    
    setSyncStatus('syncing');
    try {
      // First sync calendar data
      const syncResponse = await fetch(`${API_BASE_URL}/api/sync-calendar`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!syncResponse.ok) {
        throw new Error('Failed to sync calendar');
      }
      
      // Then update availability for each group
      for (const group of groups) {
        await fetch(`${API_BASE_URL}/api/update-group-availability`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            groupId: group
          })
        });
      }
      
      // Update last sync time
      setLastSyncTime(new Date());
      setSyncStatus('success');
      
      // Call the onSync callback if provided
      if (onSync) onSync();
      
      // Reset status after a delay
      setTimeout(() => {
        setSyncStatus('idle');
      }, 3000);
    } catch (error) {
      console.error('Error syncing calendar:', error);
      setSyncStatus('error');
      
      // Reset status after a delay
      setTimeout(() => {
        setSyncStatus('idle');
      }, 3000);
    }
  };

  // Disconnect Google Calendar
  const disconnectCalendar = async () => {
    if (!isConnected || !user) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/disconnect-calendar`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        setIsConnected(false);
        setLastSyncTime(null);
      }
    } catch (error) {
      console.error('Error disconnecting calendar:', error);
    }
  };

  if (isLoading) {
    return <div className="calendar-connector loading">Loading calendar status...</div>;
  }

  return (
    <div className="google-calendar-container">
      {!isConnected ? (
        <button 
          className="connect-google-btn"
          onClick={connectGoogleCalendar}
        >
          Connect Google Calendar
        </button>
      ) : (
        <div className="calendar-connected">
          <div className="connected-status">
            <span className="status-dot"></span>
            Google Calendar Connected
          </div>
          
          <button 
            className={`sync-btn ${syncStatus !== 'idle' ? syncStatus : ''}`}
            onClick={syncCalendar}
            disabled={syncStatus !== 'idle'}
          >
            {syncStatus === 'syncing' ? 'Syncing...' : 
             syncStatus === 'success' ? 'Sync Complete!' : 
             syncStatus === 'error' ? 'Sync Failed' : 
             'Sync Calendar Now'}
          </button>
          
          {lastSyncTime && (
            <div className="last-sync">
              Last synced: {lastSyncTime.toLocaleString()}
            </div>
          )}
          
          <button 
            className="disconnect-btn"
            onClick={disconnectCalendar}
          >
            Disconnect Calendar
          </button>
        </div>
      )}
    </div>
  );
};

export default GoogleCalendarConnector;