/**
 * Key handlers for managing keyboard events
 */

const path = require('path');
const stateManager = require('../state');
const treeView = require('../components/treeView');
const selectionView = require('../components/selectionView');
const statusView = require('../components/statusView');
const searchHandler = require('./searchHandler');
const selectionHandler = require('./selectionHandler');
const templateHandler = require('./templateHandler');
const search = require('../../utils/search');

/**
 * Setup key handlers for the terminal UI
 * @param {Object} screen - Blessed screen
 * @param {Object} components - UI components
 * @param {Function} resolvePromise - Function to resolve the terminal promise
 */
function setupKeyHandlers(screen, components, resolvePromise) {
  const {
    treeBox, infoBox, statusBox, searchBox,
    templateNameBox, templateSelectBox, confirmationBox
  } = components;

  const state = stateManager.getState();

  // Handle quit
  screen.key(['q', 'C-c'], () => {
    screen.destroy();
    resolvePromise(stateManager.getEmptyResult());
  });

  // Handle enter (toggle directory expansion)
  screen.key('enter', () => {
    if (state.isSearchActive) {
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
      const selectedNode = state.searchResults.find(node =>
        node.type === 'directory' && node.relativePath === itemPath
      );

      if (selectedNode) {
        // Exit search mode and navigate to the directory
        state.isSearchActive = false;
        state.searchResults = [];
        treeView.renderTree(treeBox, state.originalTree);

        // Expand the directory and all its parents
        let currentPath = selectedNode.path;
        while (currentPath && currentPath !== state.directoryTree.path) {
          state.expandedDirs.add(currentPath);
          currentPath = path.dirname(currentPath);
        }

        treeView.renderTree(treeBox, state.originalTree);
        statusView.updateStatus(statusBox, false, false, templateSelectBox);
      }
    } else {
      // Normal mode - toggle directory expansion
      const node = treeView.getCurrentNode(treeBox);
      if (!node) return;

      if (node.type === 'directory') {
        treeView.toggleDirectory(treeBox, node);
      }
    }

    screen.render();
  });

  // Handle space (toggle selection)
  screen.key('space', () => {
    // Skip if infoBox has focus - let the infoBox space handler handle it
    if (state.activeBox === 'infoBox') return;

    // Check if we have highlighted items for multi-selection
    if (state.highlightedIndices.size > 0) {
      if (state.isSearchActive) {
        // In search mode, use the searchListToNodeMap to directly access nodes
        state.highlightedIndices.forEach(index => {
          if (index >= 0 && index < state.searchListToNodeMap.length) {
            const node = state.searchListToNodeMap[index];
            if (node) { // Only act if we have a valid node mapped
              if (node.type === 'file') {
                selectionHandler.toggleFileSelection(node);
              }
              // We intentionally ignore directory nodes in search mode multi-selection
              // to avoid inconsistent selection behavior
            } else {
              // Optional: Log if an index doesn't map to a node
              console.log(`Warning: Highlighted index ${index} has no mapped node.`);
            }
          }
        });
      } else {
        // In normal mode, use the flattened tree
        state.highlightedIndices.forEach(index => {
          if (index < state.flattenedTree.length) {
            const node = state.flattenedTree[index];
            if (node.type === 'file') {
              selectionHandler.toggleFileSelection(node);
            } else if (node.type === 'directory') {
              selectionHandler.selectAllFilesInDirectory(node);
            }
          }
        });
      }

      // Clear the multi-selection state
      state.multiSelectStartIndex = -1;
      state.highlightedIndices.clear();

      // Update UI
      selectionView.updateSelectedFiles(infoBox);
      selectionView.updateTokenCount();
      statusView.updateStatus(statusBox, state.isSearchActive, false, templateSelectBox);

      if (state.isSearchActive) {
        searchHandler.displaySearchResults(treeBox, state.searchResults, true);
      } else {
        treeView.renderTree(treeBox, state.directoryTree);
      }

      screen.render();
      return;
    }

    // Handle single selection
    handleSpaceSelection(treeBox, infoBox, statusBox, templateSelectBox, screen);
  });

  // Handle search key
  screen.key('/', () => {
    // Ensure the search box is properly shown
    searchBox.hidden = false;
    searchBox.show();
    // Clear the previous search value
    searchBox.setValue('');
    searchBox.focus();
    screen.render();
  });

  // Handle template selection key
  screen.key('t', async () => {
    await templateHandler.showTemplateSelection(templateSelectBox);
    screen.render();
  });

  // Handle save template key
  screen.key('s', () => {
    if (state.selectedFiles.length > 0 || state.selectedEmptyDirs.length > 0) {
      // Ensure the template name box is properly shown
      templateNameBox.hidden = false;
      templateNameBox.show();
      templateNameBox.focus();
      screen.render();
    }
  });

  // Handle copy key
  screen.key('c', () => {
    if (state.selectedFiles.length > 0 || state.selectedEmptyDirs.length > 0) {
      screen.destroy();
      resolvePromise(stateManager.getResult());
    }
  });

  // Handle search box events
  setupSearchBoxHandlers(searchBox, treeBox, statusBox, screen);

  // Handle template name box events
  setupTemplateNameBoxHandlers(templateNameBox, treeBox, statusBox, screen, templateSelectBox);

  // Handle template selection box events
  setupTemplateSelectionBoxHandlers(templateSelectBox, treeBox, infoBox, statusBox, confirmationBox, screen);

  // Add key handlers for up/down navigation to maintain padding
  setupNavigationHandlers(treeBox, screen);

  // Add Vim-like navigation handlers
  setupVimNavigationHandlers(screen, treeBox);

  // Add 'a' key to toggle selection of all visible files
  setupToggleAllHandler(screen, treeBox, infoBox, statusBox, templateSelectBox);

  // Add shift+arrow keys for multi-selection highlighting
  setupMultiSelectionHandlers(screen, treeBox);

  // Add Tab key handler to toggle focus between treeBox and infoBox
  setupTabHandler(screen, treeBox, infoBox, statusBox);

  // Add 'm' key handler to switch between modes
  setupModeHandler(screen, statusBox, templateSelectBox);

  // Add 'o' key handler to switch between output formats
  setupOutputFormatHandler(screen, statusBox, templateSelectBox);

  // Add key handlers for infoBox
  setupInfoBoxHandlers(infoBox, treeBox, statusBox, templateSelectBox, screen);

  // Add escape key handler
  setupEscapeHandler(screen, treeBox, statusBox, templateSelectBox, resolvePromise);
}

