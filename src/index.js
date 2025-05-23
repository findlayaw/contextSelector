const path = require('path');
const fs = require('fs');
const fileSystem = require('./simpleFileSystem');
const terminal = require('./ui/terminal');
const formatter = require('./clipboard/formatter');
const xmlFormatter = require('./clipboard/xmlFormatter');
const copy = require('./clipboard/copy');
const templateManager = require('./templates/manager');
const graphAnalyzer = require('./graph/analyzer');
const graphFormatter = require('./graph/formatter');
const graphXmlFormatter = require('./graph/xmlFormatter');
const codeMapsParser = require('./codemaps/parser');
const codeMapsFormatter = require('./codemaps/formatter');
const codeMapsXmlFormatter = require('./codemaps/xmlFormatter');
const tokenCounter = require('./utils/tokenCounter');
const modeHandler = require('./ui/modeHandler');
const outputHandler = require('./ui/outputHandler');

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
      graphMode: options.graph, // Pass graph mode option to terminal
      codeMapsMode: options.codemaps, // Pass codemaps mode option to terminal
      includeContents: options.includeContents, // Pass include contents option to terminal
      xmlOutput: options.xml // Pass XML output option to terminal
    });

    if (result.selectedFiles && result.selectedFiles.length > 0) {
      let formattedContent;

      // Check which mode is enabled (either from command line or from terminal UI)
      if (result.mode === modeHandler.MODES.GRAPH) {
        console.log('Building code graph...');
        // Build code graph
        const codeGraph = graphAnalyzer.buildCodeGraph(result.selectedFiles);

        // Format the graph for LLM based on the output format
        if (result.outputFormat === outputHandler.OUTPUT_FORMATS.XML) {
          formattedContent = await graphXmlFormatter.formatGraphForLLM(
            result.selectedFiles,
            result.directoryTree,
            codeGraph,
            result.selectedPrompts
          );
        } else {
          formattedContent = await graphFormatter.formatGraphForLLM(
            result.selectedFiles,
            result.directoryTree,
            codeGraph,
            result.selectedPrompts
          );
        }

        console.log(`Built code graph with ${codeGraph.nodes.length} nodes and ${codeGraph.edges.length} relationships`);
      } else if (result.mode === modeHandler.MODES.CODEMAPS) {
        console.log('Building code maps...');
        // Build code maps
        const codeMaps = codeMapsParser.buildCodeMaps(result.selectedFiles);

        // Format the code maps for LLM based on the output format
        if (result.outputFormat === outputHandler.OUTPUT_FORMATS.XML) {
          formattedContent = await codeMapsXmlFormatter.formatCodeMapsForLLM(
            result.selectedFiles,
            result.directoryTree,
            codeMaps,
            {
              // Include file contents if specified in options or from terminal UI
              includeFileContents: result.includeContents
            },
            result.selectedPrompts
          );
        } else {
          formattedContent = await codeMapsFormatter.formatCodeMapsForLLM(
            result.selectedFiles,
            result.directoryTree,
            codeMaps,
            {
              // Include file contents if specified in options or from terminal UI
              includeFileContents: result.includeContents
            },
            result.selectedPrompts
          );
        }

        console.log(`Built code maps with ${codeMaps.files.length} files and ${codeMaps.relationships.length} relationships`);
      } else {
        // Format the selected files normally (standard mode) based on the output format
        if (result.outputFormat === outputHandler.OUTPUT_FORMATS.XML) {
          formattedContent = await xmlFormatter.formatForLLM(
            result.selectedFiles,
            result.directoryTree,
            result.selectedPrompts
          );
        } else {
          formattedContent = await formatter.formatForLLM(
            result.selectedFiles,
            result.directoryTree,
            result.selectedPrompts
          );
        }
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
