// Bets related functions

// Load leaderboard data
// Enhanced loadLeaderboard function with better error handling and logging
async function loadLeaderboard() {
  try {
    // Get the leaderboard section
    const leaderboardSection = document.getElementById('leaderboard-section');
    if (!leaderboardSection) {
      console.error("Leaderboard section not found!");
      return;
    }

    // Show loading state
    leaderboardSection.innerHTML = `
      <h2>Leaderboard</h2>
      <p>Top performers based on virtual coins earned</p>
      <div class="card">
        <div class="loading">Loading leaderboard data...</div>
      </div>
    `;

    // Try to fetch leaderboard data
    let users = [];

    try {
      const response = await fetch(API_ENDPOINTS.leaderboard, {
        credentials: 'include' // Include cookies for authentication
      });

      console.log('Leaderboard API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Leaderboard data received:', data);
        users = data.users || [];
      } else {
        console.warn('Failed to fetch leaderboard data from API:', response.status);
      }
    } catch (err) {
      console.error('Error fetching leaderboard data:', err);
    }

    // If API fetch failed or empty, use current user data as fallback
    if (users.length === 0) {
      console.log('Using local user data as fallback for leaderboard');

      if (isAuthenticated()) {
        const userData = getUserData();
        if (userData) {
          // Get the user's bets to calculate total bet amount
          const myBets = await fetchMyBets();
          console.log(`Using ${myBets.length} bets for leaderboard stats calculation`);

          const totalBet = myBets.reduce((sum, bet) => sum + (bet.amount || 0), 0);

          users = [{
            rank: 1,
            username: userData.username,
            coins: userData.coins,
            totalBet
          }];
        }
      }
    }

    // Create leaderboard HTML
    let leaderboardHTML = `
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
    `;

    if (users.length === 0) {
      leaderboardHTML += `<tr><td colspan="4" class="text-center">Log in to see your stats on the leaderboard!</td></tr>`;
    } else {
      users.forEach((user, index) => {
        // Add defensive coding for missing values
        const username = user.username || 'Unknown';
        const coins = user.coins || 0;
        const totalBet = user.totalBet || 0;
        const rank = user.rank || (index + 1);

        leaderboardHTML += `
          <tr>
            <td>${rank}</td>
            <td>${username}</td>
            <td>${coins}</td>
            <td>${totalBet}</td>
          </tr>
        `;
      });
    }

    leaderboardHTML += `
          </tbody>
        </table>
      </div>
    `;

    // Update the DOM
    leaderboardSection.innerHTML = leaderboardHTML;
    console.log('Leaderboard rendered successfully');

  } catch (error) {
    console.error('Error in loadLeaderboard:', error);
    const leaderboardSection = document.getElementById('leaderboard-section');
    if (leaderboardSection) {
      leaderboardSection.innerHTML = `
        <h2>Leaderboard</h2>
        <p>Top performers based on virtual coins earned</p>
        <div class="card">
          <p class="text-center">Error loading leaderboard data. Please try again later.</p>
        </div>
      `;
    }
  }
}

