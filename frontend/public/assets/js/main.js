// Main application logic

function isAuthenticated() {
  return localStorage.getItem('virtual_betting_auth_status') === 'true' && !!getUserData();
}

// Helper function to safely get DOM elements
function getElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    console.warn(`Element with ID '${id}' not found in the DOM`);
  }
  return element;
}

// Helper to add event listener safely
function addSafeEventListener(elementId, event, handler) {
  const element = getElement(elementId);
  if (element) {
    element.addEventListener(event, handler);
    return true;
  }
  return false;
}

// DOM elements - using getElement() instead of this.getElement()
const navHome = getElement('nav-home');
const navEvents = getElement('nav-events');
const navLeaderboard = getElement('nav-leaderboard');
const navMyBets = getElement('nav-mybets');
const loginBtn = getElement('login-btn');
const registerBtn = getElement('register-btn');
const logoutBtn = getElement('logout-btn');
const getStartedBtn = getElement('get-started-btn');

const homeSection = getElement('home-section');
const eventsSection = getElement('events-section');
const mybetsSection = getElement('mybets-section');
const leaderboardSection = getElement('leaderboard-section');

const loginModal = getElement('login-modal');
const registerModal = getElement('register-modal');
const resetModal = getElement('reset-modal');
const placeBetModal = getElement('place-bet-modal');

const loginForm = getElement('login-form');
const registerForm = getElement('register-form');
const resetFormElement = getElement('reset-form');
const placeBetForm = getElement('place-bet-form');

const switchToRegister = getElement('switch-to-register');
const switchToLogin = getElement('switch-to-login');
const forgotPassword = getElement('forgot-password');
const backToLogin = getElement('back-to-login');

const loginMessage = getElement('login-message');
const registerMessage = getElement('register-message');
const resetMessage = getElement('reset-message');
const betMessage = getElement('bet-message');