/**
 * Handle space key selection logic
 * @param {Object} treeBox - Tree box component
 * @param {Object} infoBox - Info box component
 * @param {Object} statusBox - Status box component
 * @param {Object} templateSelectBox - Template selection box component
 * @param {Object} screen - Blessed screen
 */
function handleSpaceSelection(treeBox, infoBox, statusBox, templateSelectBox, screen) {
  const state = stateManager.getState();

  if (state.isSearchActive) {
    // In search mode with our new grouped display
    const selectedIndex = treeBox.selected;
    const selectedItem = treeBox.getItem(selectedIndex);

    if (!selectedItem) return;

    // Parse the selected item to determine if it's a directory or file
    const itemContent = selectedItem.content;

    // Check if this is a directory (has the directory prefix '▶ ')
    const isDirectory = itemContent.includes('▶ ');
    const isFile = !isDirectory;

    // Extract the filename or directory name from the content
    // This is a more reliable approach than trying to extract the full path
    let fileName = '';
    let dirName = '';

    if (isFile) {
      // For files, extract the filename (last part of the path)
      // First remove all formatting tags
      const contentWithoutTags = itemContent.replace(/\{[^}]+\}/g, '');
      // Split by backslash and get the last part
      const parts = contentWithoutTags.split('\\');
      fileName = parts[parts.length - 1].trim();
      // Remove any tree characters and selection indicators
      fileName = fileName.replace(/[│├└]─?\s*/g, '').replace(/^\s*(?:✓\s*)?/, '');
    } else {
      // For directories, extract the directory name with trailing backslash
      // First remove all formatting tags
      const contentWithoutTags = itemContent.replace(/\{[^}]+\}/g, '');
      // Extract the part after the directory prefix
      const match = contentWithoutTags.match(/▶\s*(?:✓\s*)?([^\n]+)/);
      if (match && match[1]) {
        dirName = match[1].trim();
        // Remove any tree characters
        dirName = dirName.replace(/[│├└]─?\s*/g, '');
      }
    }

    // Find the corresponding node in our search results
    let selectedNode = null;

    if (isFile && fileName) {
      // For files, find all nodes that end with this filename
      const matchingNodes = state.searchResults.filter(node =>
        node.type === 'file' && node.relativePath.endsWith(fileName)
      );

      if (matchingNodes.length === 1) {
        // If there's only one match, use it
        selectedNode = matchingNodes[0];
      } else if (matchingNodes.length > 1) {
        // If there are multiple matches, try to find the best one
        // by looking at the displayed content
        const fullPath = itemContent.replace(/[│├└]─?\s*/g, '').replace(/^\s*(?:✓\s*)?/, '').replace(/\{[^}]+\}/g, '');

        // Try to find a node whose path is contained in the displayed content
        for (const node of matchingNodes) {
          if (fullPath.includes(node.relativePath)) {
            selectedNode = node;
            break;
          }
        }

        // If we still don't have a match, just use the first one
        if (!selectedNode) {
          selectedNode = matchingNodes[0];
        }
      }
    } else if (isDirectory && dirName) {
      // For directories, find the node that matches this directory name
      const matchingNodes = state.searchResults.filter(node =>
        node.type === 'directory' && node.relativePath.endsWith(dirName.replace(/\\$/, ''))
      );

      if (matchingNodes.length > 0) {
        // Use the first matching directory
        selectedNode = matchingNodes[0];
      }
    }

    // If we found a node, toggle its selection
    if (selectedNode) {
      if (selectedNode.type === 'file') {
        selectionHandler.toggleFileSelection(selectedNode);
      } else if (selectedNode.type === 'directory') {
        selectionHandler.selectAllFilesInDirectory(selectedNode);
      }
    } else {
      // If we couldn't find a node, try a more aggressive approach
      // Look for any node that might match the selected item
      const contentWithoutFormatting = itemContent.replace(/\{[^}]+\}/g, '');

      // Try to find any file or directory that might be related to this content
      for (const node of state.searchResults) {
        if ((isFile && node.type === 'file') || (isDirectory && node.type === 'directory')) {
          if (contentWithoutFormatting.includes(node.name)) {
            selectedNode = node;
            break;
          }
        }
      }

      // If we found a node with this fallback approach, toggle its selection
      if (selectedNode) {
        if (selectedNode.type === 'file') {
          selectionHandler.toggleFileSelection(selectedNode);
        } else if (selectedNode.type === 'directory') {
          selectionHandler.selectAllFilesInDirectory(selectedNode);
        }
      } else {
        console.error(`Could not find node for selected item: ${itemContent}`);
      }
    }

    selectionView.updateSelectedFiles(infoBox);
    selectionView.updateTokenCount();
    statusView.updateStatus(statusBox, true, false, templateSelectBox);

    // Update the display to show the selection, preserving the current selection position
    if (state.highlightedIndices.size > 0) {
      searchHandler.displaySearchResultsWithHighlights(treeBox, state.searchResults, true);
    } else {
      searchHandler.displaySearchResults(treeBox, state.searchResults, true);
    }
    screen.render();
  } else {
    // Normal mode
    const node = treeView.getCurrentNode(treeBox);
    if (!node) return;

    if (node.type === 'file') {
      selectionHandler.toggleFileSelection(node);
    } else if (node.type === 'directory') {
      // Select all files in the directory
      selectionHandler.selectAllFilesInDirectory(node);
    }
    selectionView.updateSelectedFiles(infoBox);
    selectionView.updateTokenCount();
    statusView.updateStatus(statusBox, false, false, templateSelectBox);
    treeView.renderTree(treeBox, state.directoryTree);
    screen.render();
  }
}