// Load my bets
async function loadMyBets() {
  try {
    // Get the my bets section
    const mybetsSection = document.getElementById('mybets-section');
    if (!mybetsSection) {
      console.error("My bets section not found in DOM!");
      return;
    }

    // Show loading state
    mybetsSection.innerHTML = `
      <h2>My Bets</h2>
      <p>Track your betting activity and results</p>
      <div class="card">
        <div class="loading">Loading your bets...</div>
      </div>
    `;

    // Check authentication first
    if (!isAuthenticated()) {
      mybetsSection.innerHTML = `
        <h2>My Bets</h2>
        <p>Track your betting activity and results</p>
        <div class="card">
          <p class="text-center">Please log in to view your bets.</p>
          <button id="login-from-mybets" class="btn">Login</button>
        </div>
      `;

      // Add event listener to login button
      const loginBtn = document.getElementById('login-from-mybets');
      if (loginBtn) {
        loginBtn.addEventListener('click', function () {
          const loginModal = document.getElementById('login-modal');
          if (loginModal) loginModal.style.display = 'block';
        });
      }

      return;
    }

    // Get user data for displaying stats
    const userData = getUserData();

    // Try to fetch bets with retry logic
    let bets = [];
    let retryCount = 0;

    while (retryCount < 3) {
      try {
        bets = await fetchMyBets();
        console.log(`Fetched ${bets.length} bets`);
        if (bets.length > 0) {
          console.log('First bet details:', JSON.stringify(bets[0], null, 2));
        }
        break; // Success, exit retry loop
      } catch (error) {
        console.warn(`Attempt ${retryCount + 1} failed:`, error);
        retryCount++;

        if (retryCount >= 3) {
          throw new Error('Failed to load bets after multiple attempts');
        }

        // Wait before retrying (500ms, 1000ms, etc.)
        await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
      }
    }

    // Compute user stats
    const stats = {
      totalBets: bets.length,
      activeBets: bets.filter(bet => bet.status === 'active').length,
      wonBets: bets.filter(bet => bet.status === 'won').length,
      lostBets: bets.filter(bet => bet.status === 'lost').length
    };

    // Calculate win rate
    const completedBets = stats.wonBets + stats.lostBets;
    stats.winRate = completedBets > 0 ? Math.round((stats.wonBets / completedBets) * 100) : 0;

    // Create HTML for user stats
    const statsHTML = `
      <div class="user-stats">
        <h3>Your Stats</h3>
        <div class="stats-container">
          <div class="stat">
            <span class="stat-value">${userData?.coins || 0}</span>
            <span class="stat-label">Coins</span>
          </div>
          <div class="stat">
            <span class="stat-value">${stats.totalBets}</span>
            <span class="stat-label">Total Bets</span>
          </div>
          <div class="stat">
            <span class="stat-value">${stats.winRate}%</span>
            <span class="stat-label">Win Rate</span>
          </div>
        </div>
      </div>
    `;

    // Generate content based on whether we have bets or not
    let betsHTML = '';
    if (!bets || bets.length === 0) {
      betsHTML = `
    <div class="card">
      <p class="text-center">You haven't placed any bets yet. Go to Events to place your first bet!</p>
    </div>
  `;
    } else {
      console.log(`Creating HTML for ${bets.length} bets`);
      betsHTML = `<div class="bets-list">`;
      bets.forEach((bet, index) => {
        console.log(`Rendering bet ${index + 1}/${bets.length}`);
        try {
          const betCardHTML = createBetCard(bet);
          betsHTML += betCardHTML;
        } catch (err) {
          console.error(`Error creating bet card for bet ${index}:`, err, bet);
          betsHTML += `<div class="bet-card error">Error rendering bet</div>`;
        }
      });
      betsHTML += `</div>`;
    }

    // Update the DOM
    mybetsSection.innerHTML = `
  <h2>My Bets</h2>
  <p>Track your betting activity and results</p>
  <div class="card">
    ${statsHTML}
  </div>
  ${betsHTML}
`;

    // Add event listeners
    const goToEventsBtn = document.getElementById('go-to-events-btn');
    if (goToEventsBtn) {
      goToEventsBtn.addEventListener('click', function () {
        showSection('events-section');
      });
    }

    // Add event listeners to cancel buttons
    document.querySelectorAll('.cancel-bet-btn').forEach(button => {
      button.addEventListener('click', handleCancelBet);
    });

  } catch (error) {
    console.error('Error in loadMyBets:', error);

    // Show error state
    const mybetsSection = document.getElementById('mybets-section');
    if (mybetsSection) {
      mybetsSection.innerHTML = `
        <h2>My Bets</h2>
        <p>Track your betting activity and results</p>
        <div class="card">
          <p class="text-center text-danger">
            <i class="fas fa-exclamation-circle"></i> 
            Error loading your bets: ${error.message}
          </p>
          <div class="text-center">
            <button id="retry-load-bets" class="btn">Try Again</button>
          </div>
        </div>
      `;

      // Add retry button event listener
      const retryBtn = document.getElementById('retry-load-bets');
      if (retryBtn) {
        retryBtn.addEventListener('click', loadMyBets);
      }
    }
  }
}

