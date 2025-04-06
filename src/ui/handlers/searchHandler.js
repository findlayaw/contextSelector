/**
 * Search handler for managing search functionality
 */

const path = require('path');
const stateManager = require('../state');
const formatting = require('../utils/formatting');
const selectionHandler = require('./selectionHandler');

/**
 * Display search results in the tree
 * @param {Object} box - Blessed box containing the tree
 * @param {Array} results - Search results to highlight
 * @param {boolean} preserveSelection - Whether to preserve the current selection
 */
function displaySearchResults(box, results, preserveSelection = false) {
  const state = stateManager.getState();
  
  // Save the original tree if this is a new search
  if (!state.isSearchActive) {
    state.originalTree = state.directoryTree;
    state.isSearchActive = true;
  }

  // Store the current selection position if we need to preserve it
  const currentSelection = preserveSelection ? box.selected : 0;

  // Store the search results
  state.searchResults = results;

  // Clear the search list to node map
  state.searchListToNodeMap = [];

  if (results.length === 0) {
    // No results found, show a message
    box.setItems(['No search results found']);
    return;
  }

  // Group results by directory for better organization
  state.groupedResults = {};

  // First pass: collect all directories
  results.forEach(node => {
    if (node.type === 'directory') {
      state.groupedResults[node.relativePath] = [];
    }
  });

  // Second pass: assign files to their directories or create standalone entries
  results.forEach(node => {
    if (node.type === 'file') {
      const dirPath = path.dirname(node.relativePath);
      if (state.groupedResults[dirPath]) {
        // This file belongs to a directory that's in our results
        state.groupedResults[dirPath].push(node);
      } else {
        // Create the directory entry if it doesn't exist
        if (!state.groupedResults[dirPath]) {
          state.groupedResults[dirPath] = [];
        }
        // Add the file to its directory
        state.groupedResults[dirPath].push(node);
      }
    }
  });

  // Create a virtual tree with just the search results
  const items = [];

  // Sort the keys (paths) to maintain directory structure
  const sortedPaths = Object.keys(state.groupedResults).sort((a, b) => a.localeCompare(b));

  // Build the display items
  try {
    sortedPaths.forEach((relativePath) => {
      try {
        // Find the directory node if it exists
        const dirNode = results.find(node =>
          node.type === 'directory' && node.relativePath === relativePath
        );

        // Generate simple tree branches for directories based on depth
        const dirBranches = formatting.getDirectoryBranches(relativePath);

        // Always add a directory entry, even if we don't have a dirNode
        // This ensures all files have a parent directory in the display
        const dirPrefix = '▶ ';
        const selected = dirNode && selectionHandler.isFileSelected(dirNode) ? '✓ ' : '  ';
        const displayPath = relativePath + '\\';

        // Format the path with the rightmost part in bold
        let formattedPath = displayPath;
        try {
          formattedPath = formatting.formatPathWithBoldRightmost(displayPath);
        } catch (formatError) {
          console.error('Error formatting path:', formatError);
        }

        // If the directory is selected, wrap the checkmark with color tags
        if (dirNode && selectionHandler.isFileSelected(dirNode)) {
          items.push(`${dirBranches}${dirPrefix}{green-fg}${selected}{/green-fg}${formattedPath}`);
        } else {
          items.push(`${dirBranches}${dirPrefix}${selected}${formattedPath}`);
        }

        // Add the directory node to the map
        state.searchListToNodeMap.push(dirNode || null);

        // Add the files in this directory
        const files = state.groupedResults[relativePath];
        if (files && files.length > 0) {
          files.forEach((fileNode, fileIndex) => {
            try {
              if (fileNode.type === 'file') {
                // Generate file branch - use └─ for last file, ├─ for others
                const isLastFile = fileIndex === files.length - 1;
                const fileBranch = dirBranches + (isLastFile ? '└─' : '├─');
                const filePrefix = '  ';
                const selected = selectionHandler.isFileSelected(fileNode) ? '✓ ' : '  ';
                const displayPath = fileNode.relativePath;

                // Format the path with the rightmost part in bold
                let formattedPath = displayPath;
                try {
                  formattedPath = formatting.formatPathWithBoldRightmost(displayPath);
                } catch (formatError) {
                  console.error('Error formatting path:', formatError);
                }

                // If the file is selected, wrap the checkmark with color tags
                if (selectionHandler.isFileSelected(fileNode)) {
                  items.push(`${fileBranch}${filePrefix}{green-fg}${selected}{/green-fg}${formattedPath}`);
                } else {
                  items.push(`${fileBranch}${filePrefix}${selected}${formattedPath}`);
                }

                // Add the file node to the map
                state.searchListToNodeMap.push(fileNode);
              }
            } catch (fileError) {
              console.error('Error processing file:', fileError);
              items.push(`Error: ${fileNode ? fileNode.relativePath || 'unknown file' : 'null file'}`);
              // Add null to the map for error cases
              state.searchListToNodeMap.push(null);
            }
          });
        }
      } catch (dirError) {
        console.error('Error processing directory:', dirError);
        items.push(`Error: ${relativePath || 'unknown directory'}`);
        // Add null to the map for error cases
        state.searchListToNodeMap.push(null);
      }
    });
  } catch (error) {
    console.error('Error building display items:', error);
    items.push('Error building display items: ' + error.message);
    // Add null to the map for error cases
    state.searchListToNodeMap.push(null);
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
 * Display search results with highlighted items for multi-selection
 * @param {Object} box - Blessed box containing the tree
 * @param {Array} results - Search results to display
 * @param {boolean} preserveSelection - Whether to preserve the current selection
 */
function displaySearchResultsWithHighlights(box, results, preserveSelection = false) {
  const state = stateManager.getState();
  
  // If no results, show a message
  if (results.length === 0) {
    box.setItems(['No search results found']);
    return;
  }

  // Store the current selection position if we need to preserve it
  const currentSelection = preserveSelection ? box.selected : 0;

  // Clear the search list to node map
  state.searchListToNodeMap = [];

  // Use the existing groupedResults if available, otherwise create a new one
  if (Object.keys(state.groupedResults).length === 0) {
    // Group results by directory for better organization
    state.groupedResults = {};

    // First pass: collect all directories
    results.forEach(node => {
      if (node.type === 'directory') {
        state.groupedResults[node.relativePath] = [];
      }
    });

    // Second pass: assign files to their directories or create standalone entries
    results.forEach(node => {
      if (node.type === 'file') {
        const dirPath = path.dirname(node.relativePath);
        if (state.groupedResults[dirPath]) {
          // This file belongs to a directory that's in our results
          state.groupedResults[dirPath].push(node);
        } else {
          // Create the directory entry if it doesn't exist
          if (!state.groupedResults[dirPath]) {
            state.groupedResults[dirPath] = [];
          }
          // Add the file to its directory
          state.groupedResults[dirPath].push(node);
        }
      }
    });
  }

  // Create a virtual tree with just the search results
  const items = [];

  // Sort the keys (paths) to maintain directory structure
  const sortedPaths = Object.keys(state.groupedResults).sort((a, b) => a.localeCompare(b));

  // Build the display items
  try {
    sortedPaths.forEach((relativePath) => {
      try {
        // Find the directory node if it exists
        const dirNode = results.find(node =>
          node.type === 'directory' && node.relativePath === relativePath
        );

        // Generate simple tree branches for directories based on depth
        const dirBranches = formatting.getDirectoryBranches(relativePath);

        // Always add a directory entry, even if we don't have a dirNode
        // This ensures all files have a parent directory in the display
        const dirPrefix = '▶ ';
        const selected = dirNode && selectionHandler.isFileSelected(dirNode) ? '✓ ' : '  ';
        const displayPath = relativePath + '\\';

        // Format the path with the rightmost part in bold
        let formattedPath = displayPath;
        try {
          formattedPath = formatting.formatPathWithBoldRightmost(displayPath);
        } catch (formatError) {
          console.error('Error formatting path:', formatError);
        }

        // Create the directory item content
        let dirContent = '';
        if (dirNode && selectionHandler.isFileSelected(dirNode)) {
          dirContent = `${dirBranches}${dirPrefix}{green-fg}${selected}{/green-fg}${formattedPath}`;
        } else {
          dirContent = `${dirBranches}${dirPrefix}${selected}${formattedPath}`;
        }

        // Check if this directory item should be highlighted
        if (state.highlightedIndices.has(items.length)) {
          dirContent = `{yellow-bg}${dirContent}{/yellow-bg}`;
        }

        // Add the directory node to the map
        state.searchListToNodeMap.push(dirNode || null);
        items.push(dirContent);

        // Add the files in this directory
        const files = state.groupedResults[relativePath];
        if (files && files.length > 0) {
          files.forEach((fileNode, fileIndex) => {
            try {
              if (fileNode.type === 'file') {
                // Generate file branch - use └─ for last file, ├─ for others
                const isLastFile = fileIndex === files.length - 1;
                const fileBranch = dirBranches + (isLastFile ? '└─' : '├─');
                const filePrefix = '  ';
                const selected = selectionHandler.isFileSelected(fileNode) ? '✓ ' : '  ';
                const displayPath = fileNode.relativePath;

                // Format the path with the rightmost part in bold
                let formattedPath = displayPath;
                try {
                  formattedPath = formatting.formatPathWithBoldRightmost(displayPath);
                } catch (formatError) {
                  console.error('Error formatting path:', formatError);
                }

                // Create the file item content
                let fileContent = '';
                if (selectionHandler.isFileSelected(fileNode)) {
                  fileContent = `${fileBranch}${filePrefix}{green-fg}${selected}{/green-fg}${formattedPath}`;
                } else {
                  fileContent = `${fileBranch}${filePrefix}${selected}${formattedPath}`;
                }

                // Check if this file item should be highlighted
                if (state.highlightedIndices.has(items.length)) {
                  fileContent = `{yellow-bg}${fileContent}{/yellow-bg}`;
                }

                // Add the file node to the map
                state.searchListToNodeMap.push(fileNode);
                items.push(fileContent);
              }
            } catch (fileError) {
              console.error('Error processing file:', fileError);
              items.push(`Error: ${fileNode ? fileNode.relativePath || 'unknown file' : 'null file'}`);
              // Add null to the map for error cases
              state.searchListToNodeMap.push(null);
            }
          });
        }
      } catch (dirError) {
        console.error('Error processing directory:', dirError);
        items.push(`Error: ${relativePath || 'unknown directory'}`);
        // Add null to the map for error cases
        state.searchListToNodeMap.push(null);
      }
    });
  } catch (error) {
    console.error('Error building display items:', error);
    items.push('Error building display items: ' + error.message);
    // Add null to the map for error cases
    state.searchListToNodeMap.push(null);
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

module.exports = {
  displaySearchResults,
  displaySearchResultsWithHighlights
};