/**
 * Setup search box event handlers
 * @param {Object} searchBox - Search box component
 * @param {Object} treeBox - Tree box component
 * @param {Object} statusBox - Status box component
 * @param {Object} screen - Blessed screen
 */
function setupSearchBoxHandlers(searchBox, treeBox, statusBox, screen) {
  // Handle escape and ctrl+c to cancel search
  searchBox.key(['escape', 'C-c'], () => {
    // Ensure the search box is completely hidden
    searchBox.hide();
    searchBox.hidden = true;
    treeBox.focus();
    // Force a complete redraw of the screen
    screen.clearRegion(0, screen.width, 0, screen.height);
    screen.render();
  });

  // Handle enter to perform search
  searchBox.key('enter', () => {
    const query = searchBox.getValue();
    // Ensure the search box is completely hidden
    searchBox.hide();
    searchBox.hidden = true;
    treeBox.focus();

    if (query) {
      const state = stateManager.getState();
      const results = search.searchFiles(state.directoryTree, query);
      // Initial display of search results, don't preserve selection
      searchHandler.displaySearchResults(treeBox, results, false);
      statusView.updateStatus(statusBox, true);
    }

    // Force a complete redraw of the screen
    screen.clearRegion(0, screen.width, 0, screen.height);
    screen.render();
  });
}

