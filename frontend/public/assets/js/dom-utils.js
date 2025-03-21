// dom-utils.js - Safe DOM operations

/**
 * Safely gets a DOM element by ID
 * @param {string} id - Element ID to find
 * @param {boolean} required - Whether to log a warning if element not found
 * @returns {HTMLElement|null} The element or null if not found
 */
function getElement(id, required = false) {
    const element = document.getElementById(id);
    if (!element && required) {
      console.warn(`Element with ID '${id}' not found in the DOM`);
    }
    return element;
  }
  
  /**
   * Safely gets DOM elements by selector
   * @param {string} selector - CSS selector to find elements
   * @param {boolean} required - Whether to log a warning if no elements found
   * @returns {NodeList} List of matching elements (may be empty)
   */
  function getElements(selector, required = false) {
    const elements = document.querySelectorAll(selector);
    if (elements.length === 0 && required) {
      console.warn(`No elements found matching selector '${selector}'`);
    }
    return elements;
  }
  
  /**
   * Safely adds an event listener to an element
   * @param {string} elementId - ID of the element
   * @param {string} event - Event name (e.g., 'click')
   * @param {Function} handler - Event handler function
   * @returns {boolean} Whether the listener was successfully added
   */
  function addSafeEventListener(elementId, event, handler) {
    const element = getElement(elementId);
    if (element) {
      element.addEventListener(event, handler);
      return true;
    }
    return false;
  }
  
  /**
   * Safely shows an element (removes 'hidden' class)
   * @param {string} elementId - ID of the element
   * @returns {boolean} Whether the operation was successful
   */
  function showElement(elementId) {
    const element = getElement(elementId);
    if (element) {
      element.classList.remove('hidden');
      return true;
    }
    return false;
  }
  
  /**
   * Safely hides an element (adds 'hidden' class)
   * @param {string} elementId - ID of the element
   * @returns {boolean} Whether the operation was successful
   */
  function hideElement(elementId) {
    const element = getElement(elementId);
    if (element) {
      element.classList.add('hidden');
      return true;
    }
    return false;
  }
  
  /**
   * Safely toggles an element's visibility
   * @param {string} elementId - ID of the element
   * @param {boolean} show - Whether to show or hide the element
   * @returns {boolean} Whether the operation was successful
   */
  function toggleElement(elementId, show) {
    const element = getElement(elementId);
    if (element) {
      element.classList.toggle('hidden', !show);
      return true;
    }
    return false;
  }
  
  /**
   * Safely sets inner HTML for an element with optional sanitization
   * @param {string} elementId - ID of the element
   * @param {string} html - HTML content to set
   * @param {boolean} sanitize - Whether to sanitize the HTML
   * @returns {boolean} Whether the operation was successful
   */
  function setHTML(elementId, html, sanitize = true) {
    const element = getElement(elementId);
    if (element) {
      if (sanitize) {
        // Basic sanitization - in a real app use DOMPurify or similar
        const sanitized = html.replace(/<script[^>]*>.*?<\/script>/gi, '');
        element.innerHTML = sanitized;
      } else {
        element.innerHTML = html;
      }
      return true;
    }
    return false;
  }
  
  /**
   * Safely sets text content for an element
   * @param {string} elementId - ID of the element
   * @param {string} text - Text content to set
   * @returns {boolean} Whether the operation was successful
   */
  function setText(elementId, text) {
    const element = getElement(elementId);
    if (element) {
      element.textContent = text;
      return true;
    }
    return false;
  }
  
  /**
   * Safely creates and appends an element
   * @param {string} type - Element type (e.g., 'div')
   * @param {string} parentId - ID of parent element
   * @param {Object} attributes - Attributes to set on the element
   * @param {string} content - Text content for the element
   * @returns {HTMLElement|null} The created element or null if parent not found
   */
  function createElement(type, parentId, attributes = {}, content = '') {
    const parent = getElement(parentId);
    if (!parent) return null;
    
    const element = document.createElement(type);
    
    // Set attributes
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'class' || key === 'className') {
        element.className = value;
      } else {
        element.setAttribute(key, value);
      }
    });
    
    // Set content if provided
    if (content) {
      element.textContent = content;
    }
    
    // Append to parent
    parent.appendChild(element);
    
    return element;
  }
  
  // Export all functions
  window.domUtils = {
    getElement,
    getElements,
    addSafeEventListener,
    showElement,
    hideElement,
    toggleElement,
    setHTML,
    setText,
    createElement
  };