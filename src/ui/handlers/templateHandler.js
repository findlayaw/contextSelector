/**
 * Template handler for managing template functionality
 */

const fs = require('fs');
const stateManager = require('../state');
const templateManager = require('../../templates/manager');
const treeView = require('../components/treeView');
const selectionView = require('../components/selectionView');
const statusView = require('../components/statusView');

/**
 * Show the template selection dialog
 * @param {Object} box - Blessed list box for template selection
 */
async function showTemplateSelection(box) {
  const templates = await templateManager.listTemplates();

  if (templates.length === 0) {
    box.setItems(['No templates available']);
  } else {
    box.setItems(templates);
  }

  // Ensure the box is properly shown
  box.hidden = false;
  box.show();
  box.focus();
}

/**
 * Load a template
 * @param {string} templateName - Name of the template to load
 * @param {Object} infoBox - Blessed box for selected files
 * @param {Object} treeBox - Blessed box for file tree
 * @param {Object} statusBox - Blessed box for status
 * @param {Object} templateLoaderBox - Blessed box for template loader
 * @returns {Promise<boolean>} - True if template was loaded successfully
 */
async function loadTemplate(templateName, infoBox, treeBox, statusBox, templateLoaderBox) {
  const state = stateManager.getState();

  const template = await templateManager.loadTemplate(templateName);
  if (template && template.files) {
    // Check if each file/directory in the template exists
    const validSelectedFiles = [];
    const validSelectedEmptyDirs = [];
    const missingItems = [];

    for (const itemFromTemplate of template.files) {
      // Check if the path stored in the template actually exists
      if (fs.existsSync(itemFromTemplate.path)) {
        // Check if it's a file or directory
        const stats = fs.statSync(itemFromTemplate.path);
        if (stats.isFile()) {
          validSelectedFiles.push(itemFromTemplate);
        } else if (stats.isDirectory() && (!itemFromTemplate.children || itemFromTemplate.children.length === 0)) {
          // It's an empty directory
          validSelectedEmptyDirs.push(itemFromTemplate);
        }
      } else {
        // Keep track of items that couldn't be found
        missingItems.push(itemFromTemplate.relativePath || itemFromTemplate.path);
      }
    }

    state.selectedFiles = validSelectedFiles; // Assign only the files that were found
    state.selectedEmptyDirs = validSelectedEmptyDirs; // Assign only the empty directories that were found

    // Notify the user if some items were missing
    if (missingItems.length > 0) {
      const missingItemsList = missingItems.join('\n  - ');
      // Temporarily show a message in the status box
      statusBox.setContent(`{yellow-fg}Warning: The following items from the template were not found and were skipped:{/yellow-fg}\n  - ${missingItemsList}\n\n(Loading remaining files...)`);
      statusBox.screen.render(); // Render the temporary message
      // Wait a bit before showing the final status update
      await new Promise(resolve => setTimeout(resolve, 3000)); // Show warning for 3 seconds
    }

    selectionView.updateSelectedFiles(infoBox);
    selectionView.updateTokenCount();
    statusView.updateStatus(statusBox, false, false, templateLoaderBox);
    // Render the tree to show visual indicators for selected files
    treeView.renderTree(treeBox, state.directoryTree);

    return true;
  }

  return false;
}

/**
 * Save template information for later saving
 * @param {string} templateName - Name of the template to save
 * @param {Object} statusBox - Blessed box for status
 * @param {boolean} isSearchActive - Whether search is active
 * @param {Object} templateLoaderBox - Blessed box for template loader
 */
function saveTemplateInfo(templateName, statusBox, isSearchActive, templateLoaderBox) {
  const state = stateManager.getState();

  if (templateName) {
    // Save the template name and take a snapshot of currently selected files and empty directories
    state.templateToSave = templateName;
    // Create a deep copy of the selected files and empty directories to save in the template
    state.templateFiles = JSON.parse(JSON.stringify(state.selectedFiles));
    // Add selected empty directories to the template files
    const emptyDirsCopy = JSON.parse(JSON.stringify(state.selectedEmptyDirs));
    state.templateFiles = state.templateFiles.concat(emptyDirsCopy);

    // Show a notification that the template will be saved
    statusBox.setContent(`Template "${templateName}" will be saved when you exit. Continue selecting files...\n\n` +
      statusView.updateStatus(statusBox, isSearchActive, true, templateLoaderBox));
  }
}

module.exports = {
  showTemplateSelection,
  loadTemplate,
  saveTemplateInfo
};