function populateLeaderboard() {
  console.log('Populating leaderboard...');
  
  const section = getElement('leaderboard-section');
  if (!section) {
    console.error('Leaderboard section not found!');
    return;
  }
  console.log('Found leaderboard section:', section);
  
  const userData = getUserData() || { username: 'Guest', coins: 0 };
  console.log('User data for leaderboard:', userData);
  
  section.innerHTML = `
    <h2>Leaderboard</h2>
    <p>Top performers based on virtual coins earned</p>
    <div class="card">
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Virtual Coins</th>
            <th>Points Bet</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>${userData.username}</td>
            <td>${userData.coins}</td>
            <td>0</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
  
  console.log('Leaderboard content set:', section.innerHTML.substring(0, 100) + '...');
}

function populateMyBets() {
  const section = getElement('mybets-section');
  if (!section) return;
  
  const userData = getUserData() || { username: 'Guest', coins: 0 };
  
  section.innerHTML = `
    <h2>My Bets</h2>
    <p>Track your betting activity and results</p>
    <div class="card">
      <div class="user-stats">
        <h3>Your Stats</h3>
        <div class="stats-container">
          <div class="stat">
            <span class="stat-value">${userData.coins}</span>
            <span class="stat-label">Coins</span>
          </div>
          <div class="stat">
            <span class="stat-value">0</span>
            <span class="stat-label">Total Bets</span>
          </div>
          <div class="stat">
            <span class="stat-value">0%</span>
            <span class="stat-label">Win Rate</span>
          </div>
        </div>
      </div>
      <p class="text-center">You haven't placed any bets yet. Go to Events to place your first bet!</p>
    </div>
  `;
}

// Function to show/hide sections
function showSection(sectionId) {
  console.log('Showing section:', sectionId);
  
  // Hide all sections first
  document.querySelectorAll('section').forEach(section => {
    section.classList.add('hidden');
  });
  
  // Show the requested section
  const section = getElement(sectionId);
  if (section) {
    section.classList.remove('hidden');
    
    // Call the appropriate loading function based on section
    if (sectionId === 'events-section') {
      loadEvents();
    } else if (sectionId === 'leaderboard-section') {
      populateLeaderboard();
    } else if (sectionId === 'mybets-section') {
      populateMyBets();
    } else if (sectionId === 'home-section') {
      displayUpcomingEventsPreview();
    }
  } else {
    console.error('Section not found:', sectionId);
  }
  
  // Update navigation highlighting
  document.querySelectorAll('nav a').forEach(link => {
    link.classList.remove('active');
  });
  
  // Find the corresponding nav item and highlight it
  const navLinks = {
    'home-section': 'nav-home',
    'events-section': 'nav-events',
    'leaderboard-section': 'nav-leaderboard',
    'mybets-section': 'nav-mybets'
  };
  
  const navId = navLinks[sectionId];
  if (navId) {
    const navLink = getElement(navId);
    if (navLink) navLink.classList.add('active');
  }
}

// Function to show a message in a form
function showMessage(messageElement, text, type) {
  messageElement.textContent = text;
  messageElement.className = `message message-${type}`;
  messageElement.classList.remove('hidden');
}

// Function to clear a message
function clearMessage(messageElement) {
  messageElement.textContent = '';
  messageElement.className = 'message hidden';
}

// Function to reset a form and its error states
function resetForm(form) {
  form.reset();
  
  // Clear error states
  form.querySelectorAll('input').forEach(input => {
    input.classList.remove('invalid');
    const errorDiv = input.nextElementSibling;
    if (errorDiv && errorDiv.className === 'error') {
      errorDiv.textContent = '';
    }
  });
}

// Function to show error on a form field
function showError(inputId, message) {
  const input = getElement(inputId);
  input.classList.add('invalid');
  
  const errorDiv = input.nextElementSibling;
  if (errorDiv && errorDiv.className === 'error') {
    errorDiv.textContent = message;
  }
}

// Function to validate an email address
function isValidEmail(email) {
  const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

// Modal functions
function openModal(modal) {
  modal.style.display = 'block';
}

function closeModal(modal) {
  modal.style.display = 'none';
}

function closeAllModals() {
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    closeModal(modal);
  });
}

function fixLeaderboard() {
  // First try to find the section
  let leaderboardSection = getElement('leaderboard-section');
  console.log('Looking for leaderboard section directly:', leaderboardSection);
  
  // If it doesn't exist, create it
  if (!leaderboardSection) {
    console.log('Creating leaderboard section');
    leaderboardSection = document.createElement('section');
    leaderboardSection.id = 'leaderboard-section';
    
    // Try to find where to append it
    const main = document.querySelector('main');
    if (main) {
      main.appendChild(leaderboardSection);
    } else {
      document.body.appendChild(leaderboardSection);
    }
  }
  
  // Get user data
  const userData = getUserData() || { username: 'Guest', coins: 0 };
  
  // Set content directly
  leaderboardSection.innerHTML = `
    <h2>Leaderboard</h2>
    <p>Top performers based on virtual coins earned</p>
    <div class="card">
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Virtual Coins</th>
            <th>Points Bet</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>${userData.username}</td>
            <td>${userData.coins}</td>
            <td>0</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
  
  // Make sure it's visible
  leaderboardSection.style.display = 'block';
  leaderboardSection.classList.remove('hidden');
  
  console.log('Leaderboard fixed, content:', leaderboardSection.innerHTML.substring(0, 100) + '...');
  return true;
}