/**
 * Setup template name box event handlers
 * @param {Object} templateNameBox - Template name box component
 * @param {Object} treeBox - Tree box component
 * @param {Object} statusBox - Status box component
 * @param {Object} screen - Blessed screen
 * @param {Object} templateSelectBox - Template selection box component
 */
function setupTemplateNameBoxHandlers(templateNameBox, treeBox, statusBox, screen, templateSelectBox) {
  const state = stateManager.getState();

  // Handle escape and ctrl+c to cancel template name input
  templateNameBox.key(['escape', 'C-c'], () => {
    // Ensure the template name box is completely hidden
    templateNameBox.hide();
    templateNameBox.hidden = true;
    treeBox.focus();
    // Force a complete redraw of the screen
    screen.clearRegion(0, screen.width, 0, screen.height);
    screen.render();
  });

  // Handle enter to save template name
  templateNameBox.key('enter', () => {
    const templateName = templateNameBox.getValue();
    // Ensure the template name box is completely hidden
    templateNameBox.hide();
    templateNameBox.hidden = true;
    treeBox.focus();

    if (templateName) {
      templateHandler.saveTemplateInfo(templateName, statusBox, state.isSearchActive, templateSelectBox);
      // Force a complete redraw of the screen
      screen.clearRegion(0, screen.width, 0, screen.height);
      screen.render();
    } else {
      // Force a complete redraw of the screen
      screen.clearRegion(0, screen.width, 0, screen.height);
      screen.render();
    }
  });
}

/**
 * Setup template selection box event handlers
 * @param {Object} templateSelectBox - Template selection box component
 * @param {Object} treeBox - Tree box component
 * @param {Object} infoBox - Info box component
 * @param {Object} statusBox - Status box component
 * @param {Object} confirmationBox - Confirmation box component
 * @param {Object} screen - Blessed screen
 */
function setupTemplateSelectionBoxHandlers(templateSelectBox, treeBox, infoBox, statusBox, confirmationBox, screen) {
  // Handle escape and ctrl+c to close template selection
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
    statusView.showConfirmationDialog(
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
            ? `Template "${templateName}" deleted successfully.\n\n` + statusView.updateStatus(statusBox, state.isSearchActive, true, templateSelectBox)
            : `Failed to delete template "${templateName}".\n\n` + statusView.updateStatus(statusBox, state.isSearchActive, true, templateSelectBox));
        }

        // Return focus to template selection box
        templateSelectBox.focus();
        screen.render();
      }
    );
    screen.render();
  });

  // Handle template selection
  templateSelectBox.on('select', async (item) => {
    const templateName = item.content;
    // Ensure the template selection box is completely hidden
    templateSelectBox.hide();
    templateSelectBox.hidden = true;
    treeBox.focus();

    await templateHandler.loadTemplate(templateName, infoBox, treeBox, statusBox, templateSelectBox);

    // Force a complete redraw of the screen
    screen.clearRegion(0, screen.width, 0, screen.height);
    screen.render();
  });
}

/**
 * Setup navigation handlers for up/down keys
 * @param {Object} treeBox - Tree box component
 * @param {Object} screen - Blessed screen
 */
function setupNavigationHandlers(treeBox, screen) {
  // Add key handlers for up/down navigation to maintain padding
  treeBox.key(['up', 'down'], () => {
    // Calculate the scroll position to maintain padding at the top
    const currentSelection = treeBox.selected;
    const paddingLines = 3; // Number of lines to show above the selected item
    const scrollPosition = Math.max(0, currentSelection - paddingLines);

    // Scroll to the calculated position
    treeBox.scrollTo(scrollPosition);
    screen.render();
  });
}

