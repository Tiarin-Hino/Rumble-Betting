// Configuration for the frontend application

// API Configuration
const API_BASE_URL = '/api'; // Use relative URL for same-domain deployment

// Constants
const USER_TOKEN_KEY = 'virtual_betting_token';
const USER_DATA_KEY = 'virtual_betting_user';

// API Endpoints
const API_ENDPOINTS = {
  // Auth endpoints
  register: `${API_BASE_URL}/users/register`,
  login: `${API_BASE_URL}/users/login`,
  logout: `${API_BASE_URL}/users/logout`,
  resetPassword: `${API_BASE_URL}/users/reset-password`,
  profile: `${API_BASE_URL}/users/profile`,
  verifyAuth: `${API_BASE_URL}/users/verify-auth`,
  
  // Events endpoints
  events: `${API_BASE_URL}/events`,
  upcomingEvents: `${API_BASE_URL}/events/filter/upcoming`,
  activeEvents: `${API_BASE_URL}/events/filter/active`,
  finishedEvents: `${API_BASE_URL}/events/filter/finished`,
  
  // Bets endpoints
  placeBet: `${API_BASE_URL}/bets`,
  myBets: `${API_BASE_URL}/bets/my-bets`,
  activeBets: `${API_BASE_URL}/bets/my-bets/active`,
  betHistory: `${API_BASE_URL}/bets/my-bets/history`,
  cancelBet: (betId) => `${API_BASE_URL}/bets/${betId}/cancel`,
  
  // Leaderboard endpoint 
  leaderboard: `${API_BASE_URL}/users/leaderboard`
};