// Place a bet
async function placeBet(betData) {
  try {
    console.log('Placing bet with data:', betData);

    // Make the API request with proper error handling
    const response = await fetch(API_ENDPOINTS.placeBet, {
      method: 'POST',
      credentials: 'include', // Include cookies for authentication
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(betData)
    });

    // First handle non-OK responses
    if (!response.ok) {
      // Try to parse error message from JSON
      let errorMsg = `Error ${response.status}`;

      // Check content type to handle HTML errors
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        const html = await response.text();
        throw new Error('Server returned HTML instead of JSON. The server might be experiencing issues.');
      }

      // Try to get a JSON error message
      try {
        const errorData = await response.json();
        errorMsg = errorData.error || errorData.message || errorMsg;
      } catch (jsonError) {
        // If not JSON, get text
        const errorText = await response.text();
        errorMsg = errorText || errorMsg;
      }

      throw new Error(errorMsg);
    }

    // Parse the successful response
    const data = await response.json();

    // Update user coins in local storage
    if (data.userCoins !== undefined) {
      updateUserData({ coins: data.userCoins });
    }

    return data;
  } catch (error) {
    console.error('Place bet error:', error);
    throw error;
  }
}

// Handle place bet form submission
// Prevent multiple submissions
let isPlacingBet = false;

async function handlePlaceBet(e) {
  e.preventDefault();
  console.log('Place bet form submitted');

  // Prevent duplicate submissions
  if (isPlacingBet) {
    console.log('Already processing bet, preventing duplicate');
    return;
  }

  isPlacingBet = true;

  // Disable submit button
  const submitButton = e.target.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.innerHTML = 'Processing...';
  }

  try {
    // Check if user is authenticated
    if (!isAuthenticated()) {
      openModal(loginModal);
      return;
    }

    // Get form data
    const eventId = document.getElementById('bet-event-id').value;
    const selection = document.getElementById('bet-option').value;
    const amount = parseInt(document.getElementById('bet-amount').value);

    // Get the bet message element
    const betMessage = document.getElementById('bet-message');

    // Reset message
    if (betMessage) {
      betMessage.className = 'message hidden';
    }

    // Validate form
    let isValid = true;

    if (!eventId) {
      showMessage(betMessage, 'Invalid event', 'error');
      isValid = false;
    }

    if (!selection) {
      showMessage(betMessage, 'Please select a betting option', 'error');
      isValid = false;
    }

    if (isNaN(amount) || amount < 10) {
      showMessage(betMessage, 'Bet amount must be at least 10 coins', 'error');
      isValid = false;
    }

    const userData = getUserData();
    if (!userData || amount > userData.coins) {
      showMessage(betMessage, 'Insufficient coins', 'error');
      isValid = false;
    }

    if (!isValid) {
      return;
    }

    // Place bet
    showMessage(betMessage, 'Placing your bet...', 'info');

    console.log('Sending bet request:', { eventId, selection, amount });
    const result = await placeBet({
      eventId,
      selection,
      amount
    });

    console.log('Bet placed successfully:', result);
    showMessage(betMessage, 'Bet placed successfully!', 'success');

    // Update user coins
    if (result.userCoins !== undefined) {
      updateUserData({ coins: result.userCoins });
      updateAuthUI();
    }

    // Close modal and redirect to my bets
    setTimeout(() => {
      closeModal(document.getElementById('place-bet-modal'));
      showSection('mybets-section');
      loadMyBets(); // Reload bets to include the new one
    }, 1500);

  } catch (error) {
    console.error('Bet placement error:', error);
    const betMessage = document.getElementById('bet-message');
    showMessage(betMessage, error.message || 'Failed to place bet. Please try again.', 'error');
  } finally {
    // Reset state after delay
    setTimeout(() => {
      isPlacingBet = false;

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = 'Place Bet';
      }
    }, 2000);
  }
}

