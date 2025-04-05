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

// Store template to save
let templateToSave = null;
// Store files to be saved in the template (snapshot at time of saving)
let templateFiles = [];

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

      // Create the info box
      const infoBox = blessed.box({
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
        tags: true
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
      updateStatus(statusBox, false, false, templateSelectBox);

      // If a template was specified, load it
      if (options.template) {
        const template = await templateManager.loadTemplate(options.template);
        if (template && template.files) {
          selectedFiles = template.files;
          updateSelectedFiles(infoBox);
          updateTokenCount();
          updateStatus(statusBox, false, false, templateSelectBox);
          // Render the tree to show visual indicators for selected files
          renderTree(treeBox, directoryTree);
        }
      }

      // If a search query was specified, perform search
      if (options.searchQuery) {
        const results = search.searchFiles(directoryTree, options.searchQuery);
        // Initial search from options, don't preserve selection
        displaySearchResults(treeBox, results, false);
        updateStatus(statusBox, true, false, templateSelectBox);
      }

      // Handle key events
      screen.key(['q', 'C-c'], () => {
        screen.destroy();
        resolve({ selectedFiles: [], directoryTree: null, tokenCount: 0, saveTemplate: null, templateFiles: null });
      });

      screen.key('enter', () => {
        if (isSearchActive) {
          // In search mode with our new grouped display
          const selectedIndex = treeBox.selected;
          const selectedItem = treeBox.getItem(selectedIndex);

          if (!selectedItem) return;

          // Parse the selected item to determine if it's a directory
          const itemContent = selectedItem.content;

          // Check if this is a directory (has the directory prefix '▶ ')
          const isDirectory = itemContent.startsWith('▶ ');

          if (!isDirectory) return; // Only directories can be expanded

          // Extract the path directly from the content
          // Remove the prefix and any selection indicator
          const itemPath = itemContent.replace(/^\s*▶\s*(?:✓\s*)?/, '').replace(/\\$/, '');
          if (!itemPath) return;

          // Find the corresponding directory node in our search results
          const selectedNode = searchResults.find(node =>
            node.type === 'directory' && node.relativePath === itemPath
          );

          if (selectedNode) {
            // Exit search mode and navigate to the directory
            isSearchActive = false;
            searchResults = [];
            renderTree(treeBox, originalTree);

            // Expand the directory and all its parents
            let currentPath = selectedNode.path;
            while (currentPath && currentPath !== directoryTree.path) {
              expandedDirs.add(currentPath);
              currentPath = path.dirname(currentPath);
            }

            renderTree(treeBox, originalTree);
            updateStatus(statusBox, false, false, templateSelectBox);
          }
        } else {
          // Normal mode - toggle directory expansion
          const node = getCurrentNode(treeBox);
          if (!node) return;

          if (node.type === 'directory') {
            toggleDirectory(treeBox, node);
          }
        }

        screen.render();
      });

      screen.key('space', () => {
        if (isSearchActive) {
          // In search mode with our new grouped display
          const selectedIndex = treeBox.selected;
          const selectedItem = treeBox.getItem(selectedIndex);

          if (!selectedItem) return;

          // Parse the selected item to determine if it's a directory or file
          const itemContent = selectedItem.content;

          // Check if this is a directory (has the directory prefix '▶ ')
          const isDirectory = itemContent.startsWith('▶ ');

          // Extract the path directly from the content
          // Remove the prefix and any selection indicator
          const itemPath = itemContent.replace(/^\s*(?:▶|▼)\s*(?:✓\s*)?/, '').replace(/\\$/, '');
          if (!itemPath) return;

          // Find the corresponding node in our search results
          const selectedNode = searchResults.find(node => node.relativePath === itemPath);

          // If we couldn't find an exact match, try to find by partial path
          if (!selectedNode) {
            // For files, the path might be in a different format
            const possibleNodes = searchResults.filter(node =>
              itemContent.includes(node.name) &&
              (isDirectory ? node.type === 'directory' : node.type === 'file')
            );

            if (possibleNodes.length === 1) {
              // We found a unique match
              if (possibleNodes[0].type === 'file') {
                toggleFileSelection(possibleNodes[0]);
              } else if (possibleNodes[0].type === 'directory') {
                selectAllFilesInDirectory(possibleNodes[0]);
              }
            } else if (possibleNodes.length > 1) {
              // Multiple matches, try to find the best one
              const bestMatch = possibleNodes.find(node => node.relativePath === itemPath);
              if (bestMatch) {
                if (bestMatch.type === 'file') {
                  toggleFileSelection(bestMatch);
                } else if (bestMatch.type === 'directory') {
                  selectAllFilesInDirectory(bestMatch);
                }
              }
            }
          } else {
            // We found an exact match
            if (selectedNode.type === 'file') {
              toggleFileSelection(selectedNode);
            } else if (selectedNode.type === 'directory') {
              selectAllFilesInDirectory(selectedNode);
            }
          }

          updateSelectedFiles(infoBox);
          updateTokenCount();
          updateStatus(statusBox, true, false, templateSelectBox);

          // Update the display to show the selection, preserving the current selection position
          displaySearchResults(treeBox, searchResults, true);
          screen.render();
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
          updateStatus(statusBox, false, false, templateSelectBox);
          renderTree(treeBox, directoryTree);
          screen.render();
        }
      });

      screen.key('/', () => {
        // Ensure the search box is properly shown
        searchBox.hidden = false;
        searchBox.show();
        searchBox.focus();
        screen.render();
      });

      screen.key('t', async () => {
        await showTemplateSelection(templateSelectBox);
        screen.render();
      });

      screen.key('s', () => {
        if (selectedFiles.length > 0) {
          // Ensure the template name box is properly shown
          templateNameBox.hidden = false;
          templateNameBox.show();
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
            saveTemplate: templateToSave,
            templateFiles: templateFiles.length > 0 ? templateFiles : null
          });
        }
      });

      // Handle search box events
      searchBox.key(['escape', 'C-c'], () => {
        // Ensure the search box is completely hidden
        searchBox.hide();
        searchBox.hidden = true;
        treeBox.focus();
        // Force a complete redraw of the screen
        screen.clearRegion(0, screen.width, 0, screen.height);
        screen.render();
      });

      searchBox.key('enter', () => {
        const query = searchBox.getValue();
        // Ensure the search box is completely hidden
        searchBox.hide();
        searchBox.hidden = true;
        treeBox.focus();

        if (query) {
          const results = search.searchFiles(directoryTree, query);
          // Initial display of search results, don't preserve selection
          displaySearchResults(treeBox, results, false);
          updateStatus(statusBox, true);
        }

        // Force a complete redraw of the screen
        screen.clearRegion(0, screen.width, 0, screen.height);
        screen.render();
      });

      // Handle escape key to exit search mode or template selection
      screen.key('escape', () => {
        if (isSearchActive) {
          // Exit search mode and restore the original tree
          isSearchActive = false;
          searchResults = [];
          renderTree(treeBox, originalTree);
          updateStatus(statusBox, false, false, templateSelectBox);
          screen.render();
        } else if (!templateSelectBox.hidden) {
          // Close the template selection UI and return to main UI
          templateSelectBox.hide();
          templateSelectBox.hidden = true;
          treeBox.focus();
          // Force a complete redraw of the screen
          screen.clearRegion(0, screen.width, 0, screen.height);
          screen.render();
        } else {
          // Regular escape behavior (quit) - only when not in search mode or template selection
          screen.destroy();
          resolve({ selectedFiles: [], directoryTree: null, tokenCount: 0, saveTemplate: null, templateFiles: null });
        }
      });

      // Handle template name box events
      templateNameBox.key(['escape', 'C-c'], () => {
        // Ensure the template name box is completely hidden
        templateNameBox.hide();
        templateNameBox.hidden = true;
        treeBox.focus();
        // Force a complete redraw of the screen
        screen.clearRegion(0, screen.width, 0, screen.height);
        screen.render();
      });

      templateNameBox.key('enter', () => {
        const templateName = templateNameBox.getValue();
        // Ensure the template name box is completely hidden
        templateNameBox.hide();
        templateNameBox.hidden = true;
        treeBox.focus();

        if (templateName) {
          // Save the template name and take a snapshot of currently selected files
          templateToSave = templateName;
          // Create a deep copy of the selected files to save in the template
          templateFiles = JSON.parse(JSON.stringify(selectedFiles));

          // Show a notification that the template will be saved
          statusBox.setContent(`Template "${templateName}" will be saved when you exit. Continue selecting files...\n\n` + updateStatus(statusBox, isSearchActive, true, templateSelectBox));
          // Force a complete redraw of the screen
          screen.clearRegion(0, screen.width, 0, screen.height);
          screen.render();
        } else {
          // Force a complete redraw of the screen
          screen.clearRegion(0, screen.width, 0, screen.height);
          screen.render();
        }
      });

      // Handle template selection box events
      templateSelectBox.key(['escape', 'C-c'], () => {
        // Ensure the template selection box is completely hidden
        templateSelectBox.hide();
        templateSelectBox.hidden = true;
        treeBox.focus();
        // Force a complete redraw of the screen
        screen.clearRegion(0, screen.width, 0, screen.height);
        screen.render();
      });

      // Add delete template functionality
      templateSelectBox.key('d', async () => {
        const selectedItem = templateSelectBox.getItem(templateSelectBox.selected);
        if (!selectedItem || selectedItem.content === 'No templates available') {
          return;
        }

        const templateName = selectedItem.content;
        showConfirmationDialog(
          confirmationBox,
          `Are you sure you want to delete template "${templateName}"?\n\n[y] Yes  [n] No`,
          async (confirmed) => {
            if (confirmed) {
              const success = await templateManager.deleteTemplate(templateName);

              // Refresh the template list
              const templates = await templateManager.listTemplates();
              if (templates.length === 0) {
                templateSelectBox.setItems(['No templates available']);
              } else {
                templateSelectBox.setItems(templates);
              }

              // Show a notification
              statusBox.setContent(success
                ? `Template "${templateName}" deleted successfully.\n\n` + updateStatus(statusBox, isSearchActive, true, templateSelectBox)
                : `Failed to delete template "${templateName}".\n\n` + updateStatus(statusBox, isSearchActive, true, templateSelectBox));
            }

            // Return focus to template selection box
            templateSelectBox.focus();
            screen.render();
          }
        );
        screen.render();
      });

      templateSelectBox.on('select', async (item) => {
        const templateName = item.content;
        // Ensure the template selection box is completely hidden
        templateSelectBox.hide();
        templateSelectBox.hidden = true;
        treeBox.focus();

        const template = await templateManager.loadTemplate(templateName);
        if (template && template.files) {
          selectedFiles = template.files;
          updateSelectedFiles(infoBox);
          updateTokenCount();
          updateStatus(statusBox, false, false, templateSelectBox);
          // Render the tree to show visual indicators for selected files
          renderTree(treeBox, directoryTree);
        }

        // Force a complete redraw of the screen
        screen.clearRegion(0, screen.width, 0, screen.height);
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
 * Generate tree branch characters for a node
 * @param {Object} node - The current node
 * @returns {string} - Tree branch characters
 */
function getTreeBranches(node) {
  try {
    if (!node) return '';

    // Get the path components to determine the node's level
    // Use backslashes for Windows paths
    const pathComponents = node.path.split(/[\\\/]/).filter(Boolean);
    const level = pathComponents.length;

    if (level === 0) return ''; // Root node has no branches

    // Initialize the branch string
    let branches = '';

    // Simple approach: just add indentation based on level
    if (level > 1) {
      // For each level except the last one, add a branch character
      for (let i = 1; i < level; i++) {
        branches += '│ ';
      }

      // Replace the last vertical line with a corner
      if (branches.length >= 2) {
        branches = branches.substring(0, branches.length - 2) + '└─';
      }
    }

    return branches;
  } catch (error) {
    console.error('Error in getTreeBranches:', error);
    return '';
  }
}

/**
 * Render the directory tree in the tree box
 * @param {Object} box - Blessed box to render in
 * @param {Object} tree - Directory tree to render
 */
function renderTree(box, tree) {
  try {
    if (!tree) {
      return;
    }

    // Reset the flattened tree
    flattenedTree = [];

    // Build the flattened tree
    flattenTree(tree, true);

    // Create the list items
    const items = flattenedTree.map((node) => {
      try {
        const isExpanded = node === tree || isNodeExpanded(node);
        const dirPrefix = node.type === 'directory' ? (isExpanded ? '▼ ' : '▶ ') : '  ';
        const selected = isFileSelected(node) ? '✓ ' : '  ';

        // Get tree branch characters
        const branches = getTreeBranches(node);

        // Use relativePath instead of just name
        const displayPath = node.relativePath + (node.type === 'directory' ? '\\' : '');

        // Format the path with the rightmost part in bold
        let formattedPath = displayPath;
        try {
          formattedPath = formatPathWithBoldRightmost(displayPath);
        } catch (formatError) {
          console.error('Error formatting path:', formatError);
        }

        // If the node is selected, wrap the checkmark with color tags
        if (isFileSelected(node)) {
          return `${branches}${dirPrefix}{green-fg}${selected}{/green-fg}${formattedPath}`;
        } else {
          return `${branches}${dirPrefix}${selected}${formattedPath}`;
        }
      } catch (nodeError) {
        console.error('Error processing node:', nodeError);
        return `Error: ${node ? node.relativePath || 'unknown' : 'null'}`;
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
  } catch (error) {
    console.error('Error in renderTree:', error);
    box.setItems(['Error rendering tree: ' + error.message]);
  }
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
 * @param {boolean} returnContentOnly - Whether to return the content string instead of updating the box
 * @param {Object} templateBox - Template selection box to check visibility
 * @returns {string|undefined} - Status content if returnContentOnly is true
 */
function updateStatus(box, isSearchMode = false, returnContentOnly = false, templateBox = null) {
  // Create a status display with all controls visible and key information in bold
  let escapeAction = 'Quit';
  if (isSearchMode) {
    escapeAction = 'Exit search';
  } else if (templateBox && !templateBox.hidden) {
    escapeAction = 'Close template selection';
  }

  const content = [
    `{bold}Selected:{/bold} ${selectedFiles.length} files | {bold}Tokens:{/bold} ${tokenCount}` + (templateToSave ? ` | {bold}Template to save:{/bold} ${templateToSave}` : ''),
    '{bold}Controls:{/bold}',
    '  {bold}Navigation:{/bold}     {bold}↑/↓:{/bold} Navigate       {bold}Enter:{/bold} Expand/collapse    {bold}Space:{/bold} Toggle selection',
    '  {bold}Templates:{/bold}      {bold}t:{/bold} Load template   {bold}s:{/bold} Save template      {bold}d:{/bold} Delete template',
    '  {bold}Actions:{/bold}        {bold}/{/bold} Search          {bold}c:{/bold} Copy                {bold}q:{/bold} Quit',
    `  {bold}Exit/Cancel:{/bold}    {bold}Esc:{/bold} ${escapeAction}`
  ].filter(line => line !== '').join('\n');

  if (returnContentOnly) {
    return content;
  }

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

  // Group results by directory for better organization
  const groupedResults = {};

  // First pass: collect all directories
  results.forEach(node => {
    if (node.type === 'directory') {
      groupedResults[node.relativePath] = [];
    }
  });

  // Second pass: assign files to their directories or create standalone entries
  results.forEach(node => {
    if (node.type === 'file') {
      const dirPath = path.dirname(node.relativePath);
      if (groupedResults[dirPath]) {
        // This file belongs to a directory that's in our results
        groupedResults[dirPath].push(node);
      } else {
        // Standalone file or belongs to a directory not in results
        // Use the file's path as the key
        groupedResults[node.relativePath] = [node];
      }
    }
  });

  // Create a virtual tree with just the search results
  const items = [];

  // Sort the keys (paths) to maintain directory structure
  const sortedPaths = Object.keys(groupedResults).sort((a, b) => a.localeCompare(b));

  // Build the display items
  try {
    sortedPaths.forEach((relativePath) => {
      try {
        // Find the directory node if it exists
        const dirNode = results.find(node =>
          node.type === 'directory' && node.relativePath === relativePath
        );

        // Split the path to determine the directory structure
        const dirParts = relativePath.split('\\');

        // Generate simple tree branches for directories based on depth
        let dirBranches = '';
        for (let i = 0; i < dirParts.length - 1; i++) {
          dirBranches += '│ ';
        }

        // Replace the last vertical line with a corner if needed
        if (dirBranches.length >= 2) {
          dirBranches = dirBranches.substring(0, dirBranches.length - 2) + '└─';
        }

        if (dirNode) {
          // Add the directory entry
          const dirPrefix = '▶ ';
          const selected = isFileSelected(dirNode) ? '✓ ' : '  ';
          const displayPath = relativePath + '\\';

          // Format the path with the rightmost part in bold
          let formattedPath = displayPath;
          try {
            formattedPath = formatPathWithBoldRightmost(displayPath);
          } catch (formatError) {
            console.error('Error formatting path:', formatError);
          }

          // If the directory is selected, wrap the checkmark with color tags
          if (isFileSelected(dirNode)) {
            items.push(`${dirBranches}${dirPrefix}{green-fg}${selected}{/green-fg}${formattedPath}`);
          } else {
            items.push(`${dirBranches}${dirPrefix}${selected}${formattedPath}`);
          }
        }

        // Add the files in this directory
        const files = groupedResults[relativePath];
        if (files && files.length > 0) {
          files.forEach((fileNode, fileIndex) => {
            try {
              if (fileNode.type === 'file') {
                // Generate file branch - use └─ for last file, ├─ for others
                const isLastFile = fileIndex === files.length - 1;
                const fileBranch = dirBranches + (isLastFile ? '└─' : '├─');
                const filePrefix = '  ';
                const selected = isFileSelected(fileNode) ? '✓ ' : '  ';
                const displayPath = fileNode.relativePath;

                // Format the path with the rightmost part in bold
                let formattedPath = displayPath;
                try {
                  formattedPath = formatPathWithBoldRightmost(displayPath);
                } catch (formatError) {
                  console.error('Error formatting path:', formatError);
                }

                // If the file is selected, wrap the checkmark with color tags
                if (isFileSelected(fileNode)) {
                  items.push(`${fileBranch}${filePrefix}{green-fg}${selected}{/green-fg}${formattedPath}`);
                } else {
                  items.push(`${fileBranch}${filePrefix}${selected}${formattedPath}`);
                }
              }
            } catch (fileError) {
              console.error('Error processing file:', fileError);
              items.push(`Error: ${fileNode ? fileNode.relativePath || 'unknown file' : 'null file'}`);
            }
          });
        }
      } catch (dirError) {
        console.error('Error processing directory:', dirError);
        items.push(`Error: ${relativePath || 'unknown directory'}`);
      }
    });
  } catch (error) {
    console.error('Error building display items:', error);
    items.push('Error building display items: ' + error.message);
  }

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

  // Ensure the box is properly shown
  box.hidden = false;
  box.show();
  box.focus();
}

/**
 * Show a confirmation dialog
 * @param {Object} box - Blessed box for the confirmation dialog
 * @param {string} message - Message to display
 * @param {Function} callback - Callback function to call with the result (true/false)
 */
function showConfirmationDialog(box, message, callback) {
  // Set the content of the confirmation box
  box.setContent(message);

  // Show the box
  box.hidden = false;
  box.show();

  // Handle key events for the confirmation dialog
  const onKey = (_, key) => {
    if (key.name === 'y') {
      // User confirmed
      box.hide();
      box.hidden = true;
      // Remove the key event handler
      box.screen.unkey(['y', 'n'], onKey);
      callback(true);
    } else if (key.name === 'n' || key.name === 'escape') {
      // User cancelled
      box.hide();
      box.hidden = true;
      // Remove the key event handler
      box.screen.unkey(['y', 'n'], onKey);
      callback(false);
    }
  };

  // Add the key event handler
  box.screen.key(['y', 'n'], onKey);
}

/**
 * Format a path with the rightmost part in bold
 * @param {string} displayPath - Path to format
 * @returns {string} - Formatted path with rightmost part in bold
 */
function formatPathWithBoldRightmost(displayPath) {
  if (!displayPath) return '';

  // For directory paths ending with '\', we need to handle them specially
  const isDirectory = displayPath.endsWith('\\');

  // Remove trailing backslash for processing if it's a directory
  const processPath = isDirectory ? displayPath.slice(0, -1) : displayPath;

  // Find the last backslash to determine the rightmost part
  const lastBackslashIndex = processPath.lastIndexOf('\\');

  if (lastBackslashIndex === -1) {
    // No backslash found, the entire path is the rightmost part
    return `{bold}${displayPath}{/bold}`;
  } else {
    // Split the path into prefix and rightmost part
    const prefix = processPath.substring(0, lastBackslashIndex + 1);
    const rightmost = processPath.substring(lastBackslashIndex + 1);

    // Add the trailing backslash to the rightmost part if it's a directory
    const formattedRightmost = isDirectory ? `{bold}${rightmost}\\{/bold}` : `{bold}${rightmost}{/bold}`;

    return prefix + formattedRightmost;
  }
}

module.exports = { start };
