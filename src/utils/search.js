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

  // Helper function to search recursively
  function searchNode(node, parentMatches = false) {
    if (!node) return;

    // Check if the node name matches the query
    const nameMatches = node.name.toLowerCase().includes(lowerQuery);

    // Check if the node path matches the query
    const pathMatches = node.relativePath && node.relativePath.toLowerCase().includes(lowerQuery);

    // Add the node if its name or path matches the query
    if (nameMatches || pathMatches) {
      results.push(node);

      // If it's a directory that matches, track it
      if (node.type === 'directory') {
        matchedDirs.add(node.path);
      }
    }

    // If it's a directory, search its children
    if (node.type === 'directory' && node.children) {
      // Check if this directory or any parent directory matched the query
      const dirMatches = parentMatches || nameMatches || pathMatches;

      for (const child of node.children) {
        // If parent directory matched, include all children
        if (dirMatches) {
          if (!results.includes(child)) {
            results.push(child);
          }
        }
        // Continue searching recursively
        searchNode(child, dirMatches);
      }
    }
  }

  searchNode(tree);

  // Sort results by their directory structure
  results.sort((a, b) => {
    // Sort by relative path to maintain directory structure
    return a.relativePath.localeCompare(b.relativePath);
  });

  return results;
}

module.exports = { searchFiles };
