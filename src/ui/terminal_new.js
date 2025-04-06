/**
 * Terminal UI module for the context selector
 * This is the main entry point for the terminal UI
 */

const fs = require('fs');
const fileSystem = require('../simpleFileSystem');
const templateManager = require('../templates/manager');
const stateManager = require('./state');
const screenComponent = require('./components/screen');
const treeView = require('./components/treeView');
const selectionView = require('./components/selectionView');
const statusView = require('./components/statusView');

/**
 * Start the terminal UI
 * @param {Object} options - UI options
 * @returns {Promise<Object>} - Result with selected files and other data
 */
async function start(options) {
  // Initialize the state with options
  stateManager.initState(options);

  return new Promise(async (resolve, reject) => {
    try {
      // Initialize the UI components
      const components = screenComponent.initializeUI(resolve);
      const { screen, treeBox, infoBox, statusBox, templateSelectBox } = components;
      const state = stateManager.getState();
      
      // Load the directory tree
      state.directoryTree = await fileSystem.getDirectoryTree(options.startDir);

      if (state.directoryTree) {
        // Expand the root directory by default
        if (state.directoryTree.type === 'directory') {
          state.expandedDirs.add(state.directoryTree.path);
        }

        // Render the tree
        treeView.renderTree(treeBox, state.directoryTree);
      } else {
        console.error('Failed to load directory tree');
      }

      // Update status
      statusView.updateStatus(statusBox, false, false, templateSelectBox);

      // If a template was specified, load it
      if (options.template) {
        const template = await templateManager.loadTemplate(options.template);
        if (template && template.files) {
          // Check if each file/directory in the template exists
          const validSelectedFiles = [];
          const validSelectedEmptyDirs = [];
          const missingItems = [];

          for (const itemFromTemplate of template.files) {
            // Check if the path stored in the template actually exists
            if (fs.existsSync(itemFromTemplate.path)) {
              // Check if it's a file or directory
              const stats = fs.statSync(itemFromTemplate.path);
              if (stats.isFile()) {
                validSelectedFiles.push(itemFromTemplate);
              } else if (stats.isDirectory() && (!itemFromTemplate.children || itemFromTemplate.children.length === 0)) {
                // It's an empty directory
                validSelectedEmptyDirs.push(itemFromTemplate);
              }
            } else {
              // Keep track of items that couldn't be found
              missingItems.push(itemFromTemplate.relativePath || itemFromTemplate.path);
            }
          }

          state.selectedFiles = validSelectedFiles; // Assign only the files that were found
          state.selectedEmptyDirs = validSelectedEmptyDirs; // Assign only the empty directories that were found

          // Notify the user if some items were missing
          if (missingItems.length > 0) {
            const missingItemsList = missingItems.join('\n  - ');
            // Temporarily show a message in the status box
            statusBox.setContent(`{yellow-fg}Warning: The following items from the template were not found and were skipped:{/yellow-fg}\n  - ${missingItemsList}\n\n(Loading remaining files...)`);
            screen.render(); // Render the temporary message
            // Wait a bit before showing the final status update
            await new Promise(resolve => setTimeout(resolve, 3000)); // Show warning for 3 seconds
          }

          selectionView.updateSelectedFiles(infoBox);
          selectionView.updateTokenCount();
          statusView.updateStatus(statusBox, false, false, templateSelectBox);
          // Render the tree to show visual indicators for selected files
          treeView.renderTree(treeBox, state.directoryTree);
        }
      }

      // If a search query was specified, perform search
      if (options.searchQuery) {
        const search = require('../utils/search');
        const results = search.searchFiles(state.directoryTree, options.searchQuery);
        const searchHandler = require('./handlers/searchHandler');
        // Initial search from options, don't preserve selection
        searchHandler.displaySearchResults(treeBox, results, false);
        statusView.updateStatus(statusBox, true, false, templateSelectBox);
      }

      // Render the screen
      screen.render();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { start };