// Fetch user's bets
async function fetchMyBets() {
  try {
    console.log('Fetching user bets...');

    // First verify authentication status
    if (!isAuthenticated()) {
      console.warn('User not authenticated when trying to fetch bets');
      return [];
    }

    // Get auth token (if your implementation uses it)
    const token = localStorage.getItem('virtual_betting_token');

    console.log('Making request to:', API_ENDPOINTS.myBets);
    const response = await fetch(API_ENDPOINTS.myBets, {
      method: 'GET',
      credentials: 'include', // Include cookies for authentication
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // Include token in header if your backend expects it
        'Authorization': token ? `Bearer ${token}` : ''
      }
    });

    console.log('Bets API response status:', response.status);

    // Handle non-OK responses before trying to parse JSON
    if (!response.ok) {
      // Check content type to handle HTML error pages
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        throw new Error(`Server returned HTML instead of JSON (status ${response.status})`);
      }

      // Try to get error message from JSON
      const errorData = await response.json();
      throw new Error(errorData.error || `API Error (${response.status})`);
    }

    // Parse the JSON response
    const data = await response.json();
    console.log('RAW API Response:', JSON.stringify(data));
    console.log('Bets received:', data.bets ? data.bets.length : 0);

    // Verify the structure of the returned data
    if (!data.bets || !Array.isArray(data.bets)) {
      console.warn('API returned unexpected data structure:', data);
      return [];
    }

    // Log the first bet to see its structure
    if (data.bets.length > 0) {
      console.log('First bet structure:', JSON.stringify(data.bets[0], null, 2));
    }

    return data.bets;
  } catch (error) {
    console.error('Error fetching user bets:', error);
    // Return empty array instead of throwing to prevent UI disruption
    return [];
  }
}

