const path = require('path');
const fileSystem = require('../simpleFileSystem');

/**
 * Format selected files for LLM consumption in XML format
 * @param {Array} selectedFiles - Array of selected file objects
 * @param {Object} directoryTree - Directory tree object
 * @param {string} currentPrompt - Current prompt text
 * @returns {string} - Formatted content for clipboard in XML format
 */
async function formatForLLM(selectedFiles, directoryTree, currentPrompt) {
  let result = '';

  // Add XML header
  result += '<?xml version="1.0" encoding="UTF-8"?>\n';
  result += '<context>\n';

  // Add directory tree
  result += '  <directory_structure>\n';
  result += '    <![CDATA[\n';
  result += fileSystem.formatDirectoryTree(directoryTree);
  result += '    ]]>\n';
  result += '  </directory_structure>\n\n';

  // Add files
  result += '  <files>\n';

  for (const file of selectedFiles) {
    const content = await fileSystem.readFileContent(file.path);
    const extension = path.extname(file.path).substring(1); // Remove the dot

    // Add file element
    result += '    <file>\n';
    result += `      <path>${file.path}</path>\n`;
    result += `      <language>${extension || 'txt'}</language>\n`;
    result += '      <content><![CDATA[\n';
    result += content;
    result += '      ]]></content>\n';
    result += '    </file>\n\n';
  }

  result += '  </files>\n';

  // Add prompt if it exists
  if (currentPrompt && currentPrompt.trim().length > 0) {
    result += '  <user_instructions><![CDATA[\n';
    result += currentPrompt;

    // Ensure trailing newline if prompt doesn't end with one
    if (!currentPrompt.endsWith('\n')) {
      result += '\n';
    }

    result += '  ]]></user_instructions>\n';
  }

  result += '</context>';

  return result;
}

module.exports = { formatForLLM };
