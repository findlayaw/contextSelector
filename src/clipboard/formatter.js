const path = require('path');
const fileSystem = require('../fileSystem');

/**
 * Format selected files for LLM consumption
 * @param {Array} selectedFiles - Array of selected file objects
 * @param {Object} directoryTree - Directory tree object
 * @returns {string} - Formatted content for clipboard
 */
async function formatForLLM(selectedFiles, directoryTree) {
  let result = '';
  
  // Add directory tree
  result += '# Project Directory Structure\n\n';
  result += '```\n';
  result += fileSystem.formatDirectoryTree(directoryTree);
  result += '```\n\n';
  
  // Add horizontal rule as separator
  result += '---\n\n';
  
  // Add file contents
  result += '# Selected Files\n\n';
  
  for (const file of selectedFiles) {
    const content = await fileSystem.readFileContent(file.path);
    const extension = path.extname(file.path).substring(1); // Remove the dot
    
    // Add file path as heading
    result += `## ${file.relativePath}\n\n`;
    
    // Add file content in fenced code block with language
    result += '```' + (extension || '') + '\n';
    result += content;
    
    // Ensure the code block ends with a newline
    if (!content.endsWith('\n')) {
      result += '\n';
    }
    
    result += '```\n\n';
    
    // Add horizontal rule as separator between files
    result += '---\n\n';
  }
  
  return result;
}

module.exports = { formatForLLM };
