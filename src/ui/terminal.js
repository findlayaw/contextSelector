const blessed = require('blessed');
const path = require('path');
const fs = require('fs');
const fileSystem = require('../simpleFileSystem');
const search = require('../utils/search');
const tokenCounter = require('../utils/tokenCounter');
const templateManager = require('../templates/manager');
const graphAnalyzer = require('../graph/analyzer');
const modeHandler = require('./modeHandler');

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
let groupedResults = {};
let searchListToNodeMap = []; // Map display indices to actual nodes in search mode

// Store template to save
let templateToSave = null;
// Store files to be saved in the template (snapshot at time of saving)
let templateFiles = [];

// Store multi-selection state
let multiSelectStartIndex = -1;
let highlightedIndices = new Set();

// Track which box has focus (treeBox or infoBox)
let activeBox = 'treeBox';

// Current application mode
let currentMode = modeHandler.MODES.STANDARD;

/**
 * Start the terminal UI
 * @param {Object} options - UI options
 * @returns {Promise<Object>} - Result with selected files and other data
 */
async function start(options) {
  // Set initial mode based on options
  currentMode = options.graphMode ? modeHandler.MODES.GRAPH : modeHandler.MODES.STANDARD;

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
          // Check if each file in the template exists
          const validSelectedFiles = [];
          const missingFiles = [];

          for (const fileFromTemplate of template.files) {
            // Check if the file path stored in the template actually exists
            if (fs.existsSync(fileFromTemplate.path)) {
              validSelectedFiles.push(fileFromTemplate);
            } else {
              // Keep track of files that couldn't be found
              missingFiles.push(fileFromTemplate.relativePath || fileFromTemplate.path);
            }
          }

          selectedFiles = validSelectedFiles; // Assign only the files that were found

          // Notify the user if some files were missing
          if (missingFiles.length > 0) {
            const missingFilesList = missingFiles.join('\n  - ');
            // Temporarily show a message in the status box
            statusBox.setContent(`{yellow-fg}Warning: The following files from the template were not found and were skipped:{/yellow-fg}\n  - ${missingFilesList}\n\n(Loading remaining files...)`);
            screen.render(); // Render the temporary message
            // Wait a bit before showing the final status update
            await new Promise(resolve => setTimeout(resolve, 3000)); // Show warning for 3 seconds
          }

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
        resolve({ selectedFiles: [], directoryTree: null, tokenCount: 0, saveTemplate: null, templateFiles: null, mode: currentMode });
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
        // Skip if infoBox has focus - let the infoBox space handler handle it
        if (activeBox === 'infoBox') return;

        // Check if we have highlighted items for multi-selection
        if (highlightedIndices.size > 0) {
          if (isSearchActive) {
            // In search mode, use the searchListToNodeMap to directly access nodes
            highlightedIndices.forEach(index => {
              if (index >= 0 && index < searchListToNodeMap.length) {
                const node = searchListToNodeMap[index];
                if (node) { // Only act if we have a valid node mapped
                  if (node.type === 'file') {
                    toggleFileSelection(node);
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
            highlightedIndices.forEach(index => {
              if (index < flattenedTree.length) {
                const node = flattenedTree[index];
                if (node.type === 'file') {
                  toggleFileSelection(node);
                } else if (node.type === 'directory') {
                  selectAllFilesInDirectory(node);
                }
              }
            });
          }

          // Clear the multi-selection state
          multiSelectStartIndex = -1;
          highlightedIndices.clear();

          // Update UI
          updateSelectedFiles(infoBox);
          updateTokenCount();
          updateStatus(statusBox, isSearchActive, false, templateSelectBox);

          if (isSearchActive) {
            displaySearchResults(treeBox, searchResults, true);
          } else {
            renderTree(treeBox, directoryTree);
          }

          screen.render();
          return;
        }

        if (isSearchActive) {
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
            const matchingNodes = searchResults.filter(node =>
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
            const matchingNodes = searchResults.filter(node =>
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
              toggleFileSelection(selectedNode);
            } else if (selectedNode.type === 'directory') {
              selectAllFilesInDirectory(selectedNode);
            }
          } else {
            // If we couldn't find a node, try a more aggressive approach
            // Look for any node that might match the selected item
            const contentWithoutFormatting = itemContent.replace(/\{[^}]+\}/g, '');

            // Try to find any file or directory that might be related to this content
            for (const node of searchResults) {
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
                toggleFileSelection(selectedNode);
              } else if (selectedNode.type === 'directory') {
                selectAllFilesInDirectory(selectedNode);
              }
            } else {
              console.error(`Could not find node for selected item: ${itemContent}`);
            }
          }

          updateSelectedFiles(infoBox);
          updateTokenCount();
          updateStatus(statusBox, true, false, templateSelectBox);

          // Update the display to show the selection, preserving the current selection position
          if (highlightedIndices.size > 0) {
            displaySearchResultsWithHighlights(treeBox, searchResults, true);
          } else {
            displaySearchResults(treeBox, searchResults, true);
          }
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
            templateFiles: templateFiles.length > 0 ? templateFiles : null,
            mode: currentMode
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
          searchListToNodeMap = []; // Clear the search list to node map
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
          resolve({ selectedFiles: [], directoryTree: null, tokenCount: 0, saveTemplate: null, templateFiles: null, mode: currentMode });
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
          // Check if each file in the template exists
          const validSelectedFiles = [];
          const missingFiles = [];

          for (const fileFromTemplate of template.files) {
            // Check if the file path stored in the template actually exists
            if (fs.existsSync(fileFromTemplate.path)) {
              validSelectedFiles.push(fileFromTemplate);
            } else {
              // Keep track of files that couldn't be found
              missingFiles.push(fileFromTemplate.relativePath || fileFromTemplate.path);
            }
          }

          selectedFiles = validSelectedFiles; // Assign only the files that were found

          // Notify the user if some files were missing
          if (missingFiles.length > 0) {
            const missingFilesList = missingFiles.join('\n  - ');
            // Temporarily show a message in the status box
            statusBox.setContent(`{yellow-fg}Warning: The following files from the template were not found and were skipped:{/yellow-fg}\n  - ${missingFilesList}\n\n(Loading remaining files...)`);
            screen.render(); // Render the temporary message
            // Wait a bit before showing the final status update
            await new Promise(resolve => setTimeout(resolve, 3000)); // Show warning for 3 seconds
          }

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

      // Add Vim-like navigation: h (left/parent directory)
      screen.key('h', () => {
        // Only handle when treeBox has focus and not in search mode
        if (activeBox !== 'treeBox' || isSearchActive) return;

        const node = getCurrentNode(treeBox);
        if (!node) return;

        // Get the parent directory path
        const parentPath = path.dirname(node.path);

        // If we're already at the root, do nothing
        if (parentPath === node.path) return;

        // Find the parent node in our flattened tree
        const parentNode = flattenedTree.find(n => n.path === parentPath);
        if (!parentNode) return;

        // Find the index of the parent node
        const parentIndex = flattenedTree.indexOf(parentNode);
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
        if (activeBox !== 'treeBox' || isSearchActive) return;

        const node = getCurrentNode(treeBox);
        if (!node) return;

        if (node.type === 'directory') {
          // If directory is not expanded, expand it
          if (!isNodeExpanded(node)) {
            expandedDirs.add(node.path);
            renderTree(treeBox, directoryTree);
          }
          // If directory has children and is already expanded, select the first child
          else if (node.children && node.children.length > 0) {
            // Find the index of the first child in the flattened tree
            const firstChildIndex = flattenedTree.findIndex(n =>
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
        if (activeBox !== 'treeBox') return;
        treeBox.select(0);
        treeBox.scrollTo(0);
        screen.render();
      });

      // Add Vim-like navigation: G (jump to bottom)
      screen.key('G', () => {
        // Only handle when treeBox has focus
        if (activeBox !== 'treeBox') return;
        const lastIndex = treeBox.items.length - 1;
        treeBox.select(lastIndex);

        // Calculate the scroll position to show the last item at the bottom
        const visibleHeight = treeBox.height - 2; // Account for borders
        const scrollPosition = Math.max(0, lastIndex - visibleHeight + 1);
        treeBox.scrollTo(scrollPosition);

        screen.render();
      });

      // Add 'a' key to toggle selection of all visible files
      screen.key('a', () => {
        // Only handle when treeBox has focus
        if (activeBox !== 'treeBox') return;
        if (isSearchActive) {
          // In search mode, toggle all visible files in search results
          const allSelected = searchResults.every(node => {
            if (node.type === 'file') return isFileSelected(node);
            if (node.type === 'directory') return areAllFilesInDirectorySelected(node);
            return true;
          });

          // Toggle selection based on current state
          searchResults.forEach(node => {
            if (node.type === 'file') {
              if (allSelected) {
                // Deselect if all are selected
                const index = selectedFiles.findIndex(f => f.path === node.path);
                if (index !== -1) selectedFiles.splice(index, 1);
              } else if (!isFileSelected(node)) {
                // Select if not all are selected
                selectedFiles.push(node);
              }
            } else if (node.type === 'directory') {
              if (allSelected) {
                deselectAllFilesInDirectory(node);
              } else {
                selectAllFilesInSubdirectory(node);
              }
            }
          });

          updateSelectedFiles(infoBox);
          updateTokenCount();
          updateStatus(statusBox, true, false, templateSelectBox);
          displaySearchResults(treeBox, searchResults, true);
        } else {
          // In normal mode, toggle all visible files in the current view
          const visibleNodes = flattenedTree;
          const allSelected = visibleNodes.every(node => {
            if (node.type === 'file') return isFileSelected(node);
            if (node.type === 'directory') return areAllFilesInDirectorySelected(node);
            return true;
          });

          // Toggle selection based on current state
          visibleNodes.forEach(node => {
            if (node.type === 'file') {
              if (allSelected) {
                // Deselect if all are selected
                const index = selectedFiles.findIndex(f => f.path === node.path);
                if (index !== -1) selectedFiles.splice(index, 1);
              } else if (!isFileSelected(node)) {
                // Select if not all are selected
                selectedFiles.push(node);
              }
            } else if (node.type === 'directory') {
              if (allSelected) {
                deselectAllFilesInDirectory(node);
              } else {
                selectAllFilesInSubdirectory(node);
              }
            }
          });

          updateSelectedFiles(infoBox);
          updateTokenCount();
          updateStatus(statusBox, false, false, templateSelectBox);
          renderTree(treeBox, directoryTree);
        }

        screen.render();
      });

      // Add shift+arrow keys for multi-selection highlighting
      screen.key('S-up', () => {
        // Only handle multi-selection when treeBox has focus
        if (activeBox !== 'treeBox') return;

        if (treeBox.selected <= 0) return;

        // Initialize multi-selection if not started
        if (multiSelectStartIndex === -1) {
          multiSelectStartIndex = treeBox.selected;
          highlightedIndices.clear();
        }

        // Move selection up
        treeBox.up();

        // Update highlighted indices
        updateHighlightedIndices(treeBox);

        // Apply highlighting based on whether we're in search mode or normal mode
        if (isSearchActive) {
          // In search mode, we need to re-render the search results with highlights
          displaySearchResultsWithHighlights(treeBox, searchResults, true);
        } else {
          // In normal mode, use the standard highlight rendering
          renderTreeWithHighlights(treeBox);
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
        if (activeBox !== 'treeBox') return;

        if (treeBox.selected >= treeBox.items.length - 1) return;

        // Initialize multi-selection if not started
        if (multiSelectStartIndex === -1) {
          multiSelectStartIndex = treeBox.selected;
          highlightedIndices.clear();
        }

        // Move selection down
        treeBox.down();

        // Update highlighted indices
        updateHighlightedIndices(treeBox);

        // Apply highlighting based on whether we're in search mode or normal mode
        if (isSearchActive) {
          // In search mode, we need to re-render the search results with highlights
          displaySearchResultsWithHighlights(treeBox, searchResults, true);
        } else {
          // In normal mode, use the standard highlight rendering
          renderTreeWithHighlights(treeBox);
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
        if (activeBox === 'treeBox') {
          // Check if highlighting was active before clearing
          const wasHighlighting = highlightedIndices.size > 0;

          // Clear multi-selection state when navigating without shift
          multiSelectStartIndex = -1;
          highlightedIndices.clear();

          // If highlighting was just active, force a re-render without highlights
          if (wasHighlighting) {
            const currentSelection = treeBox.selected; // Preserve selection
            if (isSearchActive) {
              // Use the non-highlighted search display function
              displaySearchResults(treeBox, searchResults, true);
            } else {
              // Use the standard tree render function
              renderTree(treeBox, directoryTree);
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

      // Add Tab key handler to toggle focus between treeBox and infoBox
      screen.key('tab', () => {
        // Toggle active box
        if (activeBox === 'treeBox') {
          // Switch to infoBox if there are selected files
          if (selectedFiles.length > 0) {
            activeBox = 'infoBox';
            infoBox.focus();
          } else {
            // Show a message in the status box if there are no files to select
            statusBox.setContent('{bold}No files selected.{/bold} Select files in the file explorer first.');
            setTimeout(() => {
              updateStatus(statusBox, isSearchActive, false, templateSelectBox);
              screen.render();
            }, 2000); // Show message for 2 seconds
          }
        } else {
          // Switch to treeBox
          activeBox = 'treeBox';
          treeBox.focus();
        }
        screen.render();
      });

      // Add 'm' key handler to switch between modes
      screen.key('m', () => {
        // Switch to the next mode in the cycle
        currentMode = modeHandler.getNextMode(currentMode);

        // Update the status display to show the new mode
        updateStatus(statusBox, isSearchActive, false, templateSelectBox);

        // Update token count as it may change based on mode
        updateTokenCount();

        // Show a notification about the mode change
        const modeName = modeHandler.getModeName(currentMode);
        statusBox.setContent(`{bold}Mode changed to:{/bold} ${modeName}\n\n` + updateStatus(statusBox, isSearchActive, true, templateSelectBox));

        // Restore the status display after a short delay
        setTimeout(() => {
          updateStatus(statusBox, isSearchActive, false, templateSelectBox);
          screen.render();
        }, 2000);

        screen.render();
      });

      // Add key handlers for infoBox
      infoBox.on('focus', () => {
        activeBox = 'infoBox';
        // Update border styles to show focus
        treeBox.style.border = { fg: 'white' };
        infoBox.style.border = { fg: 'green' };
        screen.render();
      });

      // Add space key handler for infoBox to unselect files
      infoBox.key('space', () => {
        // Ensure infoBox has focus
        activeBox = 'infoBox';

        if (selectedFiles.length === 0) return;

        // Get the selected file
        const selectedIndex = infoBox.selected;
        if (selectedIndex >= 0 && selectedIndex < selectedFiles.length) {
          // Calculate the new selection position after removal
          // If we're removing the last item, select the new last item
          // Otherwise, keep the same index
          const newSelectionIndex = (selectedIndex === selectedFiles.length - 1)
            ? Math.max(0, selectedIndex - 1)
            : selectedIndex;

          // Remove the file from selectedFiles
          selectedFiles.splice(selectedIndex, 1);

          // Update UI with preserved selection position
          updateSelectedFilesWithSelection(infoBox, newSelectionIndex);
          updateTokenCount();
          updateStatus(statusBox, isSearchActive, false, templateSelectBox);

          if (isSearchActive) {
            displaySearchResults(treeBox, searchResults, true);
          } else {
            renderTree(treeBox, directoryTree);
          }

          screen.render();
        }
      });

      // Add focus handler for treeBox
      treeBox.on('focus', () => {
        activeBox = 'treeBox';
        // Update border styles to show focus
        treeBox.style.border = { fg: 'green' };
        infoBox.style.border = { fg: 'white' };
        screen.render();
      });

      // Set focus to the tree box and update border styles
      activeBox = 'treeBox';
      treeBox.focus();
      treeBox.style.border = { fg: 'green' };
      infoBox.style.border = { fg: 'white' };

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

    // Calculate the scroll position to maintain padding at the top
    const currentSelection = box.selected;
    const paddingLines = 3; // Number of lines to show above the selected item
    const scrollPosition = Math.max(0, currentSelection - paddingLines);

    // Scroll to the calculated position
    box.scrollTo(scrollPosition);
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
 * @param {Object} box - Blessed list to update
 */
function updateSelectedFiles(box) {
  // Use the current selection as the default
  const currentSelection = box.selected || 0;
  updateSelectedFilesWithSelection(box, currentSelection);
}

/**
 * Update the selected files display with a specific selection position
 * @param {Object} box - Blessed list to update
 * @param {number} selectionIndex - Index to select after updating
 */
function updateSelectedFilesWithSelection(box, selectionIndex) {
  let items = [];

  if (selectedFiles.length === 0) {
    items = ['No files selected'];
  } else {
    items = selectedFiles.map(file => file.relativePath);
  }

  // Set the items in the list
  box.setItems(items);

  // Set the selection position
  if (items.length > 0) {
    // Ensure the selection index is within bounds
    const validIndex = Math.min(Math.max(0, selectionIndex), items.length - 1);
    box.select(validIndex);

    // Calculate the scroll position to maintain padding at the top
    const paddingLines = 3; // Number of lines to show above the selected item
    const scrollPosition = Math.max(0, validIndex - paddingLines);

    // Scroll to the calculated position
    box.scrollTo(scrollPosition);
  }
}

/**
 * Update the token count
 * This is an estimate based on individual files, not the final formatted output
 */
function updateTokenCount() {
  tokenCount = 0;

  // First, count the tokens in the directory tree structure
  if (directoryTree) {
    const treeStructure = fileSystem.formatDirectoryTree(directoryTree);
    tokenCount += tokenCounter.countTokens(treeStructure);
  }

  // Add some tokens for the Markdown formatting and headers
  tokenCount += 100; // Rough estimate for formatting overhead

  // Count tokens in each selected file
  for (const file of selectedFiles) {
    const content = fileSystem.readFileContent(file.path);
    tokenCount += tokenCounter.countTokens(content);

    // Add some tokens for the file path and code block formatting
    tokenCount += 20; // Rough estimate for file header and formatting
  }

  // If in graph mode, add an estimate for the graph information
  if (currentMode === modeHandler.MODES.GRAPH && selectedFiles.length > 0) {
    // Rough estimate for graph information based on number of files
    tokenCount += selectedFiles.length * 50;
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

  // Add mode indicator
  const modeName = modeHandler.getModeName(currentMode);
  const modeDisplay = ` | {bold}Mode:{/bold} ${modeName}`;

  const content = [
    `{bold}Selected:{/bold} ${selectedFiles.length} files | {bold}Tokens:{/bold} ${tokenCount}` +
    (templateToSave ? ` | {bold}Template to save:{/bold} ${templateToSave}` : '') +
    modeDisplay,
    '{bold}Controls:{/bold}',
    '  {bold}Navigation:{/bold}     {bold}↑/↓:{/bold} Navigate       {bold}h:{/bold} Parent directory   {bold}l:{/bold} Enter directory',
    '  {bold}Vim-like:{/bold}       {bold}g:{/bold} Jump to top     {bold}G:{/bold} Jump to bottom     {bold}a:{/bold} Toggle all visible',
    '  {bold}UI Focus:{/bold}       {bold}Tab:{/bold} Switch panels   {bold}Space:{/bold} Select/Unselect',
    '  {bold}Selection:{/bold}      {bold}Space:{/bold} Toggle select  {bold}S-↑/↓:{/bold} Multi-select',
    '  {bold}Templates:{/bold}      {bold}t:{/bold} Load template   {bold}s:{/bold} Save template      {bold}d:{/bold} Delete template',
    '  {bold}Actions:{/bold}        {bold}/{/bold} Search          {bold}c:{/bold} Copy                {bold}m:{/bold} Change mode',
  '  {bold}Exit:{/bold}           {bold}q:{/bold} Quit',
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

  // Clear the search list to node map
  searchListToNodeMap = [];

  if (results.length === 0) {
    // No results found, show a message
    box.setItems(['No search results found']);
    return;
  }

  // Group results by directory for better organization
  groupedResults = {};

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
        // Create the directory entry if it doesn't exist
        if (!groupedResults[dirPath]) {
          groupedResults[dirPath] = [];
        }
        // Add the file to its directory
        groupedResults[dirPath].push(node);
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

        // Always add a directory entry, even if we don't have a dirNode
        // This ensures all files have a parent directory in the display
        const dirPrefix = '▶ ';
        const selected = dirNode && isFileSelected(dirNode) ? '✓ ' : '  ';
        const displayPath = relativePath + '\\';

        // Format the path with the rightmost part in bold
        let formattedPath = displayPath;
        try {
          formattedPath = formatPathWithBoldRightmost(displayPath);
        } catch (formatError) {
          console.error('Error formatting path:', formatError);
        }

        // If the directory is selected, wrap the checkmark with color tags
        if (dirNode && isFileSelected(dirNode)) {
          items.push(`${dirBranches}${dirPrefix}{green-fg}${selected}{/green-fg}${formattedPath}`);
        } else {
          items.push(`${dirBranches}${dirPrefix}${selected}${formattedPath}`);
        }

        // Add the directory node to the map
        searchListToNodeMap.push(dirNode || null);

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

                // Add the file node to the map
                searchListToNodeMap.push(fileNode);
              }
            } catch (fileError) {
              console.error('Error processing file:', fileError);
              items.push(`Error: ${fileNode ? fileNode.relativePath || 'unknown file' : 'null file'}`);
              // Add null to the map for error cases
              searchListToNodeMap.push(null);
            }
          });
        }
      } catch (dirError) {
        console.error('Error processing directory:', dirError);
        items.push(`Error: ${relativePath || 'unknown directory'}`);
        // Add null to the map for error cases
        searchListToNodeMap.push(null);
      }
    });
  } catch (error) {
    console.error('Error building display items:', error);
    items.push('Error building display items: ' + error.message);
    // Add null to the map for error cases
    searchListToNodeMap.push(null);
  }

  // Set the items in the list
  box.setItems(items);

  // Restore the selection position if preserving, otherwise select the first item
  if (preserveSelection && currentSelection < items.length) {
    box.select(currentSelection);
  } else {
    box.select(0);
  }

  // Calculate the scroll position to maintain padding at the top
  const selectedIndex = box.selected;
  const paddingLines = 3; // Number of lines to show above the selected item
  const scrollPosition = Math.max(0, selectedIndex - paddingLines);

  // Scroll to the calculated position
  box.scrollTo(scrollPosition);
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

/**
 * Update the highlighted indices for multi-selection
 * @param {Object} box - Blessed box containing the tree
 */
function updateHighlightedIndices(box) {
  // If multi-selection is not active, do nothing
  if (multiSelectStartIndex === -1) return;

  // Clear previous highlights
  highlightedIndices.clear();

  // Get the current selection index
  const currentIndex = box.selected;

  // Determine the range to highlight
  const startIdx = Math.min(multiSelectStartIndex, currentIndex);
  const endIdx = Math.max(multiSelectStartIndex, currentIndex);

  // Add all indices in the range to the highlighted set
  for (let i = startIdx; i <= endIdx; i++) {
    highlightedIndices.add(i);
  }
}

/**
 * Render the tree with highlighted items for multi-selection
 * @param {Object} box - Blessed box containing the tree
 */
function renderTreeWithHighlights(box) {
  // If no items are highlighted, do nothing special
  if (highlightedIndices.size === 0) return;

  // Store the current selection
  const currentSelection = box.selected;

  // Get the current items
  const items = box.items.map((item, index) => {
    // Check if this index is in the highlighted set
    if (highlightedIndices.has(index)) {
      // Apply a highlight style to the item
      // We'll use a yellow background to indicate highlighted but not selected items
      return `{yellow-bg}${item.content}{/yellow-bg}`;
    }
    return item.content;
  });

  // Update the items with the highlighted versions
  box.setItems(items);

  // Restore the current selection
  box.select(currentSelection);
}

/**
 * Display search results with highlighted items for multi-selection
 * @param {Object} box - Blessed box containing the tree
 * @param {Array} results - Search results to display
 * @param {boolean} preserveSelection - Whether to preserve the current selection
 */
function displaySearchResultsWithHighlights(box, results, preserveSelection = false) {
  // If no results, show a message
  if (results.length === 0) {
    box.setItems(['No search results found']);
    return;
  }

  // Store the current selection position if we need to preserve it
  const currentSelection = preserveSelection ? box.selected : 0;

  // Clear the search list to node map
  searchListToNodeMap = [];

  // Use the existing groupedResults if available, otherwise create a new one
  if (Object.keys(groupedResults).length === 0) {
    // Group results by directory for better organization
    groupedResults = {};

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
          // Create the directory entry if it doesn't exist
          if (!groupedResults[dirPath]) {
            groupedResults[dirPath] = [];
          }
          // Add the file to its directory
          groupedResults[dirPath].push(node);
        }
      }
    });
  }

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

        // Always add a directory entry, even if we don't have a dirNode
        // This ensures all files have a parent directory in the display
        const dirPrefix = '▶ ';
        const selected = dirNode && isFileSelected(dirNode) ? '✓ ' : '  ';
        const displayPath = relativePath + '\\';

        // Format the path with the rightmost part in bold
        let formattedPath = displayPath;
        try {
          formattedPath = formatPathWithBoldRightmost(displayPath);
        } catch (formatError) {
          console.error('Error formatting path:', formatError);
        }

        // Create the directory item content
        let dirContent = '';
        if (dirNode && isFileSelected(dirNode)) {
          dirContent = `${dirBranches}${dirPrefix}{green-fg}${selected}{/green-fg}${formattedPath}`;
        } else {
          dirContent = `${dirBranches}${dirPrefix}${selected}${formattedPath}`;
        }

        // Check if this directory item should be highlighted
        if (highlightedIndices.has(items.length)) {
          dirContent = `{yellow-bg}${dirContent}{/yellow-bg}`;
        }

        // Add the directory node to the map
        searchListToNodeMap.push(dirNode || null);
        items.push(dirContent);

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

                // Create the file item content
                let fileContent = '';
                if (isFileSelected(fileNode)) {
                  fileContent = `${fileBranch}${filePrefix}{green-fg}${selected}{/green-fg}${formattedPath}`;
                } else {
                  fileContent = `${fileBranch}${filePrefix}${selected}${formattedPath}`;
                }

                // Check if this file item should be highlighted
                if (highlightedIndices.has(items.length)) {
                  fileContent = `{yellow-bg}${fileContent}{/yellow-bg}`;
                }

                // Add the file node to the map
                searchListToNodeMap.push(fileNode);
                items.push(fileContent);
              }
            } catch (fileError) {
              console.error('Error processing file:', fileError);
              items.push(`Error: ${fileNode ? fileNode.relativePath || 'unknown file' : 'null file'}`);
              // Add null to the map for error cases
              searchListToNodeMap.push(null);
            }
          });
        }
      } catch (dirError) {
        console.error('Error processing directory:', dirError);
        items.push(`Error: ${relativePath || 'unknown directory'}`);
        // Add null to the map for error cases
        searchListToNodeMap.push(null);
      }
    });
  } catch (error) {
    console.error('Error building display items:', error);
    items.push('Error building display items: ' + error.message);
    // Add null to the map for error cases
    searchListToNodeMap.push(null);
  }

  // Set the items in the list
  box.setItems(items);

  // Restore the selection position if preserving, otherwise select the first item
  if (preserveSelection && currentSelection < items.length) {
    box.select(currentSelection);
  } else {
    box.select(0);
  }

  // Calculate the scroll position to maintain padding at the top
  const selectedIndex = box.selected;
  const paddingLines = 3; // Number of lines to show above the selected item
  const scrollPosition = Math.max(0, selectedIndex - paddingLines);

  // Scroll to the calculated position
  box.scrollTo(scrollPosition);
}

module.exports = { start };
