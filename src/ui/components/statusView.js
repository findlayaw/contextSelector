/**
 * Status view component for displaying status information
 */

const stateManager = require('../state');
const modeHandler = require('../modeHandler');
const outputHandler = require('../outputHandler');

/**
 * Update the status display
 * @param {Object} box - Blessed box to update
 * @param {boolean} isSearchMode - Whether we're in search mode
 * @param {boolean} returnContentOnly - Whether to return the content string instead of updating the box
 * @param {Object} templateBox - Template selection box to check visibility
 * @returns {string|undefined} - Status content if returnContentOnly is true
 */
function updateStatus(box, isSearchMode = false, returnContentOnly = false, templateBox = null) {
  const state = stateManager.getState();

  // Create a status display with all controls visible and key information in bold
  let escapeAction = 'Quit';
  if (isSearchMode) {
    escapeAction = 'Exit search';
  } else if (templateBox && !templateBox.hidden) {
    escapeAction = 'Close template selection';
  } else if (state.isPromptSelectMode) {
    escapeAction = 'Close prompt selection';
  } else if (state.isPromptAddMode) {
    escapeAction = 'Cancel adding prompt';
  }

  // Add mode indicator
  const modeName = modeHandler.getModeName(state.currentMode);
  const outputName = outputHandler.getOutputName(state.currentOutputFormat, state.includeContents, state.currentMode);
  const modeDisplay = ` | {bold}Mode:{/bold} ${modeName} | {bold}Output:{/bold} ${outputName}`;

  // Add prompt status indicator
  const promptStatus = state.selectedPrompts.size > 0 ? ` | {bold}Prompt:{/bold} Active` : '';

  const content = [
    `{bold}Selected:{/bold} ${state.selectedFiles.length} files | {bold}Tokens:{/bold} ${state.tokenCount}` +
    (state.templateToSave ? ` | {bold}Template to save:{/bold} ${state.templateToSave}` : '') +
    modeDisplay +
    promptStatus,
    '{bold}Controls:{/bold}',
    '  {bold}Navigation:{/bold}     {bold}↑/↓:{/bold} Navigate       {bold}h:{/bold} Parent directory   {bold}l:{/bold} Enter directory',
    '  {bold}Vim-like:{/bold}       {bold}g:{/bold} Jump to top     {bold}G:{/bold} Jump to bottom     {bold}a:{/bold} Toggle all visible',
    '  {bold}UI Focus:{/bold}       {bold}Tab:{/bold} Switch panels   {bold}Space:{/bold} Select/Unselect',
    '  {bold}Selection:{/bold}      {bold}Space:{/bold} Toggle select  {bold}S-↑/↓:{/bold} Multi-select',
    '  {bold}Templates:{/bold}      {bold}t:{/bold} Load template   {bold}s:{/bold} Save template      {bold}d:{/bold} Delete template',
    '  {bold}Actions:{/bold}        {bold}/{/bold} Search          {bold}c:{/bold} Copy                {bold}m:{/bold} Change mode       {bold}o:{/bold} Output format',
    '  {bold}Prompts:        {bold}p:{/bold} Manage prompts',
  '  {bold}Exit:{/bold}           {bold}q:{/bold} Quit',
    `  {bold}Exit/Cancel:{/bold}    {bold}Esc:{/bold} ${escapeAction}`
  ].filter(line => line !== '').join('\n');

  if (returnContentOnly) {
    return content;
  }

  box.setContent(content);
}

/**
 * Show a confirmation dialog
 * @param {Object} box - Blessed box for the confirmation dialog
 * @param {string} message - Message to display
 * @param {Function} callback - Callback function to call with the result (true/false)
 */
function showConfirmationDialog(box, message, callback) {
  // Set the content of the confirmation box
  box.setContent(message);

  // Show the box and ensure it's visible
  box.hidden = false;
  box.show();
  box.setFront();
  box.focus();
  box.screen.render();

  // Handle key events for the confirmation dialog
  const onKey = (_, key) => {
    if (key.name === 'y') {
      // User confirmed
      box.hide();
      box.hidden = true;
      // Remove both key event handlers
      box.unkey(['y', 'n', 'escape'], onKey);
      box.screen.unkey(['y', 'n', 'escape'], onKey);
      callback(true);
    } else if (key.name === 'n' || key.name === 'escape') {
      // User cancelled
      box.hide();
      box.hidden = true;
      // Remove both key event handlers
      box.unkey(['y', 'n', 'escape'], onKey);
      box.screen.unkey(['y', 'n', 'escape'], onKey);
      callback(false);
    }
  };

  // Add the key event handler - use direct box key handling for better focus management
  box.key(['y', 'n', 'escape'], onKey);

  // Also register with screen as a fallback
  box.screen.key(['y', 'n', 'escape'], onKey);
}

module.exports = {
  updateStatus,
  showConfirmationDialog
};
