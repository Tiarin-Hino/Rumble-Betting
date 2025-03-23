// events.js - Event-related functions

// Fetch all events
async function fetchEvents() {
  try {
    const response = await fetch(API_ENDPOINTS.events);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch events');
    }

    return data.events;
  } catch (error) {
    console.error('Fetch events error:', error);
    throw error;
  }
}

// Fetch upcoming events
async function fetchUpcomingEvents() {
  try {
    const response = await fetch(API_ENDPOINTS.upcomingEvents);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch upcoming events');
    }

    return data.events;
  } catch (error) {
    console.error('Fetch upcoming events error:', error);
    throw error;
  }
}

// Fetch active events
async function fetchActiveEvents() {
  try {
    const response = await fetch(API_ENDPOINTS.activeEvents);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch active events');
    }

    return data.events;
  } catch (error) {
    console.error('Fetch active events error:', error);
    throw error;
  }
}

// Fetch finished events
async function fetchFinishedEvents() {
  try {
    const response = await fetch(API_ENDPOINTS.finishedEvents);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch finished events');
    }

    return data.events;
  } catch (error) {
    console.error('Fetch finished events error:', error);
    throw error;
  }
}

// Fetch single event by ID
async function fetchEventById(eventId) {
  try {
    const response = await fetch(`${API_ENDPOINTS.events}/${eventId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch event details');
    }

    return data.event;
  } catch (error) {
    console.error('Fetch event details error:', error);
    throw error;
  }
}

// Format event date for display
function formatEventDate(dateString) {
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

// Create event card HTML
function createEventCard(event) {
  console.log('Creating card for event:', event);

  // Determine status class
  let statusClass = '';
  switch (event.status) {
    case 'upcoming':
      statusClass = 'status-upcoming';
      break;
    case 'active':
      statusClass = 'status-active';
      break;
    case 'finished':
      statusClass = 'status-finished';
      break;
    default:
      statusClass = '';
  }

  // Create teams HTML
  let teamsHtml = '';
  if (event.options && event.options.length > 0) {
    teamsHtml += '<div class="team-list">';
    event.options.forEach(option => {
      teamsHtml += `
        <div class="team-option">
          <div class="team-name">${option.name}</div>
          <div class="team-odds">Odds: <span>${option.odds}x</span></div>
        </div>
      `;
    });
    teamsHtml += '</div>';
  }

  // Create action button based on event status
  let actionButton = '';
  if (event.status === 'upcoming' || event.status === 'active') {
    actionButton = `<button class="place-bet-btn" data-event-id="${event._id}">Place Bet</button>`;
  } else {
    actionButton = `<button class="view-results-btn" data-event-id="${event._id}">View Results</button>`;
  }

  // Complete event card HTML
  return `
    <div class="event-card" data-event-id="${event._id}">
      <div class="event-header">
        <h3>${event.title}</h3>
        <span class="event-status ${statusClass}">${event.status}</span>
      </div>
      <div class="event-content">
        <div class="event-date">${formatEventDate(event.eventDate)}</div>
        <div class="event-description">${event.description}</div>
        <div class="event-teams">
          <h4>Teams</h4>
          ${teamsHtml}
        </div>
        <div class="event-actions">
          ${actionButton}
        </div>
      </div>
    </div>
  `;
}

// Display events in the container
function displayEvents(events, containerId) {
  console.log('Displaying events in container:', containerId);
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Container not found:', containerId);
    return;
  }

  if (!events || events.length === 0) {
    container.innerHTML = '<p class="text-center">No events found</p>';
    return;
  }

  let eventsHtml = '';
  events.forEach(event => {
    try {
      eventsHtml += createEventCard(event);
    } catch (error) {
      console.error('Error creating event card:', error, event);
    }
  });

  container.innerHTML = eventsHtml;

  // Add event listeners to bet buttons
  const betButtons = container.querySelectorAll('.place-bet-btn');
  betButtons.forEach(button => {
    button.addEventListener('click', function (e) {
      e.preventDefault();
      const eventId = this.getAttribute('data-event-id');
      openPlaceBetModal(eventId);
    });
  });

  // Add event listeners to view results buttons
  const viewResultsButtons = container.querySelectorAll('.view-results-btn');
  viewResultsButtons.forEach(button => {
    button.addEventListener('click', function (e) {
      e.preventDefault();
      const eventId = this.getAttribute('data-event-id');
      openEventDetailsModal(eventId);
    });
  });
}

async function fetchAllEvents() {
  try {
    const response = await fetch(API_ENDPOINTS.events);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch events');
    }

    return data.events;
  } catch (error) {
    console.error('Fetch events error:', error);
    throw error;
  }
}

// Display upcoming events preview on home page
async function displayUpcomingEventsPreview() {
  try {
    console.log('Loading events preview...');
    const container = document.getElementById('home-events-container');
    if (!container) {
      console.error('Home events container not found!');
      return;
    }

    container.innerHTML = '<div class="loading">Loading events...</div>';

    const events = await fetchAllEvents();
    console.log('Preview events loaded:', events);

    if (!events || events.length === 0) {
      container.innerHTML = '<p class="text-center">No events available</p>';
      return;
    }

    // Create simplified event cards for home page
    let eventsHtml = '';
    events.forEach(event => {
      eventsHtml += `
        <div class="event-preview-card">
          <h3>${event.title}</h3>
          <p>${formatEventDate(event.eventDate)}</p>
          <p>${event.description}</p>
          <button class="view-event-btn" data-event-id="${event._id}">View Event</button>
        </div>
      `;
    });

    container.innerHTML = eventsHtml;

    // Add event listeners to view buttons
    container.querySelectorAll('.view-event-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        showSection('events-section');
        loadEvents();
      });
    });
  } catch (error) {
    console.error('Error displaying events preview:', error);
    const container = document.getElementById('home-events-container');
    if (container) {
      container.innerHTML = '<p class="text-center">Failed to load events</p>';
    }
  }
}

// Load events based on filter
async function loadEvents() {
  try {
    console.log('Loading events...');
    const container = document.getElementById('events-container');
    if (!container) {
      console.error('Events container not found!');
      return;
    }

    container.innerHTML = '<div class="loading">Loading events...</div>';

    const events = await fetchAllEvents();
    console.log('Events loaded:', events);

    if (!events || events.length === 0) {
      container.innerHTML = '<p class="text-center">No events found</p>';
    } else {
      displayEvents(events, 'events-container');
    }
  } catch (error) {
    console.error('Error loading events:', error);
    const container = document.getElementById('events-container');
    if (container) {
      container.innerHTML = `<p class="text-center">Error loading events: ${error.message}</p>`;
    }
  }
}

// Open bet modal for an event
async function openPlaceBetModal(eventId) {
  try {
    // Check if user is authenticated
    if (!isAuthenticated()) {
      // Open login modal if not authenticated
      document.getElementById('login-modal').style.display = 'block';
      return;
    }

    // Fetch event details
    const event = await fetchEventById(eventId);

    // Get user data
    const userData = getUserData();

    // Set up modal content
    const eventInfoContainer = document.querySelector('#place-bet-modal .event-info');
    eventInfoContainer.innerHTML = `
      <h3>${event.title}</h3>
      <p class="event-date">${formatEventDate(event.eventDate)}</p>
      <p class="event-description">${event.description}</p>
      <div class="team-selection-info">
        <p>Select a team to bet on:</p>
      </div>
    `;

    // Set event ID in hidden field
    document.getElementById('bet-event-id').value = eventId;

    // Populate betting options
    const optionsSelect = document.getElementById('bet-option');
    optionsSelect.innerHTML = '';

    // Add default empty option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Select a team --';
    optionsSelect.appendChild(defaultOption);

    // Add team options
    event.options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.name;
      optionElement.textContent = `${option.name} (${option.odds}x)`;
      optionElement.dataset.odds = option.odds;
      optionsSelect.appendChild(optionElement);
    });

    // Update user balance display
    document.getElementById('user-balance').textContent = userData.coins;

    // Calculate initial potential winnings (will be 0 until team is selected)
    updatePotentialWinnings();

    // Show modal
    document.getElementById('place-bet-modal').style.display = 'block';

  } catch (error) {
    console.error('Error opening bet modal:', error);
    alert('Failed to load event details. Please try again.');
  }
}

document.addEventListener('DOMContentLoaded', function () {
  // Create event details section if it doesn't exist
  let eventDetailsSection = document.getElementById('event-details');
  if (!eventDetailsSection) {
    console.error('Event details section not found, creating one');
    eventDetailsSection = document.createElement('section');
    eventDetailsSection.id = 'event-details';
    eventDetailsSection.className = 'hidden';
    document.body.appendChild(eventDetailsSection);
  }

  // Create the container if it doesn't exist
  if (!eventDetailsSection.querySelector('.event-details-container')) {
    const container = document.createElement('div');
    container.className = 'event-details-container';
    eventDetailsSection.appendChild(container);
  }

  // Add event listeners to all View Results buttons
  document.addEventListener('click', function (e) {
    if (e.target && e.target.classList.contains('view-results-btn')) {
      e.preventDefault();
      const eventId = e.target.getAttribute('data-event-id');
      openEventDetailsModal(eventId);
    }
  });
});

// Update potential winnings calculation
function updatePotentialWinnings() {
  const optionSelect = document.getElementById('bet-option');
  const selectedOption = optionSelect.options[optionSelect.selectedIndex];
  const odds = parseFloat(selectedOption.dataset.odds || 0);

  const amount = parseInt(document.getElementById('bet-amount').value) || 0;
  const potentialWin = Math.round(amount * odds);

  document.getElementById('potential-winnings').textContent = potentialWin;
}

// Open event details modal
function openEventDetailsModal(eventId) {
  console.log('Opening event details for:', eventId);

  // Get or create event details section
  let eventDetailsSection = document.getElementById('event-details');
  if (!eventDetailsSection) {
    console.error('Event details section not found, creating one');
    eventDetailsSection = document.createElement('section');
    eventDetailsSection.id = 'event-details';
    eventDetailsSection.className = 'hidden';
    document.body.appendChild(eventDetailsSection);
  }

  // Get or create the container
  let container = eventDetailsSection.querySelector('.event-details-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'event-details-container';
    eventDetailsSection.appendChild(container);
  }

  // Show loading state
  container.innerHTML = '<div style="text-align:center;padding:20px;">Loading event details...</div>';
  eventDetailsSection.classList.remove('hidden');

  // Fetch event data with proper error handling
  fetch(`${API_ENDPOINTS.events}/${eventId}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      if (!data || !data.event) {
        throw new Error('Invalid data format received from server');
      }

      const event = data.event;

      // Create content
      container.innerHTML = `
        <div class="event-details-card">
          <span class="close">&times;</span>
          <h2>${event.title}</h2>
          <p><strong>Date:</strong> ${formatEventDate(event.eventDate)}</p>
          <p><strong>Description:</strong> ${event.description}</p>
          ${event.result ? `<p><strong>Result:</strong> ${event.result}</p>` : ''}
          
          <h3>Options</h3>
          <ul>
            ${event.options.map(option => `
              <li>${option.name} (${option.odds}x) 
                ${event.result === option.name ? '<strong>WINNER</strong>' : ''}
              </li>
            `).join('')}
          </ul>
          
          <div style="text-align:right;margin-top:20px;">
            <button id="close-event-details" class="btn">Close</button>
          </div>
        </div>
      `;

      // Add event listeners for close buttons
      const closeButtons = container.querySelectorAll('.close, #close-event-details');
      closeButtons.forEach(button => {
        button.addEventListener('click', function () {
          eventDetailsSection.classList.add('hidden');
        });
      });
    })
    .catch(error => {
      console.error('Error fetching event:', error);
      container.innerHTML = `
        <div style="text-align:center;padding:20px;color:red;">
          <p>Error loading event details: ${error.message}</p>
          <button class="btn" onclick="document.getElementById('event-details').classList.add('hidden')">
            Close
          </button>
        </div>
      `;
    });
}

// Set up event detail modal behavior when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Create event details section if it doesn't exist
  let eventDetailsSection = document.getElementById('event-details');
  if (!eventDetailsSection) {
    console.log('Creating event details section');
    eventDetailsSection = document.createElement('section');
    eventDetailsSection.id = 'event-details';
    eventDetailsSection.className = 'hidden';
    document.body.appendChild(eventDetailsSection);
  }

  // Create the container if it doesn't exist
  let container = eventDetailsSection.querySelector('.event-details-container');
  if (!container) {
    console.log('Creating event details container');
    container = document.createElement('div');
    container.className = 'event-details-container';
    eventDetailsSection.appendChild(container);
  }

  // Delegate event handler for all view results buttons
  document.addEventListener('click', function(e) {
    if (e.target && e.target.classList.contains('view-results-btn')) {
      e.preventDefault();
      const eventId = e.target.getAttribute('data-event-id');
      openEventDetailsModal(eventId);
    }
  });
});

window.openEventDetailsModal = openEventDetailsModal;
window.fetchEventById = fetchEventById;
window.formatEventDate = formatEventDate;