// Fetch user's active bets
async function fetchActiveBets() {
  try {
    if (!isAuthenticated()) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(API_ENDPOINTS.activeBets, {
      method: 'GET',
      credentials: 'include', // Important for cookies
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch active bets');
    }

    return data.bets;
  } catch (error) {
    console.error('Fetch active bets error:', error);
    throw error;
  }
}

// Fetch user's betting history
async function fetchBetHistory() {
  try {
    if (!isAuthenticated()) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(API_ENDPOINTS.betHistory, {
      method: 'GET',
      credentials: 'include', // Important for cookies
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch bet history');
    }

    return data.bets;
  } catch (error) {
    console.error('Fetch bet history error:', error);
    throw error;
  }
}

// Cancel a bet
async function cancelBet(betId) {
  try {
    if (!isAuthenticated()) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(API_ENDPOINTS.cancelBet(betId), {
      method: 'POST',
      credentials: 'include', // Important for cookies
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to cancel bet');
    }

    // Update user coins
    updateUserData({ coins: data.userCoins });

    return data;
  } catch (error) {
    console.error('Cancel bet error:', error);
    throw error;
  }
}

// Create bet card HTML
function createBetCard(bet) {
  // Add defensive coding to handle missing data
  if (!bet) {
    console.error('Cannot create bet card for undefined bet');
    return '<div class="bet-card error">Invalid bet data</div>';
  }

  console.log('Creating bet card with data:', bet);

  // Determine status class
  let statusClass = '';
  let statusLabel = '';

  switch (bet.status) {
    case 'active':
      statusClass = 'status-active';
      statusLabel = 'Active';
      break;
    case 'won':
      statusClass = 'status-won';
      statusLabel = 'Won';
      break;
    case 'lost':
      statusClass = 'status-lost';
      statusLabel = 'Lost';
      break;
    case 'cancelled':
      statusClass = 'status-cancelled';
      statusLabel = 'Cancelled';
      break;
    default:
      statusClass = '';
      statusLabel = bet.status || 'Unknown';
  }

  // Format dates - with defensive coding
  const betDate = bet.createdAt ? new Date(bet.createdAt) : new Date();
  const formattedBetDate = betDate.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Event details - with defensive coding
  const eventId = bet.eventId || {};
  const eventTitle = eventId.title || 'Unknown Event';
  const eventDate = eventId.eventDate
    ? formatEventDate(eventId.eventDate)
    : 'Date not available';

  // Format potential win - with defensive coding
  const potentialWin = (bet.potentialWin || 0).toLocaleString();
  const amount = (bet.amount || 0).toLocaleString();
  const odds = bet.odds || '0';
  const selection = bet.option || bet.selection || 'Unknown Selection';

  return `
    <div class="bet-card" data-bet-id="${bet._id || ''}">
      <div class="bet-header">
        <h3>${eventTitle}</h3>
        <span class="bet-status ${statusClass}">${statusLabel}</span>
      </div>
      <div class="bet-content">
        <div class="bet-detail">
          <span>Your Pick:</span>
          <strong>${selection}</strong>
        </div>
        <div class="bet-detail">
          <span>Amount:</span>
          <strong>${amount} coins</strong>
        </div>
        <div class="bet-detail">
          <span>Odds:</span>
          <strong>${odds}x</strong>
        </div>
        <div class="bet-detail">
          <span>Potential Win:</span>
          <strong>${potentialWin} coins</strong>
        </div>
        <div class="bet-detail">
          <span>Event Date:</span>
          <span>${eventDate}</span>
        </div>
        <div class="bet-detail">
          <span>Bet Placed:</span>
          <span>${formattedBetDate}</span>
        </div>
      </div>
    </div>
  `;
}

// Helper function to format event date
function formatEventDate(dateString) {
  if (!dateString) return 'Date not available';

  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Display bets in container
function displayBets(bets, containerId) {
  const container = document.querySelector(containerId || '.mybets-container');
  if (!container) return;

  if (!bets || bets.length === 0) {
    container.innerHTML = '<p class="text-center">No bets found</p>';
    return;
  }

  let betsHtml = '';
  bets.forEach(bet => {
    betsHtml += createBetCard(bet);
  });

  container.innerHTML = betsHtml;

  // Add event listeners to cancel buttons
  const cancelButtons = container.querySelectorAll('.cancel-bet-btn');
  cancelButtons.forEach(button => {
    button.addEventListener('click', async function (e) {
      e.preventDefault();

      if (confirm('Are you sure you want to cancel this bet? You will be refunded your bet amount.')) {
        const betId = this.getAttribute('data-bet-id');
        try {
          const result = await cancelBet(betId);

          // Update user stats display
          updateUserStatsDisplay();

          // Remove bet card from display
          const betCard = this.closest('.bet-card');
          if (betCard) {
            betCard.remove();
          }

          alert(`Bet cancelled successfully! ${result.refundAmount} coins have been refunded.`);

          // Check if there are no more bets
          if (container.querySelectorAll('.bet-card').length === 0) {
            container.innerHTML = '<p class="text-center">No bets found</p>';
          }
        } catch (error) {
          alert(`Failed to cancel bet: ${error.message}`);
        }
      }
    });
  });
}

// Calculate user betting stats
async function calculateUserStats() {
  try {
    // Fetch all user bets if we don't already have them
    const allBets = await fetchMyBets();
    console.log(`Calculating stats for ${allBets.length} bets`);

    if (!allBets || allBets.length === 0) {
      return {
        totalBets: 0,
        activeBets: 0,
        wonBets: 0,
        lostBets: 0,
        winRate: 0
      };
    }

    // Count different bet types
    const activeBets = allBets.filter(bet => bet.status === 'active').length;
    const wonBets = allBets.filter(bet => bet.status === 'won').length;
    const lostBets = allBets.filter(bet => bet.status === 'lost').length;
    const completedBets = wonBets + lostBets;

    // Calculate win rate
    const winRate = completedBets > 0 ? Math.round((wonBets / completedBets) * 100) : 0;

    console.log(`Stats calculated: ${allBets.length} total, ${activeBets} active, ${wonBets} won, ${lostBets} lost, ${winRate}% win rate`);

    return {
      totalBets: allBets.length,
      activeBets,
      wonBets,
      lostBets,
      winRate
    };
  } catch (error) {
    console.error('Calculate user stats error:', error);
    return {
      totalBets: 0,
      activeBets: 0,
      wonBets: 0,
      lostBets: 0,
      winRate: 0
    };
  }
}

// Update user stats display
async function updateUserStatsDisplay() {
  try {
    const userData = getUserData();
    if (!userData) return;

    // Update coins display
    const userCoinsElement = document.getElementById('user-coins');
    if (userCoinsElement) {
      userCoinsElement.textContent = userData.coins;
    }

    // Get betting stats
    const stats = await calculateUserStats();

    // Update total bets display
    const totalBetsElement = document.getElementById('total-bets');
    if (totalBetsElement) {
      totalBetsElement.textContent = stats.totalBets;
    }

    // Update win rate display
    const winRateElement = document.getElementById('win-rate');
    if (winRateElement) {
      winRateElement.textContent = `${stats.winRate}%`;
    }

  } catch (error) {
    console.error('Update user stats display error:', error);
  }
}