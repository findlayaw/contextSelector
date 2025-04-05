const path = require('path');
const fs = require('fs-extra');
const fileSystem = require('./fileSystem');
const terminal = require('./ui/terminal');
const formatter = require('./clipboard/formatter');
const copy = require('./clipboard/copy');
const templateManager = require('./templates/manager');

/**
 * Main application entry point
 * @param {Object} options - Command line options
 */
async function run(options) {
  try {
    // Initialize the file system module
    await fileSystem.init(options.directory);
    
    // Start the terminal UI
    const result = await terminal.start({
      startDir: options.directory,
      searchQuery: options.search,
      template: options.template
    });
    
    if (result.selectedFiles && result.selectedFiles.length > 0) {
      // Format the selected files
      const formattedContent = formatter.formatForLLM(
        result.selectedFiles,
        result.directoryTree
      );
      
      // Copy to clipboard
      await copy.toClipboard(formattedContent);
      
      console.log(`Copied ${result.selectedFiles.length} files to clipboard (${result.tokenCount} tokens)`);
      
      // Save template if requested
      if (result.saveTemplate) {
        await templateManager.saveTemplate(result.saveTemplate, result.selectedFiles);
        console.log(`Saved selection as template: ${result.saveTemplate}`);
      }
    } else {
      console.log('No files selected.');
    }
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

module.exports = { run };
