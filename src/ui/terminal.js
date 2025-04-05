const blessed = require('blessed');
const path = require('path');
const fileSystem = require('../simpleFileSystem');
const search = require('../utils/search');
const tokenCounter = require('../utils/tokenCounter');
const templateManager = require('../templates/manager');

// Store the currently selected files
let selectedFiles = [];
let directoryTree = null;
let tokenCount = 0;

// Store expanded directories
let expandedDirs = new Set();

// Store search state
let isSearchActive = false;
let searchResults = [];
let originalTree = null;

/**
 * Start the terminal UI
 * @param {Object} options - UI options
 * @returns {Promise<Object>} - Result with selected files and other data
 */
async function start(options) {
  return new Promise(async (resolve, reject) => {
    try {
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
        height: '80%',
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

      // Create the info box
      const infoBox = blessed.box({
        top: 0,
        right: 0,
        width: '30%',
        height: '80%',
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
        tags: true
      });

      // Create the status box
      const statusBox = blessed.box({
        bottom: 0,
        left: 0,
        width: '100%',
        height: '20%',
        border: {
          type: 'line'
        },
        label: ' Status ',
        content: 'Loading...',
        tags: true
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

      // Load the directory tree
      directoryTree = await fileSystem.getDirectoryTree(options.startDir);

      if (directoryTree) {
        // Expand the root directory by default
        if (directoryTree.type === 'directory') {
          expandedDirs.add(directoryTree.path);
        }

        // Render the tree
        renderTree(treeBox, directoryTree);
      } else {
        console.error('Failed to load directory tree');
      }

      // Update status
      updateStatus(statusBox);

      // If a template was specified, load it
      if (options.template) {
        const template = await templateManager.loadTemplate(options.template);
        if (template && template.files) {
          selectedFiles = template.files;
          updateSelectedFiles(infoBox);
          updateTokenCount();
          updateStatus(statusBox);
        }
      }

      // If a search query was specified, perform search
      if (options.searchQuery) {
        const results = search.searchFiles(directoryTree, options.searchQuery);
        // Initial search from options, don't preserve selection
        displaySearchResults(treeBox, results, false);
        updateStatus(statusBox, true);
      }

      // Handle key events
      screen.key(['q', 'C-c'], () => {
        screen.destroy();
        resolve({ selectedFiles: [], directoryTree: null, tokenCount: 0 });
      });

      screen.key('enter', () => {
        const node = getCurrentNode(treeBox);
        if (!node) return;

        if (isSearchActive) {
          // In search mode, enter only handles directory navigation
          const selectedResult = searchResults[treeBox.selected];
          if (selectedResult && selectedResult.type === 'directory') {
            // Exit search mode and navigate to the directory
            isSearchActive = false;
            searchResults = [];
            renderTree(treeBox, originalTree);

            // Expand the directory and all its parents
            let currentPath = selectedResult.path;
            while (currentPath !== directoryTree.path) {
              expandedDirs.add(currentPath);
              currentPath = path.dirname(currentPath);
            }

            renderTree(treeBox, originalTree);
            updateStatus(statusBox);
          }
        } else {
          // Normal mode - toggle directory expansion
          if (node.type === 'directory') {
            toggleDirectory(treeBox, node);
          }
        }

        screen.render();
      });

      screen.key('space', () => {
        if (isSearchActive) {
          // In search mode, get the selected result
          const selectedResult = searchResults[treeBox.selected];
          if (selectedResult) {
            if (selectedResult.type === 'file') {
              // Toggle selection for the file
              toggleFileSelection(selectedResult);
            } else if (selectedResult.type === 'directory') {
              // Select all files in the directory
              selectAllFilesInDirectory(selectedResult);
            }
            updateSelectedFiles(infoBox);
            updateTokenCount();
            updateStatus(statusBox, true);

            // Update the display to show the selection, preserving the current selection position
            displaySearchResults(treeBox, searchResults, true);
            screen.render();
          }
        } else {
          // Normal mode
          const node = getCurrentNode(treeBox);
          if (!node) return;

          if (node.type === 'file') {
            toggleFileSelection(node);
          } else if (node.type === 'directory') {
            // Select all files in the directory
            selectAllFilesInDirectory(node);
          }
          updateSelectedFiles(infoBox);
          updateTokenCount();
          updateStatus(statusBox);
          renderTree(treeBox, directoryTree);
          screen.render();
        }
      });

      screen.key('/', () => {
        searchBox.hidden = false;
        searchBox.focus();
        screen.render();
      });

      screen.key('t', () => {
        showTemplateSelection(templateSelectBox);
        screen.render();
      });

      screen.key('s', () => {
        if (selectedFiles.length > 0) {
          templateNameBox.hidden = false;
          templateNameBox.focus();
          screen.render();
        }
      });

      screen.key('c', () => {
        if (selectedFiles.length > 0) {
          screen.destroy();
          resolve({
            selectedFiles,
            directoryTree,
            tokenCount,
            saveTemplate: null
          });
        }
      });

      // Handle search box events
      searchBox.key(['escape', 'C-c'], () => {
        searchBox.hidden = true;
        treeBox.focus();
        screen.render();
      });

      searchBox.key('enter', () => {
        const query = searchBox.getValue();
        searchBox.hidden = true;
        treeBox.focus();

        if (query) {
          const results = search.searchFiles(directoryTree, query);
          // Initial display of search results, don't preserve selection
          displaySearchResults(treeBox, results, false);
          updateStatus(statusBox, true);
        }

        screen.render();
      });

      // Handle escape key to exit search mode
      screen.key('escape', () => {
        if (isSearchActive) {
          // Exit search mode and restore the original tree
          isSearchActive = false;
          searchResults = [];
          renderTree(treeBox, originalTree);
          updateStatus(statusBox);
          screen.render();
        } else {
          // Regular escape behavior (quit)
          screen.destroy();
          resolve({ selectedFiles: [], directoryTree: null, tokenCount: 0 });
        }
      });

      // Handle template name box events
      templateNameBox.key(['escape', 'C-c'], () => {
        templateNameBox.hidden = true;
        treeBox.focus();
        screen.render();
      });

      templateNameBox.key('enter', () => {
        const templateName = templateNameBox.getValue();
        templateNameBox.hidden = true;
        treeBox.focus();

        if (templateName) {
          screen.destroy();
          resolve({
            selectedFiles,
            directoryTree,
            tokenCount,
            saveTemplate: templateName
          });
        } else {
          screen.render();
        }
      });

      // Handle template selection box events
      templateSelectBox.key(['escape', 'C-c'], () => {
        templateSelectBox.hidden = true;
        treeBox.focus();
        screen.render();
      });

      templateSelectBox.on('select', async (item) => {
        const templateName = item.content;
        templateSelectBox.hidden = true;
        treeBox.focus();

        const template = await templateManager.loadTemplate(templateName);
        if (template && template.files) {
          selectedFiles = template.files;
          updateSelectedFiles(infoBox);
          updateTokenCount();
          updateStatus(statusBox);
        }

        screen.render();
      });

      // Set focus to the tree box
      treeBox.focus();

      // Render the screen
      screen.render();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Render the directory tree in the tree box
 * @param {Object} box - Blessed box to render in
 * @param {Object} tree - Directory tree to render
 */
function renderTree(box, tree) {
  if (!tree) {
    return;
  }

  // Reset the flattened tree
  flattenedTree = [];

  // Build the flattened tree
  flattenTree(tree, true);

  // Create the list items
  const items = flattenedTree.map(node => {
    const level = node.path.split('/').length - 1;
    const indent = '  '.repeat(level);
    const isExpanded = node === tree || isNodeExpanded(node);
    const prefix = node.type === 'directory' ? (isExpanded ? '▼ ' : '▶ ') : '  ';
    // Use a different approach for coloring
    const selected = isFileSelected(node) ? '✓ ' : '  ';
    const name = node.name + (node.type === 'directory' ? '/' : '');

    // If the node is selected, wrap the checkmark with color tags
    if (isFileSelected(node)) {
      return `${indent}${prefix}{green-fg}${selected}{/green-fg}${name}`;
    } else {
      return `${indent}${prefix}${selected}${name}`;
    }
  });

  // Set the items in the list
  box.setItems(items);

  // Preserve the current selection if possible
  if (box.selected >= items.length) {
    box.select(0);
  }

  // Scroll to the top
  box.scrollTo(0);
}

// Removed renderNode function as it's no longer needed with the list-based approach

/**
 * Check if a node is expanded
 * @param {Object} node - Node to check
 * @returns {boolean} - True if the node is expanded
 */
function isNodeExpanded(node) {
  if (!node || node.type !== 'directory') return false;
  return expandedDirs.has(node.path);
}

/**
 * Toggle a directory's expanded state
 * @param {Object} box - Blessed box containing the tree
 * @param {Object} node - Directory node to toggle
 */
function toggleDirectory(box, node) {
  if (!node || node.type !== 'directory') return;

  if (expandedDirs.has(node.path)) {
    expandedDirs.delete(node.path);
  } else {
    expandedDirs.add(node.path);
  }

  renderTree(box, directoryTree);
}

// Store the flattened tree for node lookup
let flattenedTree = [];

/**
 * Flatten the tree for easier node lookup
 * @param {Object} node - Node to flatten
 * @param {boolean} isRoot - Whether this is the root node
 */
function flattenTree(node, isRoot = false) {
  if (!node) return;

  flattenedTree.push(node);

  const isExpanded = isRoot || isNodeExpanded(node);

  if (node.type === 'directory' && isExpanded && node.children && node.children.length > 0) {
    for (const child of node.children) {
      flattenTree(child, false);
    }
  }
}

/**
 * Get the node at the current cursor position
 * @param {Object} box - Blessed box containing the tree
 * @returns {Object} - The node at the cursor position
 */
function getCurrentNode(box) {
  // Get the selected line index
  const selectedIndex = box.selected || 0;

  // Return the node at the selected index, or null if out of bounds
  return selectedIndex < flattenedTree.length ? flattenedTree[selectedIndex] : null;
}

/**
 * Toggle selection of a file
 * @param {Object} node - File node to toggle
 */
function toggleFileSelection(node) {
  const index = selectedFiles.findIndex(f => f.path === node.path);

  if (index === -1) {
    selectedFiles.push(node);
  } else {
    selectedFiles.splice(index, 1);
  }
}

/**
 * Check if all files in a directory and its subdirectories are selected
 * @param {Object} node - Directory node to check
 * @returns {boolean} - True if all files are selected, false otherwise
 */
function areAllFilesInDirectorySelected(node) {
  if (!node || node.type !== 'directory') return false;

  // If there are no children, consider it not fully selected
  if (!node.children || node.children.length === 0) return false;

  // Check all children
  for (const child of node.children) {
    if (child.type === 'file') {
      // If any file is not selected, return false
      if (!isFileSelected(child)) {
        return false;
      }
    } else if (child.type === 'directory') {
      // Recursively check subdirectories
      if (!areAllFilesInDirectorySelected(child)) {
        return false;
      }
    }
  }

  // All files are selected
  return true;
}

/**
 * Toggle selection of all files in a directory and its subdirectories
 * @param {Object} node - Directory node to toggle files in
 */
function selectAllFilesInDirectory(node) {
  if (!node || node.type !== 'directory') return;

  // Check if all files are already selected
  const allSelected = areAllFilesInDirectorySelected(node);

  // Process all children
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      if (child.type === 'file') {
        // If all files are selected, deselect this file
        // Otherwise, select this file if it's not already selected
        if (allSelected) {
          const index = selectedFiles.findIndex(f => f.path === child.path);
          if (index !== -1) {
            selectedFiles.splice(index, 1);
          }
        } else if (!isFileSelected(child)) {
          selectedFiles.push(child);
        }
      } else if (child.type === 'directory') {
        // Recursively process subdirectories with the same selection state
        if (allSelected) {
          // Deselect all files in subdirectory
          deselectAllFilesInDirectory(child);
        } else {
          // Select all files in subdirectory
          selectAllFilesInSubdirectory(child);
        }
      }
    }
  }
}

/**
 * Helper function to select all files in a subdirectory (without checking current state)
 * @param {Object} node - Directory node to select files from
 */
function selectAllFilesInSubdirectory(node) {
  if (!node || node.type !== 'directory') return;

  // Process all children
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      if (child.type === 'file') {
        // Add the file if it's not already selected
        if (!isFileSelected(child)) {
          selectedFiles.push(child);
        }
      } else if (child.type === 'directory') {
        // Recursively process subdirectories
        selectAllFilesInSubdirectory(child);
      }
    }
  }
}

/**
 * Helper function to deselect all files in a directory
 * @param {Object} node - Directory node to deselect files from
 */
function deselectAllFilesInDirectory(node) {
  if (!node || node.type !== 'directory') return;

  // Process all children
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      if (child.type === 'file') {
        // Remove the file if it's selected
        const index = selectedFiles.findIndex(f => f.path === child.path);
        if (index !== -1) {
          selectedFiles.splice(index, 1);
        }
      } else if (child.type === 'directory') {
        // Recursively process subdirectories
        deselectAllFilesInDirectory(child);
      }
    }
  }
}

