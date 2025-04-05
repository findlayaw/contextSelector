/**
 * Search for files and directories in the directory tree
 * @param {Object} tree - Directory tree to search in
 * @param {string} query - Search query
 * @returns {Array} - Array of matching nodes
 */
function searchFiles(tree, query) {
  if (!tree || !query) return [];

  const results = [];
  const lowerQuery = query.toLowerCase();
  const matchedDirs = new Set(); // Track directories that match the query
  const addedPaths = new Set(); // Track paths we've already added to avoid duplicates

  // Helper function to search recursively
  function searchNode(node, parentMatches = false) {
    if (!node) return;

    // Check if the node name matches the query
    const nameMatches = node.name.toLowerCase().includes(lowerQuery);

    // Check if the node path matches the query
    const pathMatches = node.relativePath && node.relativePath.toLowerCase().includes(lowerQuery);

    // Add the node if its name or path matches the query and we haven't added it yet
    if ((nameMatches || pathMatches) && !addedPaths.has(node.path)) {
      results.push(node);
      addedPaths.add(node.path);

      // If it's a directory that matches, track it
      if (node.type === 'directory') {
        matchedDirs.add(node.path);
      }

      // Also add parent directories to ensure proper tree structure
      if (node.type === 'file') {
        addParentDirectories(node);
      }
    }

    // If it's a directory, search its children
    if (node.type === 'directory' && node.children) {
      // Check if this directory or any parent directory matched the query
      const dirMatches = parentMatches || nameMatches || pathMatches;

      for (const child of node.children) {
        // If parent directory matched, include all children
        if (dirMatches && !addedPaths.has(child.path)) {
          results.push(child);
          addedPaths.add(child.path);
        }
        // Continue searching recursively
        searchNode(child, dirMatches);
      }
    }
  }

  // Helper function to add parent directories of a file
  function addParentDirectories(node) {
    if (!node || !node.path) return;

    // Get the parent directory path
    const parentPath = node.path.substring(0, node.path.lastIndexOf('\\'));
    if (!parentPath) return;

    // Find the parent directory node in the tree
    function findParentNode(currentNode, targetPath) {
      if (!currentNode || currentNode.type !== 'directory') return null;
      if (currentNode.path === targetPath) return currentNode;

      if (currentNode.children) {
        for (const child of currentNode.children) {
          const found = findParentNode(child, targetPath);
          if (found) return found;
        }
      }
      return null;
    }

    const parentNode = findParentNode(tree, parentPath);
    if (parentNode && !addedPaths.has(parentNode.path)) {
      results.push(parentNode);
      addedPaths.add(parentNode.path);

      // Recursively add parent directories
      addParentDirectories(parentNode);
    }
  }

  searchNode(tree);

  // Sort results by their directory structure
  results.sort((a, b) => {
    // Sort directories before files
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    // Then sort by relative path to maintain directory structure
    return a.relativePath.localeCompare(b.relativePath);
  });

  return results;
}

module.exports = { searchFiles };