/**
 * Setup Vim-like navigation handlers
 * @param {Object} screen - Blessed screen
 * @param {Object} treeBox - Tree box component
 */
function setupVimNavigationHandlers(screen, treeBox) {
  const state = stateManager.getState();

  // Add Vim-like navigation: h (left/parent directory)
  screen.key('h', () => {
    // Only handle when treeBox has focus and not in search mode
    if (state.activeBox !== 'treeBox' || state.isSearchActive) return;

    const node = treeView.getCurrentNode(treeBox);
    if (!node) return;

    // Get the parent directory path
    const parentPath = path.dirname(node.path);

    // If we're already at the root, do nothing
    if (parentPath === node.path) return;

    // Find the parent node in our flattened tree
    const parentNode = state.flattenedTree.find(n => n.path === parentPath);
    if (!parentNode) return;

    // Find the index of the parent node
    const parentIndex = state.flattenedTree.indexOf(parentNode);
    if (parentIndex === -1) return;

    // Select the parent node
    treeBox.select(parentIndex);

    // Calculate the scroll position to maintain padding at the top
    const paddingLines = 3;
    const scrollPosition = Math.max(0, parentIndex - paddingLines);
    treeBox.scrollTo(scrollPosition);

    screen.render();
  });

  // Add Vim-like navigation: l (right/expand directory)
  screen.key('l', () => {
    // Only handle when treeBox has focus and not in search mode
    if (state.activeBox !== 'treeBox' || state.isSearchActive) return;

    const node = treeView.getCurrentNode(treeBox);
    if (!node) return;

    if (node.type === 'directory') {
      // If directory is not expanded, expand it
      if (!treeView.isNodeExpanded(node)) {
        state.expandedDirs.add(node.path);
        treeView.renderTree(treeBox, state.directoryTree);
      }
      // If directory has children and is already expanded, select the first child
      else if (node.children && node.children.length > 0) {
        // Find the index of the first child in the flattened tree
        const firstChildIndex = state.flattenedTree.findIndex(n =>
          n.path.startsWith(node.path + '\\') &&
          n.path.split('\\').length === node.path.split('\\').length + 1
        );

        if (firstChildIndex !== -1) {
          treeBox.select(firstChildIndex);

          // Calculate the scroll position to maintain padding at the top
          const paddingLines = 3;
          const scrollPosition = Math.max(0, firstChildIndex - paddingLines);
          treeBox.scrollTo(scrollPosition);
        }
      }
    }

    screen.render();
  });

  // Add Vim-like navigation: g (jump to top)
  screen.key('g', () => {
    // Only handle when treeBox has focus
    if (state.activeBox !== 'treeBox') return;
    treeBox.select(0);
    treeBox.scrollTo(0);
    screen.render();
  });

  // Add Vim-like navigation: G (jump to bottom)
  screen.key('G', () => {
    // Only handle when treeBox has focus
    if (state.activeBox !== 'treeBox') return;
    const lastIndex = treeBox.items.length - 1;
    treeBox.select(lastIndex);

    // Calculate the scroll position to show the last item at the bottom
    const visibleHeight = treeBox.height - 2; // Account for borders
    const scrollPosition = Math.max(0, lastIndex - visibleHeight + 1);
    treeBox.scrollTo(scrollPosition);

    screen.render();
  });
}

/**
 * Setup toggle all handler for the 'a' key
 * @param {Object} screen - Blessed screen
 * @param {Object} treeBox - Tree box component
 * @param {Object} infoBox - Info box component
 * @param {Object} statusBox - Status box component
 * @param {Object} templateSelectBox - Template selection box component
 */