/**
 * Check if a file or directory is selected
 * @param {Object} node - Node to check
 * @returns {boolean} - True if the file is selected or if all files in the directory are selected
 */
function isFileSelected(node) {
  if (node.type === 'file') {
    return selectedFiles.some(f => f.path === node.path);
  } else if (node.type === 'directory') {
    return areAllFilesInDirectorySelected(node);
  }
  return false;
}

/**
 * Update the selected files display
 * @param {Object} box - Blessed box to update
 */
function updateSelectedFiles(box) {
  let content = '';

  if (selectedFiles.length === 0) {
    content = 'No files selected';
  } else {
    content = selectedFiles.map(file => file.relativePath).join('\n');
  }

  box.setContent(content);
}

/**
 * Update the token count
 */
function updateTokenCount() {
  tokenCount = 0;

  for (const file of selectedFiles) {
    const content = fileSystem.readFileContent(file.path);
    tokenCount += tokenCounter.countTokens(content);
  }
}

/**
 * Update the status display
 * @param {Object} box - Blessed box to update
 * @param {boolean} isSearchMode - Whether we're in search mode
 */
function updateStatus(box, isSearchMode = false) {
  const content = [
    `Selected: ${selectedFiles.length} files`,
    `Tokens: ${tokenCount}`,
    '',
    'Controls:',
    '  ↑/↓: Navigate',
    '  Enter: Expand/collapse directory',
    '  Space: Toggle selection of file or all files in directory',
    '  /: Search',
    '  Escape: ' + (isSearchMode ? 'Exit search mode' : 'Quit'),
    '  t: Load template',
    '  s: Save template',
    '  c: Copy to clipboard and exit',
    '  q: Quit without copying'
  ].join('\n');

  box.setContent(content);
}

