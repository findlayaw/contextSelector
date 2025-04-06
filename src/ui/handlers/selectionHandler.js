/**
 * Selection handler for managing file and directory selection
 */

const stateManager = require('../state');

/**
 * Toggle selection of a file
 * @param {Object} node - File node to toggle
 */
function toggleFileSelection(node) {
  const state = stateManager.getState();
  const index = state.selectedFiles.findIndex(f => f.path === node.path);

  if (index === -1) {
    state.selectedFiles.push(node);
  } else {
    state.selectedFiles.splice(index, 1);
  }
}

/**
 * Check if all files in a directory and its subdirectories are selected
 * @param {Object} node - Directory node to check
 * @returns {boolean} - True if all files are selected, false otherwise
 */
function areAllFilesInDirectorySelected(node) {
  const state = stateManager.getState();
  
  if (!node || node.type !== 'directory') return false;

  // If there are no children, check if this empty directory is in the selectedEmptyDirs array
  if (!node.children || node.children.length === 0) {
    return state.selectedEmptyDirs.some(dir => dir.path === node.path);
  }

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

  // Handle empty directories
  if (!node.children || node.children.length === 0) {
    const state = stateManager.getState();
    if (allSelected) {
      // If already selected, remove from selectedEmptyDirs
      const index = state.selectedEmptyDirs.findIndex(dir => dir.path === node.path);
      if (index !== -1) {
        state.selectedEmptyDirs.splice(index, 1);
      }
    } else {
      // If not selected, add to selectedEmptyDirs
      if (!state.selectedEmptyDirs.some(dir => dir.path === node.path)) {
        state.selectedEmptyDirs.push(node);
      }
    }
    return;
  }

  // Process children for non-empty directories
  for (const child of node.children) {
    if (child.type === 'file') {
      // If all files are selected, deselect this file
      // Otherwise, select this file if it's not already selected
      if (allSelected) {
        const state = stateManager.getState();
        const index = state.selectedFiles.findIndex(f => f.path === child.path);
        if (index !== -1) {
          state.selectedFiles.splice(index, 1);
        }
      } else if (!isFileSelected(child)) {
        const state = stateManager.getState();
        state.selectedFiles.push(child);
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

/**
 * Helper function to select all files in a subdirectory (without checking current state)
 * @param {Object} node - Directory node to select files from
 */
function selectAllFilesInSubdirectory(node) {
  if (!node || node.type !== 'directory') return;
  const state = stateManager.getState();

  // Handle empty directories
  if (!node.children || node.children.length === 0) {
    // Add to selectedEmptyDirs if not already there
    if (!state.selectedEmptyDirs.some(dir => dir.path === node.path)) {
      state.selectedEmptyDirs.push(node);
    }
    return;
  }

  // Process children for non-empty directories
  for (const child of node.children) {
    if (child.type === 'file') {
      // Add the file if it's not already selected
      if (!isFileSelected(child)) {
        state.selectedFiles.push(child);
      }
    } else if (child.type === 'directory') {
      // Recursively process subdirectories
      selectAllFilesInSubdirectory(child);
    }
  }
}

/**
 * Helper function to deselect all files in a directory
 * @param {Object} node - Directory node to deselect files from
 */
function deselectAllFilesInDirectory(node) {
  if (!node || node.type !== 'directory') return;
  const state = stateManager.getState();

  // Handle empty directories
  if (!node.children || node.children.length === 0) {
    // Remove from selectedEmptyDirs if present
    const index = state.selectedEmptyDirs.findIndex(dir => dir.path === node.path);
    if (index !== -1) {
      state.selectedEmptyDirs.splice(index, 1);
    }
    return;
  }

  // Process children for non-empty directories
  for (const child of node.children) {
    if (child.type === 'file') {
      // Remove the file if it's selected
      const index = state.selectedFiles.findIndex(f => f.path === child.path);
      if (index !== -1) {
        state.selectedFiles.splice(index, 1);
      }
    } else if (child.type === 'directory') {
      // Recursively process subdirectories
      deselectAllFilesInDirectory(child);
    }
  }
}

/**
 * Check if a file or directory is selected
 * @param {Object} node - Node to check
 * @returns {boolean} - True if the file is selected or if all files in the directory are selected
 */
function isFileSelected(node) {
  const state = stateManager.getState();
  
  if (node.type === 'file') {
    return state.selectedFiles.some(f => f.path === node.path);
  } else if (node.type === 'directory') {
    return areAllFilesInDirectorySelected(node);
  }
  return false;
}

/**
 * Update the highlighted indices for multi-selection
 * @param {Object} box - Blessed box containing the tree
 */
function updateHighlightedIndices(box) {
  const state = stateManager.getState();
  
  // If multi-selection is not active, do nothing
  if (state.multiSelectStartIndex === -1) return;

  // Clear previous highlights
  state.highlightedIndices.clear();

  // Get the current selection index
  const currentIndex = box.selected;

  // Determine the range to highlight
  const startIdx = Math.min(state.multiSelectStartIndex, currentIndex);
  const endIdx = Math.max(state.multiSelectStartIndex, currentIndex);

  // Add all indices in the range to the highlighted set
  for (let i = startIdx; i <= endIdx; i++) {
    state.highlightedIndices.add(i);
  }
}

module.exports = {
  toggleFileSelection,
  areAllFilesInDirectorySelected,
  selectAllFilesInDirectory,
  selectAllFilesInSubdirectory,
  deselectAllFilesInDirectory,
  isFileSelected,
  updateHighlightedIndices
};
