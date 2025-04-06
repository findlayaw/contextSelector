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

  // Create the prompt input box
  const promptBox = blessed.textarea({
    bottom: 0,
    left: 0,
    width: '100%',
    height: 5,
    border: {
      type: 'line'
    },
    label: ' Prompt (Enter for new line, Esc to close, Ctrl+S to Save Template) ',
    hidden: true,
    keys: true,
    mouse: true,
    inputOnFocus: true,
    tags: true,
    scrollable: true,
    vi: false,  // Disable vi keys to prevent default Enter handling
    censor: false,
    scrollbar: {
      ch: ' ',
      track: {
        bg: 'cyan'
      },
      style: {
        inverse: true
      }
    }
  });

  // Create the prompt template name input box
  const promptTemplateNameBox = blessed.textbox({
    bottom: 3,
    left: 'center',
    width: '80%',
    height: 3,
    border: {
      type: 'line'
    },
    label: ' Save Prompt Template As ',
    hidden: true,
    keys: true,
    inputOnFocus: true,
    tags: true
  });

  // Create the template loader box (container for both file and prompt templates)
  const templateLoaderBox = blessed.box({
    bottom: 3,
    left: 'center',
    width: '90%',
    height: '60%',
    border: {
      type: 'line'
    },
    label: ' Template Loader (Tab to switch lists, Enter to load, d to delete, Esc to close) ',
    hidden: true,
    tags: true
  });

  // Create the file template list (left side)
  const fileTemplateList = blessed.list({
    parent: templateLoaderBox,
    top: 1,
    left: 1,
    width: '50%-2',
    height: '100%-2',
    label: ' File Templates ',
    border: {
      type: 'line'
    },
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    scrollable: true,
    scrollbar: {
      ch: ' ',
      style: {
        inverse: true
      }
    },
    items: [],
    style: {
      selected: {
        bg: 'blue',
        fg: 'white'
      },
      border: {
        fg: 'white'
      }
    }
  });

  // Create the prompt template list (right side)
  const promptTemplateList = blessed.list({
    parent: templateLoaderBox,
    top: 1,
    right: 1,
    width: '50%-2',
    height: '100%-2',
    label: ' Prompt Templates ',
    border: {
      type: 'line'
    },
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    scrollable: true,
    scrollbar: {
      ch: ' ',
      style: {
        inverse: true
      }
    },
    items: [],
    style: {
      selected: {
        bg: 'blue',
        fg: 'white'
      },
      border: {
        fg: 'white'
      }
    }
  });

  // Add all elements to the screen
  screen.append(treeBox);
  screen.append(infoBox);
  screen.append(statusBox);
  screen.append(promptBox);
  screen.append(searchBox);
  screen.append(templateNameBox);
  screen.append(promptTemplateNameBox);
  screen.append(templateLoaderBox);
  screen.append(confirmationBox);

  return {
    screen,
    treeBox,
    infoBox,
    statusBox,
    searchBox,
    templateNameBox,
    confirmationBox,
    promptBox,
    promptTemplateNameBox,
    templateLoaderBox,
    fileTemplateList,
    promptTemplateList
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