/**
 * Display search results in the tree
 * @param {Object} box - Blessed box containing the tree
 * @param {Array} results - Search results to highlight
 * @param {boolean} preserveSelection - Whether to preserve the current selection
 */
function displaySearchResults(box, results, preserveSelection = false) {
  // Save the original tree if this is a new search
  if (!isSearchActive) {
    originalTree = directoryTree;
    isSearchActive = true;
  }

  // Store the current selection position if we need to preserve it
  const currentSelection = preserveSelection ? box.selected : 0;

  // Store the search results
  searchResults = results;

  if (results.length === 0) {
    // No results found, show a message
    box.setItems(['No search results found']);
    return;
  }

  // Create a virtual tree with just the search results
  const items = results.map(node => {
    const prefix = node.type === 'directory' ? '▶ ' : '  ';
    const selected = isFileSelected(node) ? '✓ ' : '  ';
    const name = node.name + (node.type === 'directory' ? '/' : '');
    const path = node.relativePath;

    // If the node is selected, wrap the checkmark with color tags
    if (isFileSelected(node)) {
      return `${prefix}{green-fg}${selected}{/green-fg}${name} {gray-fg}(${path}){/gray-fg}`;
    } else {
      return `${prefix}${selected}${name} {gray-fg}(${path}){/gray-fg}`;
    }
  });

  // Set the items in the list
  box.setItems(items);

  // Restore the selection position if preserving, otherwise select the first item
  if (preserveSelection && currentSelection < items.length) {
    box.select(currentSelection);
  } else {
    box.select(0);
  }
}

/**
 * Show the template selection dialog
 * @param {Object} box - Blessed list box for template selection
 */
async function showTemplateSelection(box) {
  const templates = await templateManager.listTemplates();

  if (templates.length === 0) {
    box.setItems(['No templates available']);
  } else {
    box.setItems(templates);
  }

  box.hidden = false;
  box.focus();
}

module.exports = { start };
