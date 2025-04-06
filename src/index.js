const path = require('path');
const fs = require('fs');
const fileSystem = require('./simpleFileSystem');
const terminal = require('./ui/terminal');
const formatter = require('./clipboard/formatter');
const copy = require('./clipboard/copy');
const templateManager = require('./templates/manager');
const graphAnalyzer = require('./graph/analyzer');
const graphFormatter = require('./graph/formatter');
const tokenCounter = require('./utils/tokenCounter');

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
      template: options.template,
      graphMode: options.graph // Pass graph mode option to terminal
    });

    if (result.selectedFiles && result.selectedFiles.length > 0) {
      let formattedContent;

      // Check if graph mode is enabled (either from command line or from terminal UI)
      if (result.mode === 'graph') {
        console.log('Building code graph...');
        // Build code graph
        const codeGraph = graphAnalyzer.buildCodeGraph(result.selectedFiles);

        // Format the graph for LLM
        formattedContent = await graphFormatter.formatGraphForLLM(
          result.selectedFiles,
          result.directoryTree,
          codeGraph
        );

        console.log(`Built code graph with ${codeGraph.nodes.length} nodes and ${codeGraph.edges.length} relationships`);
      } else {
        // Format the selected files normally
        formattedContent = await formatter.formatForLLM(
          result.selectedFiles,
          result.directoryTree
        );
      }

      // Calculate the actual token count of the formatted content
      const actualTokenCount = tokenCounter.countFormattedTokens(formattedContent);

      // Copy to clipboard
      await copy.toClipboard(formattedContent);

      console.log(`Copied ${result.selectedFiles.length} files to clipboard (${actualTokenCount} tokens)`);

      // Save template if requested
      if (result.saveTemplate) {
        // Use the template files snapshot if available, otherwise use the current selected files
        const filesToSave = result.templateFiles || result.selectedFiles;
        await templateManager.saveTemplate(result.saveTemplate, filesToSave);
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
