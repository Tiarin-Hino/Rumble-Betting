// Configuration
const AUTH_ENDPOINTS = {
  register: `${API_BASE_URL}/users/register`,
  login: `${API_BASE_URL}/users/login`,
  logout: `${API_BASE_URL}/users/logout`,
  resetPassword: `${API_BASE_URL}/users/reset-password`,
  profile: `${API_BASE_URL}/users/profile`,
  verifyAuth: `${API_BASE_URL}/users/verify-auth`
};

// Storage keys
const AUTH_STATUS_KEY = 'virtual_betting_auth_status';
const TOKEN_KEY = 'virtual_betting_token';
const USER_DATA_KEY = 'virtual_betting_user';

const DEBUG = true; // Set to false in production
function debugLog(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

// Get stored user data
function getUserData() {
  const userData = localStorage.getItem(USER_DATA_KEY);
  return userData ? JSON.parse(userData) : null;
}

// Save user data after login/registration (enhanced security)
function saveUserSession(data) {
  console.log('Saving user session data:', data); // Debug logging

  try {
    // Handle different response formats
    let userData;

    if (data.user) {
      // Format: { user: {...}, token: "..." }
      userData = {
        id: data.user.id,
        username: data.user.username,
        email: data.user.email,
        coins: data.user.coins,
        isAdmin: data.user.isAdmin,
        lastUpdated: new Date().toISOString()
      };
    } else if (data.id || data.username) {
      // Format: { id: "...", username: "...", ... }
      userData = {
        id: data.id,
        username: data.username,
        email: data.email,
        coins: data.coins,
        isAdmin: data.isAdmin,
        lastUpdated: new Date().toISOString()
      };
    } else {
      console.error('Invalid user data format:', data);
      throw new Error('Invalid user data format');
    }

    // Store user data and auth status
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
    localStorage.setItem(AUTH_STATUS_KEY, 'true');

    // Store token if available
    if (data.token) {
      localStorage.setItem(TOKEN_KEY, data.token);
    }

    console.log('User session saved successfully');
    return true;
  } catch (error) {
    console.error('Error saving user session:', error);
    return false;
  }
}

// Clear user session on logout
function clearUserSession() {
  localStorage.removeItem(USER_DATA_KEY);
  localStorage.removeItem(AUTH_STATUS_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

// Check if user is authenticated (basic check)
function isAuthenticated() {
  return localStorage.getItem(AUTH_STATUS_KEY) === 'true' && !!getUserData();
}

// Verify authentication with server (more secure)
async function verifyAuthentication() {
  try {
    // Only do the API check if locally authenticated first
    if (!isAuthenticated()) {
      return false;
    }

    const response = await fetch(AUTH_ENDPOINTS.verifyAuth, {
      method: 'GET',
      credentials: 'include', // Important for cookies
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      // Clear local auth if server says we're not authenticated
      if (response.status === 401) {
        clearUserSession();
      }
      return false;
    }

    return true;
  } catch (error) {
    console.error('Auth verification error:', error);
    return isAuthenticated(); // Fallback to local check if network error
  }
}

// Register a new user
async function registerUser(userData) {
  try {
    const response = await fetch(AUTH_ENDPOINTS.register, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    return data;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
}

// Login user (with enhanced security)
async function loginUser(credentials) {
  try {
    console.log('Attempting login with:', credentials.email);

    const response = await fetch(AUTH_ENDPOINTS.login, {
      method: 'POST',
      credentials: 'include', // For cookies
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(credentials)
    });

    // Handle non-OK responses
    if (!response.ok) {
      const text = await response.text();
      let errorMessage = `HTTP Error: ${response.status} ${response.statusText}`;

      try {
        const errorData = JSON.parse(text);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (parseError) {
        errorMessage += `\nResponse Body: ${text}`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('Login successful, response:', data);

    // Save user session
    const saved = saveUserSession(data);
    if (!saved) {
      throw new Error('Failed to save user session');
    }

    // Force UI update
    updateAuthUI();

    return data;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

// Logout user (with server-side session invalidation)
async function logoutUser() {
  try {
    // Call logout endpoint to invalidate server-side session/token
    await fetch(AUTH_ENDPOINTS.logout, {
      method: 'POST',
      credentials: 'include' // Needed for cookies
    });

    // Clear local storage regardless of server response
    clearUserSession();

    return true;
  } catch (error) {
    console.error('Logout error:', error);
    // Still clear local data even if server request fails
    clearUserSession();
    throw error;
  }
}

// Reset password
async function resetPassword(resetData) {
  try {
    const response = await fetch(AUTH_ENDPOINTS.resetPassword, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(resetData)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Password reset failed');
    }

    return data;
  } catch (error) {
    console.error('Password reset error:', error);
    throw error;
  }
}

// Get user profile (requires authentication)
async function getUserProfile() {
  try {
    // Check if authenticated first
    if (!isAuthenticated()) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(AUTH_ENDPOINTS.profile, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired or invalid, logout
        clearUserSession();
      }
      throw new Error(data.error || 'Failed to get profile');
    }

    // Update stored user data with latest from server
    const updatedUserData = {
      id: data.user.id,
      username: data.user.username,
      email: data.user.email,
      coins: data.user.coins,
      isAdmin: data.user.isAdmin,
      lastUpdated: new Date().toISOString()
    };

    localStorage.setItem(USER_DATA_KEY, JSON.stringify(updatedUserData));

    return data.user;
  } catch (error) {
    console.error('Get profile error:', error);
    throw error;
  }
}

// Update user data in localStorage (for non-sensitive updates like coin balance)
function updateUserData(updates) {
  const userData = getUserData();
  if (userData) {
    const updatedData = { ...userData, ...updates, lastUpdated: new Date().toISOString() };
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(updatedData));
    return updatedData;
  }
  return null;
}

// Update authentication UI elements
function updateAuthUI() {
  console.log('Updating authentication UI');

  const isLoggedIn = isAuthenticated();
  const userData = getUserData();

  console.log('Authentication state:', isLoggedIn, userData);

  // Update navigation items visibility
  const elements = [
    { id: 'nav-mybets-container', show: isLoggedIn },
    { id: 'login-container', show: !isLoggedIn },
    { id: 'register-container', show: !isLoggedIn },
    { id: 'logout-container', show: isLoggedIn }
  ];

  elements.forEach(({ id, show }) => {
    const element = document.getElementById(id);
    if (element) {
      console.log(`Setting ${id} visibility to ${show ? 'visible' : 'hidden'}`);

      if (show) {
        element.classList.remove('removed');
        element.classList.remove('hidden');
        element.style.display = ''; // Reset display property
      } else {
        element.classList.add('removed');
        element.style.display = 'none';
      }
    } else {
      console.warn(`Element with ID '${id}' not found`);
    }
  });

  // Update user data displays if logged in
  if (isLoggedIn && userData) {
    console.log('Updating user data displays with:', userData);

    // Update coin displays
    const userCoinsElements = document.querySelectorAll('#user-coins, #user-balance');
    userCoinsElements.forEach(element => {
      if (element) {
        element.textContent = userData.coins || 0;
        console.log(`Updated coin display: ${element.id} = ${userData.coins}`);
      }
    });

    // Add or update username display
    try {
      const usernameDisplay = document.getElementById('username-display');
      if (!usernameDisplay) {
        const nav = document.querySelector('nav ul');
        if (nav) {
          const usernameItem = document.createElement('li');
          usernameItem.className = 'auth-item';
          usernameItem.innerHTML = `<span id="username-display">${userData.username} (${userData.coins || 0} coins)</span>`;

          const logoutContainer = document.getElementById('logout-container');
          if (logoutContainer) {
            nav.insertBefore(usernameItem, logoutContainer);
            console.log('Created new username display element');
          }
        }
      } else {
        usernameDisplay.textContent = `${userData.username} (${userData.coins || 0} coins)`;
        console.log('Updated existing username display');
      }
    } catch (e) {
      console.error('Error updating username display:', e);
    }
  }
}

// Helper function to get a secure token (for API calls)
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

window.updateAuthUI = updateAuthUI;