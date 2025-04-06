/**
 * Formatting utilities for the terminal UI
 */

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
 * Generate simple tree branches for directories based on depth
 * @param {string} relativePath - Relative path of the directory
 * @returns {string} - Tree branch characters
 */
function getDirectoryBranches(relativePath) {
  try {
    if (!relativePath) return '';

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

    return dirBranches;
  } catch (error) {
    console.error('Error in getDirectoryBranches:', error);
    return '';
  }
}

module.exports = {
  formatPathWithBoldRightmost,
  getTreeBranches,
  getDirectoryBranches
};
