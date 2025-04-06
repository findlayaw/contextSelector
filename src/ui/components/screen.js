/**
 * Screen component for creating and managing the UI components
 */

const blessed = require('blessed');
const stateManager = require('../state');
const keyHandlers = require('../handlers/keyHandlers');

/**
 * Create the UI components
 * @returns {Object} - Object containing all UI components
 */
function createComponents() {
  // Create a screen object
  const screen = blessed.screen({
    smartCSR: true,
    title: 'Context Selector'
  });

  // Create the file tree box
  const treeBox = blessed.list({
    top: 0,
    left: 0,
    width: '70%',
    height: '70%',
    border: {
      type: 'line'
    },
    label: ' File Explorer ',
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
      ch: ' ',
      track: {
        bg: 'cyan'
      },
      style: {
        inverse: true
      }
    },
    keys: true,
    vi: true,
    mouse: false,
    tags: true,
    style: {
      selected: {
        bg: 'blue',
        fg: 'white'
      }
    },
    items: []
  });

  // Create the info box (as a list to allow selection and navigation)
  const infoBox = blessed.list({
    top: 0,
    right: 0,
    width: '30%',
    height: '70%',
    border: {
      type: 'line'
    },
    label: ' Selected Files ',
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
      ch: ' ',
      style: {
        inverse: true
      }
    },
    keys: true,
    vi: true,
    mouse: false,
    tags: true,
    style: {
      selected: {
        bg: 'blue',
        fg: 'white'
      }
    },
    items: []
  });

  // Create the status box
  const statusBox = blessed.box({
    top: '70%', // Position directly below the file explorer/selected files
    left: 0,
    width: '100%',
    height: '30%', // Significantly increased height to ensure all controls are visible
    border: {
      type: 'line'
    },
    label: ' Status ',
    content: 'Loading...',
    tags: true,
    scrollable: true  // Added scrollable property to ensure all content is accessible
  });

  // Create the search box
  const searchBox = blessed.textbox({
    bottom: 3,
    left: 'center',
    width: '80%',
    height: 3,
    border: {
      type: 'line'
    },
    label: ' Search ',
    hidden: true,
    keys: true,
    inputOnFocus: true,
    tags: true
  });

  // Create the template name input box
  const templateNameBox = blessed.textbox({
    bottom: 3,
    left: 'center',
    width: '80%',
    height: 3,
    border: {
      type: 'line'
    },
    label: ' Save Template As ',
    hidden: true,
    keys: true,
    inputOnFocus: true,
    tags: true
  });

  // Create the confirmation dialog box
  const confirmationBox = blessed.box({
    bottom: 3,
    left: 'center',
    width: '50%',
    height: 7,
    border: {
      type: 'line'
    },
    label: ' Confirm ',
    hidden: true,
    tags: true,
    content: ''
  });

  // Create the template selection box
  const templateSelectBox = blessed.list({
    bottom: 3,
    left: 'center',
    width: '80%',
    height: '50%',
    border: {
      type: 'line'
    },
    label: ' Select Template ',
    hidden: true,
    keys: true,
    vi: true,
    tags: true,
    items: [],
    style: {
      selected: {
        bg: 'blue',
        fg: 'white'
      }
    }
  });

  // Add all elements to the screen
  screen.append(treeBox);
  screen.append(infoBox);
  screen.append(statusBox);
  screen.append(searchBox);
  screen.append(templateNameBox);
  screen.append(templateSelectBox);
  screen.append(confirmationBox);

  return {
    screen,
    treeBox,
    infoBox,
    statusBox,
    searchBox,
    templateNameBox,
    confirmationBox,
    templateSelectBox
  };
}

/**
 * Initialize the UI
 * @param {Function} resolvePromise - Function to resolve the terminal promise
 * @returns {Object} - Object containing all UI components
 */
function initializeUI(resolvePromise) {
  const components = createComponents();
  const { screen } = components;
  
  // Set focus to the tree box and update border styles
  const state = stateManager.getState();
  state.activeBox = 'treeBox';
  components.treeBox.focus();
  components.treeBox.style.border = { fg: 'green' };
  components.infoBox.style.border = { fg: 'white' };

  // Setup key handlers
  keyHandlers.setupKeyHandlers(screen, components, resolvePromise);

  // Render the screen
  screen.render();

  return components;
}

module.exports = {
  createComponents,
  initializeUI
};
