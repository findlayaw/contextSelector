const path = require('path');
const fileSystem = require('../simpleFileSystem');
const tokenCounter = require('../utils/tokenCounter');

/**
 * Format selected files for LLM consumption
 * @param {Array} selectedFiles - Array of selected file objects
 * @param {Object} directoryTree - Directory tree object
 * @param {Array} selectedPrompts - Array of selected prompt contents
 * @returns {string} - Formatted content for clipboard
 */
async function formatForLLM(selectedFiles, directoryTree, selectedPrompts = []) {
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
    result += `## ${file.path}\n\n`;

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

  // Add selected prompts if any exist
  if (selectedPrompts && selectedPrompts.length > 0) {
    result += '# INSTRUCTIONS\n\n';
    selectedPrompts.forEach(promptContent => {
      result += `${promptContent}\n\n`;
    });
    result += '---\n\n';
  }

  return result;
}

module.exports = { formatForLLM };
