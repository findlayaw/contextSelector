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
  
  // Helper function to search recursively
  function searchNode(node) {
    if (!node) return;
    
    // Check if the node name matches the query
    if (node.name.toLowerCase().includes(lowerQuery)) {
      results.push(node);
    }
    
    // If it's a directory, search its children
    if (node.type === 'directory' && node.children) {
      for (const child of node.children) {
        searchNode(child);
      }
    }
  }
  
  searchNode(tree);
  return results;
}

module.exports = { searchFiles };
