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

// Get stored user data
function getUserData() {
  const userData = localStorage.getItem(USER_DATA_KEY);
  return userData ? JSON.parse(userData) : null;
}

// Save user data after login/registration (enhanced security)
function saveUserSession(data) {
  // Store only non-sensitive user data in localStorage
  const userData = {
    id: data.user.id,
    username: data.user.username,
    email: data.user.email,
    coins: data.user.coins,
    isAdmin: data.user.isAdmin,
    lastUpdated: new Date().toISOString()
  };
  
  localStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
  localStorage.setItem(AUTH_STATUS_KEY, 'true');
  
  // Store token if available (for backward compatibility)
  if (data.token) {
    localStorage.setItem(TOKEN_KEY, data.token);
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
    const response = await fetch(AUTH_ENDPOINTS.login, {
      method: 'POST',
      credentials: 'include', // Needed for cookies
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(credentials)
    });

    // Check for HTTP errors *before* parsing JSON
    if (!response.ok) {
      // Attempt to read the response as text first, in case it's an HTML error page.
      const text = await response.text();
      let errorMessage = `HTTP Error: ${response.status} ${response.statusText}`;

      // Try to parse as JSON, but handle potential errors.
      try {
          const errorData = JSON.parse(text);
          errorMessage = errorData.message || errorMessage; // Prefer server's message
      } catch (parseError) {
        // If it's not JSON, use the text we read earlier (likely HTML)
        errorMessage += `\nResponse Body: ${text}`; // Append the raw text to help debug
      }
      throw new Error(errorMessage);
    }

    // *Now* it's safe to parse as JSON, since we know it's a successful (2xx) response.
    const data = await response.json();

    // Save user session data
    saveUserSession(data);

    return data;

  } catch (error) {
    console.error('Login error:', error);
    throw error; // Re-throw the error so calling functions can handle it.
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
  const isLoggedIn = isAuthenticated();
  const userData = getUserData();
  
  // Use the safer approach from main.js improvement
  const elements = [
    { id: 'nav-mybets-container', show: isLoggedIn },
    { id: 'login-container', show: !isLoggedIn },
    { id: 'register-container', show: !isLoggedIn },
    { id: 'logout-container', show: isLoggedIn }
  ];
  
  elements.forEach(({ id, show }) => {
    const element = document.getElementById(id);
    if (element) {
      element.classList.toggle('removed', !show);
    }
  });
  
  // Update user data if logged in
  if (isLoggedIn && userData) {
    const userCoinsElements = document.querySelectorAll('#user-coins, #user-balance');
    userCoinsElements.forEach(element => {
      if (element) element.textContent = userData.coins;
    });
    
    // Add username display if needed
    if (!document.getElementById('username-display')) {
      const nav = document.querySelector('nav ul');
      const usernameItem = document.createElement('li');
      usernameItem.className = 'auth-item';
      usernameItem.innerHTML = `<span id="username-display">${userData.username} (${userData.coins} coins)</span>`;
      
      // Insert before logout
      const logoutContainer = document.getElementById('logout-container');
      if (logoutContainer && nav) {
        nav.insertBefore(usernameItem, logoutContainer);
      }
    } else {
      // Update existing display
      const display = document.getElementById('username-display');
      if (display) {
        display.textContent = `${userData.username} (${userData.coins} coins)`;
      }
    }
  }
}

// Helper function to get a secure token (for API calls)
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

window.updateAuthUI = updateAuthUI;