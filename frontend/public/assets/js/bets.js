// Bets related functions
function isAuthenticated() {}
function getUserData() {}

// Load leaderboard data
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

    // Fetch leaderboard data from API with credentials
    let users = [];
    try {
      const response = await fetch(API_ENDPOINTS.leaderboard, {
        credentials: 'include' // This allows cookies to be sent with the request
      });

      if (response.ok) {
        const data = await response.json();
        users = data.users;
      } else {
        // Fallback to local user if API fails
        if (isAuthenticated()) {
          const userData = getUserData();
          users = [{
            rank: 1,
            username: userData.username,
            coins: userData.coins,
            totalBet: 0
          }];

          // Try to get bet data
          const myBets = await fetchMyBets();
          if (myBets && myBets.length > 0) {
            users[0].totalBet = myBets.reduce((sum, bet) => sum + bet.amount, 0);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
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
      users.forEach(user => {
        leaderboardHTML += `
          <tr>
            <td>${user.rank}</td>
            <td>${user.username}</td>
            <td>${user.coins}</td>
            <td>${user.totalBet}</td>
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
    // Get the my bets section directly
    const mybetsSection = document.getElementById('mybets-section');
    if (!mybetsSection) {
      console.error("My bets section not found!");
      return;
    }

    // Clear and add loading message
    mybetsSection.innerHTML = `
      <h2>My Bets</h2>
      <p>Track your betting activity and results</p>
      <div class="card">
        <div class="loading">Loading your bets...</div>
      </div>
    `;

    // Check authentication
    if (!isAuthenticated()) {
      mybetsSection.innerHTML = `
        <h2>My Bets</h2>
        <p>Track your betting activity and results</p>
        <div class="card">
          <p class="text-center">Please log in to view your bets.</p>
        </div>
      `;
      return;
    }

    // Get user data and bets
    const userData = getUserData();
    let betsHtml = '';

    try {
      const bets = await fetchMyBets();

      // Get user stats
      const stats = await calculateUserStats();

      let statsHtml = `
        <div class="user-stats card">
          <h3>Your Stats</h3>
          <div class="stats-container">
            <div class="stat">
              <span class="stat-value">${userData.coins}</span>
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

      // Generate bets content
      if (!bets || bets.length === 0) {
        betsHtml = `
          <div class="card">
            <p class="text-center">You have no bets yet. Go to Events to place your first bet!</p>
          </div>
        `;
      } else {
        betsHtml = `<div class="bets-list">`;
        bets.forEach(bet => {
          betsHtml += createBetCard(bet);
        });
        betsHtml += `</div>`;
      }

      // Put it all together
      mybetsSection.innerHTML = `
        <h2>My Bets</h2>
        <p>Track your betting activity and results</p>
        ${statsHtml}
        ${betsHtml}
      `;

      // Add event listeners to cancel buttons after rendering
      document.querySelectorAll('.cancel-bet-btn').forEach(button => {
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
              if (document.querySelectorAll('.bet-card').length === 0) {
                document.querySelector('.bets-list').innerHTML = '<p class="text-center">No bets found</p>';
              }
            } catch (error) {
              alert(`Failed to cancel bet: ${error.message}`);
            }
          }
        });
      });

    } catch (err) {
      mybetsSection.innerHTML = `
        <h2>My Bets</h2>
        <p>Track your betting activity and results</p>
        <div class="card">
          <p class="text-center">Error loading your bets: ${err.message}. Please try again later.</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error in loadMyBets:', error);
    const mybetsSection = document.getElementById('mybets-section');
    if (mybetsSection) {
      mybetsSection.innerHTML = `
        <h2>My Bets</h2>
        <p>Track your betting activity and results</p>
        <div class="card">
          <p class="text-center">Error loading bets: ${error.message}</p>
        </div>
      `;
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
async function handlePlaceBet(e) {
  e.preventDefault();
  
  // Check if user is authenticated
  if (!isAuthenticated()) {
    openModal(loginModal);
    return;
  }
  
  // Get form data
  const eventId = document.getElementById('bet-event-id').value;
  const option = document.getElementById('bet-option').value;
  const amount = parseInt(document.getElementById('bet-amount').value);
  
  // Get the bet message element for feedback
  const betMessage = document.getElementById('bet-message');
  if (betMessage) {
    betMessage.className = 'message hidden';
  }
  
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
  
  // Disable the button to prevent multiple submissions
  const placeBetBtn = document.querySelector('#place-bet-form button[type="submit"]');
  if (placeBetBtn) {
    placeBetBtn.disabled = true;
    placeBetBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
  }
  
  // Place bet
  try {
    showMessage(betMessage, 'Placing your bet...', 'info');
    
    const result = await placeBet({
      eventId,
      selection: option, // Use selection field name
      amount
    });
    
    console.log('Bet placement successful:', result);
    showMessage(betMessage, 'Bet placed successfully!', 'success');
    
    // Update UI
    updateAuthUI();
    
    // Close modal and redirect to my bets
    setTimeout(() => {
      closeModal(document.getElementById('place-bet-modal'));
      showSection('mybets-section');
      loadMyBets(); // Reload bets to include the new one
    }, 1500);
    
  } catch (error) {
    console.error('Bet placement handling error:', error);
    showMessage(betMessage, error.message || 'Failed to place bet. Please try again.', 'error');
  } finally {
    // Re-enable the button
    if (placeBetBtn) {
      placeBetBtn.disabled = false;
      placeBetBtn.innerHTML = 'Place Bet';
    }
  }
}

// Fetch user's bets
async function fetchMyBets() {
  try {
    if (!isAuthenticated()) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(API_ENDPOINTS.myBets, {
      method: 'GET',
      credentials: 'include', // Important for cookies
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch bets');
    }

    return data.bets;
  } catch (error) {
    console.error('Fetch my bets error:', error);
    throw error;
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
      statusLabel = bet.status;
  }

  // Format dates
  const betDate = new Date(bet.createdAt);
  const formattedBetDate = betDate.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Event details
  const eventTitle = bet.eventId ? bet.eventId.title : 'Unknown Event';
  const eventDate = bet.eventId && bet.eventId.eventDate
    ? formatEventDate(bet.eventId.eventDate)
    : 'Date not available';

  // Format potential win
  const potentialWin = bet.potentialWin.toLocaleString();

  // Create cancel button for active bets on upcoming events
  let cancelButton = '';
  if (bet.status === 'active' && bet.eventId && bet.eventId.status === 'upcoming') {
    cancelButton = `<button class="btn-danger cancel-bet-btn" data-bet-id="${bet._id}">Cancel Bet</button>`;
  }

  return `
    <div class="bet-card" data-bet-id="${bet._id}">
      <div class="bet-header">
        <h3>${eventTitle}</h3>
        <span class="bet-status ${statusClass}">${statusLabel}</span>
      </div>
      <div class="bet-content">
        <div class="bet-detail">
          <span>Your Pick:</span>
          <strong>${bet.option || bet.selection}</strong>
        </div>
        <div class="bet-detail">
          <span>Amount:</span>
          <strong>${bet.amount} coins</strong>
        </div>
        <div class="bet-detail">
          <span>Odds:</span>
          <strong>${bet.odds}x</strong>
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
        ${cancelButton ? `<div class="bet-actions">${cancelButton}</div>` : ''}
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
    // Fetch all user bets
    const allBets = await fetchMyBets();

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