function setupToggleAllHandler(screen, treeBox, infoBox, statusBox, templateSelectBox) {
  const state = stateManager.getState();

  screen.key('a', () => {
    // Only handle when treeBox has focus
    if (state.activeBox !== 'treeBox') return;
    if (state.isSearchActive) {
      // In search mode, toggle all visible files in search results
      const allSelected = state.searchResults.every(node => {
        if (node.type === 'file') return selectionHandler.isFileSelected(node);
        if (node.type === 'directory') return selectionHandler.areAllFilesInDirectorySelected(node);
        return true;
      });

      // Toggle selection based on current state
      state.searchResults.forEach(node => {
        if (node.type === 'file') {
          if (allSelected) {
            // Deselect if all are selected
            const index = state.selectedFiles.findIndex(f => f.path === node.path);
            if (index !== -1) state.selectedFiles.splice(index, 1);
          } else if (!selectionHandler.isFileSelected(node)) {
            // Select if not all are selected
            state.selectedFiles.push(node);
          }
        } else if (node.type === 'directory') {
          if (allSelected) {
            selectionHandler.deselectAllFilesInDirectory(node);
          } else {
            selectionHandler.selectAllFilesInSubdirectory(node);
          }
        }
      });

      selectionView.updateSelectedFiles(infoBox);
      selectionView.updateTokenCount();
      statusView.updateStatus(statusBox, true, false, templateSelectBox);
      searchHandler.displaySearchResults(treeBox, state.searchResults, true);
    } else {
      // In normal mode, toggle all visible files in the current view
      const visibleNodes = state.flattenedTree;
      const allSelected = visibleNodes.every(node => {
        if (node.type === 'file') return selectionHandler.isFileSelected(node);
        if (node.type === 'directory') return selectionHandler.areAllFilesInDirectorySelected(node);
        return true;
      });

      // Toggle selection based on current state
      visibleNodes.forEach(node => {
        if (node.type === 'file') {
          if (allSelected) {
            // Deselect if all are selected
            const index = state.selectedFiles.findIndex(f => f.path === node.path);
            if (index !== -1) state.selectedFiles.splice(index, 1);
          } else if (!selectionHandler.isFileSelected(node)) {
            // Select if not all are selected
            state.selectedFiles.push(node);
          }
        } else if (node.type === 'directory') {
          if (allSelected) {
            selectionHandler.deselectAllFilesInDirectory(node);
          } else {
            selectionHandler.selectAllFilesInSubdirectory(node);
          }
        }
      });

      selectionView.updateSelectedFiles(infoBox);
      selectionView.updateTokenCount();
      statusView.updateStatus(statusBox, false, false, templateSelectBox);
      treeView.renderTree(treeBox, state.directoryTree);
    }

    screen.render();
  });
}

/**
 * Setup multi-selection handlers for shift+arrow keys
 * @param {Object} screen - Blessed screen
 * @param {Object} treeBox - Tree box component
 */
function setupMultiSelectionHandlers(screen, treeBox) {
  const state = stateManager.getState();

  // Add shift+arrow keys for multi-selection highlighting
  screen.key('S-up', () => {
    // Only handle multi-selection when treeBox has focus
    if (state.activeBox !== 'treeBox') return;

    if (treeBox.selected <= 0) return;

    // Initialize multi-selection if not started
    if (state.multiSelectStartIndex === -1) {
      state.multiSelectStartIndex = treeBox.selected;
      state.highlightedIndices.clear();
    }

    // Move selection up
    treeBox.up();

    // Update highlighted indices
    selectionHandler.updateHighlightedIndices(treeBox);

    // Apply highlighting based on whether we're in search mode or normal mode
    if (state.isSearchActive) {
      // In search mode, we need to re-render the search results with highlights
      searchHandler.displaySearchResultsWithHighlights(treeBox, state.searchResults, true);
    } else {
      // In normal mode, use the standard highlight rendering
      treeView.renderTreeWithHighlights(treeBox);
    }

    // Calculate the scroll position to maintain padding at the top
    const currentSelection = treeBox.selected;
    const paddingLines = 3;
    const scrollPosition = Math.max(0, currentSelection - paddingLines);
    treeBox.scrollTo(scrollPosition);

    screen.render();
  });

  screen.key('S-down', () => {
    // Only handle multi-selection when treeBox has focus
    if (state.activeBox !== 'treeBox') return;

    if (treeBox.selected >= treeBox.items.length - 1) return;

    // Initialize multi-selection if not started
    if (state.multiSelectStartIndex === -1) {
      state.multiSelectStartIndex = treeBox.selected;
      state.highlightedIndices.clear();
    }

    // Move selection down
    treeBox.down();

    // Update highlighted indices
    selectionHandler.updateHighlightedIndices(treeBox);

    // Apply highlighting based on whether we're in search mode or normal mode
    if (state.isSearchActive) {
      // In search mode, we need to re-render the search results with highlights
      searchHandler.displaySearchResultsWithHighlights(treeBox, state.searchResults, true);
    } else {
      // In normal mode, use the standard highlight rendering
      treeView.renderTreeWithHighlights(treeBox);
    }

    // Calculate the scroll position to maintain padding at the top
    const currentSelection = treeBox.selected;
    const paddingLines = 3;
    const scrollPosition = Math.max(0, currentSelection - paddingLines);
    treeBox.scrollTo(scrollPosition);

    screen.render();
  });

  // Clear multi-selection when regular arrow keys are used
  screen.key(['up', 'down', 'left', 'right'], () => {
    // Only clear multi-selection when treeBox has focus
    if (state.activeBox === 'treeBox') {
      // Check if highlighting was active before clearing
      const wasHighlighting = state.highlightedIndices.size > 0;

      // Clear multi-selection state when navigating without shift
      state.multiSelectStartIndex = -1;
      state.highlightedIndices.clear();

      // If highlighting was just active, force a re-render without highlights
      if (wasHighlighting) {
        const currentSelection = treeBox.selected; // Preserve selection
        if (state.isSearchActive) {
          // Use the non-highlighted search display function
          searchHandler.displaySearchResults(treeBox, state.searchResults, true);
        } else {
          // Use the standard tree render function
          treeView.renderTree(treeBox, state.directoryTree);
        }
        // Restore selection as render might reset it
        if (currentSelection < treeBox.items.length) {
          treeBox.select(currentSelection);
        }
        // Ensure focus remains
        treeBox.focus();
        screen.render();
      }
    }
  });
}