// Initialize the application
function initApp() {
  console.log('App initializing...');
  
  // Check if user is authenticated and update UI
  updateAuthUI();
  
  // Load home page content
  displayUpcomingEventsPreview();
  
  // Navigation event listeners
  if (navHome) {
    navHome.addEventListener('click', (e) => {
      e.preventDefault();
      showSection('home-section');
    });
  }
  
  if (navEvents) {
    navEvents.addEventListener('click', (e) => {
      e.preventDefault();
      showSection('events-section');
    });
  }
  
  if (navLeaderboard) {
    navLeaderboard.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Leaderboard clicked');
      showSection('leaderboard-section');
      
      // Call our fix function after a short delay
      setTimeout(fixLeaderboard, 100);
    });
  }
  
  if (navMyBets) {
    navMyBets.addEventListener('click', (e) => {
      e.preventDefault();
      if (!isAuthenticated()) {
        openModal(loginModal);
        return;
      }
      showSection('mybets-section');
    });
  }
  
  // Get started button
  if (getStartedBtn) {
    getStartedBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      if (isAuthenticated()) {
        showSection('events-section');
      } else {
        openModal(registerModal);
      }
    });
  }
  
  // Login/Register/Logout buttons
  if (loginBtn) {
    loginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(loginModal);
    });
  }
  
  if (registerBtn) {
    registerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(registerModal);
    });
  }
  
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Clear user session
      clearUserSession();
      
      // Update UI
      updateAuthUI();
      
      // Go to home page
      showSection('home-section');
      
      alert('You have been logged out successfully.');
    });
  }
  
  // Switch between modals
  if (switchToRegister) {
    switchToRegister.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal(loginModal);
      openModal(registerModal);
    });
  }
  
  if (switchToLogin) {
    switchToLogin.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal(registerModal);
      openModal(loginModal);
    });
  }
  
  if (forgotPassword) {
    forgotPassword.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal(loginModal);
      openModal(resetModal);
    });
  }
  
  if (backToLogin) {
    backToLogin.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal(resetModal);
      openModal(loginModal);
    });
  }
  
  // Close buttons for modals
  document.querySelectorAll('.modal .close').forEach(closeBtn => {
    closeBtn.addEventListener('click', function() {
      closeModal(this.closest('.modal'));
    });
  });
  
  // Close modal when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      closeModal(e.target);
    }
  });
  
  // Event filters
  document.querySelectorAll('.event-filter').forEach(filter => {
    filter.addEventListener('click', function() {
      const filterType = this.getAttribute('data-filter');
      loadEvents(filterType);
    });
  });
  
  // Bet filters
  document.querySelectorAll('.bet-filter').forEach(filter => {
    filter.addEventListener('click', function() {
      const filterType = this.getAttribute('data-filter');
      loadMyBets(filterType);
    });
  });
  
  // Form submissions
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }
  
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  
  if (resetFormElement) {
    resetFormElement.addEventListener('submit', handleResetPassword);
  }
  
  if (placeBetForm) {
    placeBetForm.addEventListener('submit', handlePlaceBet);
  }
  
  // Place bet form calculation
  const betAmount = getElement('bet-amount');
  const betOption = getElement('bet-option');
  
  // Update potential winnings when amount or option changes
  if (betAmount && betOption) {
    betAmount.addEventListener('input', updatePotentialWinnings);
    betOption.addEventListener('change', updatePotentialWinnings);
  }
}

// Handle registration form submission
async function handleRegister(e) {
  e.preventDefault();
  
  // Get form data
  const username = getElement('register-username').value;
  const email = getElement('register-email').value;
  const password = getElement('register-password').value;
  const confirmPassword = getElement('register-confirm-password').value;
  
  // Reset form errors
  resetForm(registerForm);
  clearMessage(registerMessage);
  
  // Validate form
  let isValid = true;
  
  if (username.length < 3) {
    showError('register-username', 'Username must be at least 3 characters');
    isValid = false;
  }
  
  if (!isValidEmail(email)) {
    showError('register-email', 'Please enter a valid email address');
    isValid = false;
  }
  
  if (password.length < 8) {
    showError('register-password', 'Password must be at least 8 characters');
    isValid = false;
  }
  
  if (password !== confirmPassword) {
    showError('register-confirm-password', 'Passwords do not match');
    isValid = false;
  }
  
  if (!isValid) {
    return;
  }
  
  // Submit registration
  try {
    showMessage(registerMessage, 'Creating your account...', 'info');
    
    const response = await registerUser({
      username,
      email,
      password
    });
    
    showMessage(registerMessage, response.message || 'Registration successful!', 'success');
    
    // In a real app, you might wait before redirecting to login
    setTimeout(() => {
      closeModal(registerModal);
      openModal(loginModal);
      showMessage(loginMessage, 'Registration successful! You can now log in.', 'success');
    }, 1500);
    
  } catch (error) {
    showMessage(registerMessage, error.message || 'Registration failed. Please try again.', 'error');
  }
}

