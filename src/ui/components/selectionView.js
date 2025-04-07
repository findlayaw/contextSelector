/**
 * Selection view component for displaying and managing selected files
 */

const stateManager = require('../state');
const tokenCounter = require('../../utils/tokenCounter');
const fileSystem = require('../../simpleFileSystem');

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
  const state = stateManager.getState();
  let items = [];

  if (state.selectedFiles.length === 0) {
    items = ['No files selected'];
  } else {
    items = state.selectedFiles.map(file => file.relativePath);
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
  const state = stateManager.getState();
  state.tokenCount = 0;

  // First, count the tokens in the directory tree structure
  if (state.directoryTree) {
    const treeStructure = fileSystem.formatDirectoryTree(state.directoryTree);
    state.tokenCount += tokenCounter.countTokens(treeStructure);
  }

  // Add some tokens for the Markdown formatting and headers
  state.tokenCount += 100; // Rough estimate for formatting overhead

  // Count tokens in each selected file
  for (const file of state.selectedFiles) {
    const content = fileSystem.readFileContent(file.path);
    state.tokenCount += tokenCounter.countTokens(content);

    // Add some tokens for the file path and code block formatting
    state.tokenCount += 20; // Rough estimate for file header and formatting
  }

  // Add mode-specific token estimates
  const modeHandler = require('../modeHandler');

  if (state.selectedFiles.length > 0) {
    if (state.currentMode === modeHandler.MODES.GRAPH) {
      // Rough estimate for graph information based on number of files
      state.tokenCount += state.selectedFiles.length * 50;
    } else if (state.currentMode === modeHandler.MODES.CODEMAPS) {
      if (!state.includeContents) {
        // In CodeMaps mode without file contents, we only include structure
        // So we subtract the tokens from the file contents and add a smaller amount for structure
        for (const file of state.selectedFiles) {
          const content = fileSystem.readFileContent(file.path);
          // Subtract the tokens we already counted for this file's content
          state.tokenCount -= tokenCounter.countTokens(content);
        }

        // Add tokens for the code structure information (much smaller than full content)
        state.tokenCount += state.selectedFiles.length * 25;

        // Add a small fixed amount for the file list
        state.tokenCount += 50;
      } else {
        // If including file contents, add tokens for the structure on top of file contents
        state.tokenCount += state.selectedFiles.length * 25;
      }
    }
  }

  // Add token count for selected prompts
  if (state.selectedPrompts.size > 0) {
    // Add rough overhead for the "# INSTRUCTIONS" header and spacing
    state.tokenCount += 10;

    for (const promptContent of state.selectedPrompts.values()) {
      state.tokenCount += tokenCounter.countTokens(promptContent);
      // Add small overhead per prompt for spacing
      state.tokenCount += 5;
    }
  }
}

module.exports = {
  updateSelectedFiles,
  updateSelectedFilesWithSelection,
  updateTokenCount
};