/**
 * Setup tab handler to toggle focus between treeBox and infoBox
 * @param {Object} screen - Blessed screen
 * @param {Object} treeBox - Tree box component
 * @param {Object} infoBox - Info box component
 * @param {Object} statusBox - Status box component
 */
function setupTabHandler(screen, treeBox, infoBox, statusBox) {
  const state = stateManager.getState();

  screen.key('tab', () => {
    // Toggle active box
    if (state.activeBox === 'treeBox') {
      // Switch to infoBox if there are selected files
      if (state.selectedFiles.length > 0) {
        state.activeBox = 'infoBox';
        infoBox.focus();
      } else {
        // Show a message in the status box if there are no files to select
        statusBox.setContent('{bold}No files selected.{/bold} Select files in the file explorer first.');
        setTimeout(() => {
          statusView.updateStatus(statusBox, state.isSearchActive, false);
          screen.render();
        }, 2000); // Show message for 2 seconds
      }
    } else {
      // Switch to treeBox
      state.activeBox = 'treeBox';
      treeBox.focus();
    }
    screen.render();
  });
}

/**
 * Setup mode handler for the 'm' key
 * @param {Object} screen - Blessed screen
 * @param {Object} statusBox - Status box component
 * @param {Object} templateSelectBox - Template selection box component
 */
function setupModeHandler(screen, statusBox, templateSelectBox) {
  const state = stateManager.getState();
  const modeHandler = require('../modeHandler');

  screen.key('m', () => {
    // Switch to the next mode in the cycle
    state.currentMode = modeHandler.getNextMode(state.currentMode);

    // Update the status display to show the new mode
    statusView.updateStatus(statusBox, state.isSearchActive, false, templateSelectBox);

    // Update token count as it may change based on mode
    selectionView.updateTokenCount();

    // Show a notification about the mode change
    const modeName = modeHandler.getModeName(state.currentMode);
    statusBox.setContent(`{bold}Mode changed to:{/bold} ${modeName}\n\n` + statusView.updateStatus(statusBox, state.isSearchActive, true, templateSelectBox));

    // Restore the status display after a short delay
    setTimeout(() => {
      statusView.updateStatus(statusBox, state.isSearchActive, false, templateSelectBox);
      screen.render();
    }, 2000);

    screen.render();
  });
}

/**
 * Setup output format handler for the 'o' key
 * @param {Object} screen - Blessed screen
 * @param {Object} statusBox - Status box component
 * @param {Object} templateSelectBox - Template selection box component
 */