// Handle login form submission
async function handleLogin(e) {
  e.preventDefault();
  
  // Get form data
  const email = getElement('login-email').value;
  const password = getElement('login-password').value;
  
  // Reset form errors
  resetForm(loginForm);
  clearMessage(loginMessage);
  
  // Validate form
  let isValid = true;
  
  if (!isValidEmail(email)) {
    showError('login-email', 'Please enter a valid email address');
    isValid = false;
  }
  
  if (password.length < 1) {
    showError('login-password', 'Please enter your password');
    isValid = false;
  }
  
  if (!isValid) {
    return;
  }
  
  // Submit login
  try {
    showMessage(loginMessage, 'Logging in...', 'info');
    
    const response = await loginUser({
      email,
      password
    });
    
    showMessage(loginMessage, response.message || 'Login successful!', 'success');
    
    // Update UI for logged in user
    updateAuthUI();
    
    // Close modal and redirect
    setTimeout(() => {
      closeModal(loginModal);
      showSection('events-section');
    }, 1000);
    
  } catch (error) {
    showMessage(loginMessage, error.message || 'Login failed. Please check your credentials.', 'error');
  }
}

// Handle password reset form submission
async function handleResetPassword(e) {
  e.preventDefault();
  
  // Get form data
  const username = getElement('reset-username').value;
  const email = getElement('reset-email').value;
  const newPassword = getElement('reset-new-password').value;
  const confirmPassword = getElement('reset-confirm-password').value;
  
  // Reset form errors
  resetForm(resetFormElement);
  clearMessage(resetMessage);
  
  // Validate form
  let isValid = true;
  
  if (username.length < 3) {
    showError('reset-username', 'Please enter your username');
    isValid = false;
  }
  
  if (!isValidEmail(email)) {
    showError('reset-email', 'Please enter a valid email address');
    isValid = false;
  }
  
  if (newPassword.length < 8) {
    showError('reset-new-password', 'Password must be at least 8 characters');
    isValid = false;
  }
  
  if (newPassword !== confirmPassword) {
    showError('reset-confirm-password', 'Passwords do not match');
    isValid = false;
  }
  
  if (!isValid) {
    return;
  }
  
  // Submit password reset
  try {
    showMessage(resetMessage, 'Resetting password...', 'info');
    
    const response = await resetPassword({
      username,
      email,
      newPassword
    });
    
    showMessage(resetMessage, response.message || 'Password reset successful!', 'success');
    
    // Redirect to login
    setTimeout(() => {
      closeModal(resetModal);
      openModal(loginModal);
      showMessage(loginMessage, 'Password reset successful! You can now log in with your new password.', 'success');
    }, 1500);
    
  } catch (error) {
    showMessage(resetMessage, error.message || 'Password reset failed. Please check your information.', 'error');
  }
}

// Handle place bet form submission
async function handlePlaceBet(e) {
  e.preventDefault();
  
  // Check if user is authenticated
  if (!isAuthenticated()) {
    openModal(loginModal);
    return;
  }
  
  // Get form data
  const eventId = getElement('bet-event-id').value;
  const option = getElement('bet-option').value;
  const amount = parseInt(getElement('bet-amount').value);
  
  // Validate form
  let isValid = true;
  
  if (!eventId) {
    showMessage(betMessage, 'Invalid event', 'error');
    isValid = false;
  }
  
  if (!option) {
    showMessage(betMessage, 'Please select a betting option', 'error');
    isValid = false;
  }
  
  if (isNaN(amount) || amount < 10) {
    showMessage(betMessage, 'Bet amount must be at least 10 coins', 'error');
    isValid = false;
  }
  
  const userData = getUserData();
  if (amount > userData.coins) {
    showMessage(betMessage, 'Insufficient coins', 'error');
    isValid = false;
  }
  
  if (!isValid) {
    return;
  }
  
  // Place bet
  try {
    showMessage(betMessage, 'Placing your bet...', 'info');
    
    const response = await placeBet({
      eventId,
      option,
      amount
    });
    
    showMessage(betMessage, 'Bet placed successfully!', 'success');
    
    // Update UI
    updateAuthUI();
    
    // Close modal and redirect to my bets
    setTimeout(() => {
      closeModal(placeBetModal);
      showSection('mybets-section');
    }, 1500);
    
  } catch (error) {
    showMessage(betMessage, error.message || 'Failed to place bet. Please try again.', 'error');
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);