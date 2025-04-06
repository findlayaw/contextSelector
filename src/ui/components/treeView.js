/**
 * Tree view component for displaying and managing the file tree
 */

const stateManager = require('../state');
const formatting = require('../utils/formatting');
const selectionHandler = require('../handlers/selectionHandler');

/**
 * Check if a node is expanded
 * @param {Object} node - Node to check
 * @returns {boolean} - True if the node is expanded
 */
function isNodeExpanded(node) {
  const state = stateManager.getState();
  if (!node || node.type !== 'directory') return false;
  return state.expandedDirs.has(node.path);
}

/**
 * Toggle a directory's expanded state
 * @param {Object} box - Blessed box containing the tree
 * @param {Object} node - Directory node to toggle
 */
function toggleDirectory(box, node) {
  if (!node || node.type !== 'directory') return;
  const state = stateManager.getState();

  if (state.expandedDirs.has(node.path)) {
    state.expandedDirs.delete(node.path);
  } else {
    state.expandedDirs.add(node.path);
  }

  renderTree(box, state.directoryTree);
}

/**
 * Flatten the tree for easier node lookup
 * @param {Object} node - Node to flatten
 * @param {boolean} isRoot - Whether this is the root node
 */
function flattenTree(node, isRoot = false) {
  if (!node) return;
  const state = stateManager.getState();

  state.flattenedTree.push(node);

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
  const state = stateManager.getState();
  // Get the selected line index
  const selectedIndex = box.selected || 0;

  // Return the node at the selected index, or null if out of bounds
  return selectedIndex < state.flattenedTree.length ? state.flattenedTree[selectedIndex] : null;
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
    const state = stateManager.getState();

    // Reset the flattened tree
    state.flattenedTree = [];

    // Build the flattened tree
    flattenTree(tree, true);

    // Create the list items
    const items = state.flattenedTree.map((node) => {
      try {
        const isExpanded = node === tree || isNodeExpanded(node);
        const dirPrefix = node.type === 'directory' ? (isExpanded ? '▼ ' : '▶ ') : '  ';
        const selected = selectionHandler.isFileSelected(node) ? '✓ ' : '  ';

        // Get tree branch characters
        const branches = formatting.getTreeBranches(node);

        // Use relativePath instead of just name
        const displayPath = node.relativePath + (node.type === 'directory' ? '\\' : '');

        // Format the path with the rightmost part in bold
        let formattedPath = displayPath;
        try {
          formattedPath = formatting.formatPathWithBoldRightmost(displayPath);
        } catch (formatError) {
          console.error('Error formatting path:', formatError);
        }

        // If the node is selected, wrap the checkmark with color tags
        if (selectionHandler.isFileSelected(node)) {
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

/**
 * Render the tree with highlighted items for multi-selection
 * @param {Object} box - Blessed box containing the tree
 */
function renderTreeWithHighlights(box) {
  const state = stateManager.getState();
  
  // If no items are highlighted, do nothing special
  if (state.highlightedIndices.size === 0) return;

  // Store the current selection
  const currentSelection = box.selected;

  // Get the current items
  const items = box.items.map((item, index) => {
    // Check if this index is in the highlighted set
    if (state.highlightedIndices.has(index)) {
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

module.exports = {
  isNodeExpanded,
  toggleDirectory,
  flattenTree,
  getCurrentNode,
  renderTree,
  renderTreeWithHighlights
};
