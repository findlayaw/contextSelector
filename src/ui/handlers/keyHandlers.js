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
const promptHandler = require('./promptHandler');
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
    templateNameBox, confirmationBox, promptBox,
    promptTemplateNameBox, templateLoaderBox,
    fileTemplateList, promptTemplateList
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

    // Skip if template loader is visible
    if (!templateLoaderBox.hidden) return;

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
    handleSpaceSelection(treeBox, infoBox, statusBox, templateLoaderBox, screen);
  });

  // Handle search key
  screen.key('/', () => {
    // Ensure the search box is properly shown
    searchBox.hidden = false;
    searchBox.show();
    searchBox.focus();
    screen.render();
  });

  // Handle template selection key
  screen.key('t', async () => {
    // Show the new template loader instead of the old template selection box
    await promptHandler.showTemplateLoader(templateLoaderBox, fileTemplateList, promptTemplateList, screen);
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
  setupTemplateNameBoxHandlers(templateNameBox, treeBox, statusBox, screen, templateLoaderBox);

  // Template selection box handlers are now handled by setupTemplateLoaderHandlers

  // Add key handlers for up/down navigation to maintain padding
  setupNavigationHandlers(treeBox, screen);

  // Add Vim-like navigation handlers
  setupVimNavigationHandlers(screen, treeBox);

  // Add 'a' key to toggle selection of all visible files
  setupToggleAllHandler(screen, treeBox, infoBox, statusBox, templateLoaderBox);

  // Add shift+arrow keys for multi-selection highlighting
  setupMultiSelectionHandlers(screen, treeBox);

  // Add 'p' key handler to show prompt input box
  setupPromptHandler(screen, promptBox);

  // Add Tab key handler to toggle focus between treeBox and infoBox
  setupTabHandler(screen, treeBox, infoBox, statusBox);

  // Add 'm' key handler to switch between modes
  setupModeHandler(screen, statusBox, templateLoaderBox);

  // Add 'o' key handler to switch between output formats
  setupOutputFormatHandler(screen, statusBox, templateLoaderBox);

  // Add key handlers for infoBox
  setupInfoBoxHandlers(infoBox, treeBox, screen);

  // Add key handlers for promptBox
  setupPromptBoxHandlers(promptBox, promptTemplateNameBox, screen);

  // Add key handlers for promptTemplateNameBox
  setupPromptTemplateNameBoxHandlers(promptTemplateNameBox, promptBox, statusBox, screen);

  // Add key handlers for templateLoaderBox
  setupTemplateLoaderHandlers(templateLoaderBox, fileTemplateList, promptTemplateList, treeBox, infoBox, statusBox, confirmationBox, screen);

  // Add escape key handler
  setupEscapeHandler(screen, templateLoaderBox, promptBox, promptTemplateNameBox, treeBox, statusBox, resolvePromise);
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
 * @param {Object} templateLoaderBox - Template loader box component
 */
function setupTemplateNameBoxHandlers(templateNameBox, treeBox, statusBox, screen, templateLoaderBox) {
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
      templateHandler.saveTemplateInfo(templateName, statusBox, state.isSearchActive, templateLoaderBox);
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
 * Setup template selection box event handlers (DEPRECATED - replaced by templateLoaderHandlers)
 * @param {Object} templateSelectBox - Template selection box component
 * @param {Object} treeBox - Tree box component
 * @param {Object} infoBox - Info box component
 * @param {Object} statusBox - Status box component
 * @param {Object} confirmationBox - Confirmation box component
 * @param {Object} screen - Blessed screen
 */
// This function is no longer used, but kept for reference
/* function _deprecatedSetupTemplateSelectionBoxHandlers(templateSelectBox, treeBox, infoBox, statusBox, confirmationBox, screen) {
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

    await templateHandler.loadTemplate(templateName, infoBox, treeBox, statusBox, templateLoaderBox);

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
    // Get components from the current scope
    const components = screen.children;
    const templateLoaderBoxComponent = components.find(c => c.options && c.options.label && c.options.label.includes('Template Loader'));

    // Skip if template loader is visible - let its own tab handler handle it
    if (templateLoaderBoxComponent && !templateLoaderBoxComponent.hidden) {
      return;
    }

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
 * @param {Object} templateLoaderBox - Template loader box component
 */
function setupModeHandler(screen, statusBox, templateLoaderBox) {
  const state = stateManager.getState();
  const modeHandler = require('../modeHandler');

  screen.key('m', () => {
    // Switch to the next mode in the cycle
    state.currentMode = modeHandler.getNextMode(state.currentMode);

    // Update the status display to show the new mode
    statusView.updateStatus(statusBox, state.isSearchActive, false, templateLoaderBox);

    // Update token count as it may change based on mode
    selectionView.updateTokenCount();

    // Show a notification about the mode change
    const modeName = modeHandler.getModeName(state.currentMode);
    statusBox.setContent(`{bold}Mode changed to:{/bold} ${modeName}\n\n` + statusView.updateStatus(statusBox, state.isSearchActive, true, templateLoaderBox));

    // Restore the status display after a short delay
    setTimeout(() => {
      statusView.updateStatus(statusBox, state.isSearchActive, false);
      screen.render();
    }, 2000);

    screen.render();
  });
}

/**
 * Setup output format handler for the 'o' key
 * @param {Object} screen - Blessed screen
 * @param {Object} statusBox - Status box component
 * @param {Object} templateLoaderBox - Template loader box component
 */
function setupOutputFormatHandler(screen, statusBox, templateLoaderBox) {
  const state = stateManager.getState();
  const outputHandler = require('../outputHandler');

  screen.key('o', () => {
    // Get the next output format and content inclusion setting
    const nextOutput = outputHandler.getNextOutput(state.currentOutputFormat, state.currentMode, state.includeContents);

    // Update the current output format and content inclusion setting
    state.currentOutputFormat = nextOutput.format;
    state.includeContents = nextOutput.includeContents;

    // Update the status display to show the new output format
    statusView.updateStatus(statusBox, state.isSearchActive, false, templateLoaderBox);

    // Update token count as it may change based on output format
    selectionView.updateTokenCount();

    // Show a notification about the output format change
    const outputName = outputHandler.getOutputName(state.currentOutputFormat, state.includeContents, state.currentMode);
    statusBox.setContent(`{bold}Output format changed to:{/bold} ${outputName}\n\n` + statusView.updateStatus(statusBox, state.isSearchActive, true, templateLoaderBox));

    // Restore the status display after a short delay
    setTimeout(() => {
      statusView.updateStatus(statusBox, state.isSearchActive, false);
      screen.render();
    }, 2000);

    screen.render();
  });
}

/**
 * Setup info box handlers
 * @param {Object} infoBox - Info box component
 * @param {Object} treeBox - Tree box component
 * @param {Object} screen - Blessed screen
 */
function setupInfoBoxHandlers(infoBox, treeBox, screen) {
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

      // Get the status box component
      const components = screen.children;
      const statusBoxComponent = components.find(c => c.options && c.options.label === ' Status ');
      const templateLoaderBoxComponent = components.find(c => c.options && c.options.label && c.options.label.includes('Template Loader'));

      if (statusBoxComponent) {
        statusView.updateStatus(statusBoxComponent, state.isSearchActive, false, templateLoaderBoxComponent);
      }

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
 * @param {Object} templateLoaderBox - Template loader box component
 * @param {Object} promptBox - Prompt box component
 * @param {Object} promptTemplateNameBox - Prompt template name box component
 * @param {Object} treeBox - Tree box component
 * @param {Object} statusBox - Status box component
 * @param {Function} resolvePromise - Function to resolve the terminal promise
 */
function setupEscapeHandler(screen, templateLoaderBox, promptBox, promptTemplateNameBox, treeBox, statusBox, resolvePromise) {
  const state = stateManager.getState();

  screen.key('escape', () => {
    if (state.isSearchActive) {
      // Exit search mode and restore the original tree
      state.isSearchActive = false;
      state.searchResults = [];
      state.searchListToNodeMap = []; // Clear the search list to node map
      treeView.renderTree(treeBox, state.originalTree);
      statusView.updateStatus(statusBox, false, false, templateLoaderBox);
      screen.render();
    } else if (!templateLoaderBox.hidden) {
      // Close the template loader UI and return to main UI
      templateLoaderBox.hidden = true;
      templateLoaderBox.hide();
      treeBox.focus();
      // Force a complete redraw of the screen
      screen.clearRegion(0, screen.width, 0, screen.height);
      screen.render();
    } else if (!promptBox.hidden) {
      // Close the prompt box and return to main UI
      // Save the current prompt content to state first
      state.currentPrompt = promptBox.getValue();
      promptBox.hidden = true;
      promptBox.hide();
      treeBox.focus();
      screen.render();
    } else if (!promptTemplateNameBox.hidden) {
      // Close the prompt template name box and return to prompt box
      promptTemplateNameBox.hidden = true;
      promptTemplateNameBox.hide();
      promptBox.show();
      promptBox.focus();
      screen.render();
    } else {
      // Regular escape behavior (quit) - only when not in any special mode
      screen.destroy();
      resolvePromise(stateManager.getEmptyResult());
    }
  });
}

/**
 * Setup prompt handler for 'p' key
 * @param {Object} screen - Blessed screen
 * @param {Object} promptBox - Prompt box component
 * @param {Object} treeBox - Tree box component (not used but kept for consistency)
 * @param {Object} infoBox - Info box component (not used but kept for consistency)
 * @param {Object} statusBox - Status box component (not used but kept for consistency)
 */
function setupPromptHandler(screen, promptBox) {
  screen.key('p', () => {
    // Get components from the current scope
    const components = screen.children;
    // Find the components we need to check
    const searchBoxComponent = components.find(c => c.options && c.options.label === ' Search ');
    const templateNameBoxComponent = components.find(c => c.options && c.options.label === ' Save Template As ');
    const promptTemplateNameBoxComponent = components.find(c => c.options && c.options.label === ' Save Prompt Template As ');
    const templateLoaderBoxComponent = components.find(c => c.options && c.options.label && c.options.label.includes('Template Loader'));
    const confirmationBoxComponent = components.find(c => c.options && c.options.label === ' Confirm ');

    // Only activate if no other input box is currently active
    if ((searchBoxComponent && searchBoxComponent.hidden) &&
        (templateNameBoxComponent && templateNameBoxComponent.hidden) &&
        (promptTemplateNameBoxComponent && promptTemplateNameBoxComponent.hidden) &&
        (templateLoaderBoxComponent && templateLoaderBoxComponent.hidden) &&
        (confirmationBoxComponent && confirmationBoxComponent.hidden)) {
      promptHandler.showPromptInput(promptBox, screen);
    }
  });
}

/**
 * Setup prompt box handlers
 * @param {Object} promptBox - Prompt box component
 * @param {Object} promptTemplateNameBox - Prompt template name box component
 * @param {Object} treeBox - Tree box component
 * @param {Object} infoBox - Info box component
 * @param {Object} statusBox - Status box component
 * @param {Object} screen - Blessed screen
 */
function setupPromptBoxHandlers(promptBox, promptTemplateNameBox, screen) {
  const state = stateManager.getState();

  // Handle escape to close prompt box (now handled in setupEscapeHandler)

  // We're now handling Enter and Shift+Enter in the promptHandler.js file
  // by overriding the _listener method of the promptBox

  // Handle Ctrl+S for saving prompt template
  promptBox.key('C-s', () => {
    // Hide promptBox temporarily, show promptTemplateNameBox
    state.currentPrompt = promptBox.getValue(); // Save content to state
    promptBox.hide();
    promptTemplateNameBox.clearValue();
    promptTemplateNameBox.hidden = false;
    promptTemplateNameBox.show();
    promptTemplateNameBox.focus();
    screen.render();
  });
}

/**
 * Setup prompt template name box handlers
 * @param {Object} promptTemplateNameBox - Prompt template name box component
 * @param {Object} promptBox - Prompt box component
 * @param {Object} statusBox - Status box component
 * @param {Object} screen - Blessed screen
 */
function setupPromptTemplateNameBoxHandlers(promptTemplateNameBox, promptBox, statusBox, screen) {
  const state = stateManager.getState();

  // Handle escape and ctrl+c to cancel template name input (now handled in setupEscapeHandler)

  // Handle enter to save prompt template
  promptTemplateNameBox.key('enter', async () => {
    const templateName = promptTemplateNameBox.getValue();
    promptTemplateNameBox.hide();
    promptTemplateNameBox.hidden = true;

    if (templateName) {
      const promptContent = state.currentPrompt;
      try {
        promptHandler.savePromptTemplateInfo(templateName, promptContent, statusBox);
        statusBox.setContent(`Prompt template "${templateName}" will be saved when you exit.`);
      } catch(err) {
        statusBox.setContent(`{red-fg}Error saving prompt template: ${err.message}{/red-fg}`);
      }
    }

    // Return focus to promptBox
    promptBox.show();
    promptBox.focus();
    screen.render();

    // Clear message after timeout
    const components = screen.children;
    const templateLoaderBoxComponent = components.find(c => c.options && c.options.label && c.options.label.includes('Template Loader'));

    setTimeout(() => {
      statusView.updateStatus(statusBox, state.isSearchActive, false, templateLoaderBoxComponent);
      screen.render();
    }, 2000);
  });
}

/**
 * Setup template loader handlers
 * @param {Object} templateLoaderBox - Template loader box component
 * @param {Object} fileTemplateList - File template list component
 * @param {Object} promptTemplateList - Prompt template list component
 * @param {Object} treeBox - Tree box component
 * @param {Object} infoBox - Info box component
 * @param {Object} statusBox - Status box component
 * @param {Object} confirmationBox - Confirmation box component
 * @param {Object} screen - Blessed screen
 */
function setupTemplateLoaderHandlers(templateLoaderBox, fileTemplateList, promptTemplateList, treeBox, infoBox, statusBox, confirmationBox, screen) {
  const state = stateManager.getState();

  // Handle Tab to switch focus between file and prompt templates
  templateLoaderBox.key('tab', () => {
    // Handle tab key in the template loader box
    if (templateLoaderBox.hidden) return;

    // Stop event propagation to prevent the global tab handler from handling it
    screen.lockKeys = true;

    if (state.templateLoaderFocus === 'files') {
      state.templateLoaderFocus = 'prompts';
      promptTemplateList.focus();
      promptTemplateList.style.border = { fg: 'green' };
      fileTemplateList.style.border = { fg: 'white' };
    } else {
      state.templateLoaderFocus = 'files';
      fileTemplateList.focus();
      fileTemplateList.style.border = { fg: 'green' };
      promptTemplateList.style.border = { fg: 'white' };
    }

    screen.render();

    // Unlock keys after handling
    screen.lockKeys = false;

    // Return true to indicate we've handled the event
    return true;
  });

  // Add tab key handlers to the file and prompt template lists
  fileTemplateList.key('tab', () => {
    if (templateLoaderBox.hidden) return;

    // Switch to prompt templates
    state.templateLoaderFocus = 'prompts';
    promptTemplateList.focus();
    promptTemplateList.style.border = { fg: 'green' };
    fileTemplateList.style.border = { fg: 'white' };

    screen.render();
    return true;
  });

  // Add enter key handler to file template list
  fileTemplateList.key('enter', async () => {
    if (templateLoaderBox.hidden) return;

    const selectedItem = fileTemplateList.getItem(fileTemplateList.selected);
    if (!selectedItem || selectedItem.content === 'No file templates') return;

    const templateName = selectedItem.content;
    const success = await templateHandler.loadTemplate(templateName, infoBox, treeBox, statusBox, templateLoaderBox);

    templateLoaderBox.hide();
    templateLoaderBox.hidden = true;
    treeBox.focus();

    if (success) {
      statusBox.setContent(`File template "${templateName}" loaded.`);
    } else {
      statusBox.setContent(`{red-fg}Failed to load file template "${templateName}".{/red-fg}`);
    }

    screen.render();

    setTimeout(() => {
      statusView.updateStatus(statusBox, state.isSearchActive, false);
      screen.render();
    }, 2000);

    return true;
  });

  // Add space key handler to file template list (same as enter)
  fileTemplateList.key('space', async () => {
    if (templateLoaderBox.hidden) return;

    const selectedItem = fileTemplateList.getItem(fileTemplateList.selected);
    if (!selectedItem || selectedItem.content === 'No file templates') return;

    const templateName = selectedItem.content;
    const success = await templateHandler.loadTemplate(templateName, infoBox, treeBox, statusBox, templateLoaderBox);

    templateLoaderBox.hide();
    templateLoaderBox.hidden = true;
    treeBox.focus();

    if (success) {
      statusBox.setContent(`File template "${templateName}" loaded.`);
    } else {
      statusBox.setContent(`{red-fg}Failed to load file template "${templateName}".{/red-fg}`);
    }

    screen.render();

    setTimeout(() => {
      statusView.updateStatus(statusBox, state.isSearchActive, false);
      screen.render();
    }, 2000);

    return true;
  });

  promptTemplateList.key('tab', () => {
    if (templateLoaderBox.hidden) return;

    // Switch to file templates
    state.templateLoaderFocus = 'files';
    fileTemplateList.focus();
    fileTemplateList.style.border = { fg: 'green' };
    promptTemplateList.style.border = { fg: 'white' };

    screen.render();
    return true;
  });

  // Add enter key handler to prompt template list to load all selected templates
  promptTemplateList.key('enter', async () => {
    if (templateLoaderBox.hidden) return;

    // Get the promptBox and statusBox from screen's children
    const components = screen.children;
    const promptBoxComponent = components.find(c => c.options && c.options.label && c.options.label.includes('Prompt (Shift+Enter'));
    const statusBoxComponent = components.find(c => c.options && c.options.label === ' Status ');

    if (!promptBoxComponent || !statusBoxComponent) return;

    // If no templates are selected, select the currently highlighted one
    if (state.selectedPromptTemplates.length === 0) {
      const selectedItem = promptTemplateList.getItem(promptTemplateList.selected);
      if (!selectedItem || selectedItem.content === 'No prompt templates') return;

      // Check if the item is already marked as selected (has a checkmark)
      let templateName = selectedItem.content;
      if (templateName.startsWith('✓ ')) {
        templateName = templateName.substring(2);
      }

      state.selectedPromptTemplates.push(templateName);
    }

    // Load all selected templates
    let loadedTemplates = [];

    for (const templateName of state.selectedPromptTemplates) {
      const success = await promptHandler.loadPromptTemplate(templateName, promptBoxComponent, statusBoxComponent);
      if (success) {
        loadedTemplates.push(templateName);
      }
    }

    // Close the template loader
    templateLoaderBox.hide();
    templateLoaderBox.hidden = true;
    treeBox.focus();

    // Show status message
    if (loadedTemplates.length > 0) {
      if (loadedTemplates.length === 1) {
        statusBoxComponent.setContent(`Prompt template "${loadedTemplates[0]}" loaded.`);
      } else {
        statusBoxComponent.setContent(`Loaded ${loadedTemplates.length} prompt templates: "${loadedTemplates.join('", "')}".`);
      }
    } else {
      statusBoxComponent.setContent(`{red-fg}Failed to load any prompt templates.{/red-fg}`);
    }

    // Clear the selected templates array
    state.selectedPromptTemplates = [];

    screen.render();

    setTimeout(() => {
      statusView.updateStatus(statusBoxComponent, state.isSearchActive, false);
      screen.render();
    }, 2000);

    return true;
  });

  // Add space key handler to prompt template list for multi-selection
  promptTemplateList.key('space', () => {
    if (templateLoaderBox.hidden) return;

    const selectedItem = promptTemplateList.getItem(promptTemplateList.selected);
    if (!selectedItem || selectedItem.content === 'No prompt templates') return;

    const templateName = selectedItem.content;
    const statusBoxComponent = screen.children.find(c => c.options && c.options.label === ' Status ');

    // Toggle selection of this template
    const index = state.selectedPromptTemplates.indexOf(templateName);
    if (index === -1) {
      // Add to selected templates
      state.selectedPromptTemplates.push(templateName);
      // Update the display to show it's selected
      selectedItem.content = `✓ ${templateName}`;

      if (statusBoxComponent) {
        statusBoxComponent.setContent(`Selected prompt template: "${templateName}". Press Enter to load selected templates.`);
      }
    } else {
      // Remove from selected templates
      state.selectedPromptTemplates.splice(index, 1);
      // Update the display to show it's not selected
      selectedItem.content = templateName.replace(/^✓\s*/, '');

      if (statusBoxComponent) {
        statusBoxComponent.setContent(`Unselected prompt template: "${templateName}".`);
      }
    }

    // Move to the next item in the list
    if (promptTemplateList.selected < promptTemplateList.items.length - 1) {
      promptTemplateList.down(1);
    }

    screen.render();
    return true;
  });

  // Handle Enter to load selected template
  templateLoaderBox.key('enter', async () => {
    if (templateLoaderBox.hidden) return;

    // This handler is now only used for file templates
    // Prompt templates have their own enter handler that handles multi-selection
    if (state.templateLoaderFocus === 'files') {
      const selectedItem = fileTemplateList.getItem(fileTemplateList.selected);
      if (!selectedItem || selectedItem.content === 'No file templates') return;

      const templateName = selectedItem.content;
      const success = await templateHandler.loadTemplate(templateName, infoBox, treeBox, statusBox, templateLoaderBox);

      templateLoaderBox.hide();
      templateLoaderBox.hidden = true;
      treeBox.focus();

      if (success) {
        statusBox.setContent(`File template "${templateName}" loaded.`);
      } else {
        statusBox.setContent(`{red-fg}Failed to load file template "${templateName}".{/red-fg}`);
      }

      screen.render();

      setTimeout(() => {
        statusView.updateStatus(statusBox, state.isSearchActive, false);
        screen.render();
      }, 2000);
    } else {
      // For prompt templates, trigger the enter key on the promptTemplateList
      // This will use the multi-selection handler we defined earlier
      promptTemplateList.emit('keypress', null, { name: 'enter' });
    }
  });

  // Handle 'd' to delete selected template
  templateLoaderBox.key('d', async () => {
    if (templateLoaderBox.hidden) return;

    let listComponent;
    let templateManagerRef;
    let itemType = '';

    if (state.templateLoaderFocus === 'files') {
      listComponent = fileTemplateList;
      templateManagerRef = require('../../templates/manager');
      itemType = 'File';
    } else {
      listComponent = promptTemplateList;
      templateManagerRef = require('../../prompts/manager');
      itemType = 'Prompt';
    }

    const selectedItem = listComponent.getItem(listComponent.selected);
    if (!selectedItem || selectedItem.content.startsWith('No ')) return;

    const templateName = selectedItem.content;

    // Show confirmation dialog
    statusView.showConfirmationDialog(confirmationBox, `Delete ${itemType} template "${templateName}"? (y/n)`, async (confirmed) => {
      if (confirmed) {
        let deleteSuccess = false;
        if (itemType === 'File') {
          deleteSuccess = await templateManagerRef.deleteTemplate(templateName);
        } else {
          deleteSuccess = await templateManagerRef.deletePromptTemplate(templateName);
        }

        // Refresh the correct list
        const templates = itemType === 'File' ?
          await templateManagerRef.listTemplates() :
          await templateManagerRef.listPromptTemplates();

        listComponent.setItems(templates.length > 0 ? templates : [`No ${itemType.toLowerCase()} templates`]);

        statusBox.setContent(deleteSuccess ?
          `${itemType} template "${templateName}" deleted.` :
          `{red-fg}Failed to delete ${itemType} template "${templateName}".{/red-fg}`);
      }

      // Return focus to the loader box
      listComponent.focus();
      screen.render();

      setTimeout(() => {
        statusView.updateStatus(statusBox, state.isSearchActive, false);
        screen.render();
      }, 2000);
    });

    screen.render();
  });
}

module.exports = {
  setupKeyHandlers
};