function setupOutputFormatHandler(screen, statusBox, templateSelectBox) {
  const state = stateManager.getState();
  const outputHandler = require('../outputHandler');

  screen.key('o', () => {
    // Get the next output format and content inclusion setting
    const nextOutput = outputHandler.getNextOutput(state.currentOutputFormat, state.currentMode, state.includeContents);

    // Update the current output format and content inclusion setting
    state.currentOutputFormat = nextOutput.format;
    state.includeContents = nextOutput.includeContents;

    // Update the status display to show the new output format
    statusView.updateStatus(statusBox, state.isSearchActive, false, templateSelectBox);

    // Update token count as it may change based on output format
    selectionView.updateTokenCount();

    // Show a notification about the output format change
    const outputName = outputHandler.getOutputName(state.currentOutputFormat, state.includeContents, state.currentMode);
    statusBox.setContent(`{bold}Output format changed to:{/bold} ${outputName}\n\n` + statusView.updateStatus(statusBox, state.isSearchActive, true, templateSelectBox));

    // Restore the status display after a short delay
    setTimeout(() => {
      statusView.updateStatus(statusBox, state.isSearchActive, false, templateSelectBox);
      screen.render();
    }, 2000);

    screen.render();
  });
}

/**
 * Setup info box handlers
 * @param {Object} infoBox - Info box component
 * @param {Object} treeBox - Tree box component
 * @param {Object} statusBox - Status box component
 * @param {Object} templateSelectBox - Template selection box component
 * @param {Object} screen - Blessed screen
 */
function setupInfoBoxHandlers(infoBox, treeBox, statusBox, templateSelectBox, screen) {
  const state = stateManager.getState();

  infoBox.on('focus', () => {
    state.activeBox = 'infoBox';
    // Update border styles to show focus
    treeBox.style.border = { fg: 'white' };
    infoBox.style.border = { fg: 'green' };
    screen.render();
  });

  // Add space key handler for infoBox to unselect files
  infoBox.key('space', () => {
    // Ensure infoBox has focus
    state.activeBox = 'infoBox';

    if (state.selectedFiles.length === 0) return;

    // Get the selected file
    const selectedIndex = infoBox.selected;
    if (selectedIndex >= 0 && selectedIndex < state.selectedFiles.length) {
      // Calculate the new selection position after removal
      // If we're removing the last item, select the new last item
      // Otherwise, keep the same index
      const newSelectionIndex = (selectedIndex === state.selectedFiles.length - 1)
        ? Math.max(0, selectedIndex - 1)
        : selectedIndex;

      // Remove the file from selectedFiles
      state.selectedFiles.splice(selectedIndex, 1);

      // Update UI with preserved selection position
      selectionView.updateSelectedFilesWithSelection(infoBox, newSelectionIndex);
      selectionView.updateTokenCount();
      statusView.updateStatus(statusBox, state.isSearchActive, false, templateSelectBox);

      if (state.isSearchActive) {
        searchHandler.displaySearchResults(treeBox, state.searchResults, true);
      } else {
        treeView.renderTree(treeBox, state.directoryTree);
      }

      screen.render();
    }
  });

  // Add focus handler for treeBox
  treeBox.on('focus', () => {
    state.activeBox = 'treeBox';
    // Update border styles to show focus
    treeBox.style.border = { fg: 'green' };
    infoBox.style.border = { fg: 'white' };
    screen.render();
  });
}

/**
 * Setup escape handler
 * @param {Object} screen - Blessed screen
 * @param {Object} treeBox - Tree box component
 * @param {Object} statusBox - Status box component
 * @param {Object} templateSelectBox - Template selection box component
 * @param {Function} resolvePromise - Function to resolve the terminal promise
 */
function setupEscapeHandler(screen, treeBox, statusBox, templateSelectBox, resolvePromise) {
  const state = stateManager.getState();

  screen.key('escape', () => {
    if (state.isSearchActive) {
      // Exit search mode and restore the original tree
      state.isSearchActive = false;
      state.searchResults = [];
      state.searchListToNodeMap = []; // Clear the search list to node map
      treeView.renderTree(treeBox, state.originalTree);
      statusView.updateStatus(statusBox, false, false, templateSelectBox);
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
      resolvePromise(stateManager.getEmptyResult());
    }
  });
}

module.exports = {
  setupKeyHandlers
};
