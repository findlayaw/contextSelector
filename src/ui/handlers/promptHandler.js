/**
 * Prompt handler for managing prompt functionality
 */

const stateManager = require('../state');
const promptManager = require('../../prompts/manager');
const statusView = require('../components/statusView');

/**
 * Show the prompt input box
 * @param {Object} promptBox - Blessed textarea for prompt input
 * @param {Object} screen - Blessed screen
 */
function showPromptInput(promptBox, screen) {
  const state = stateManager.getState();

  // Load current prompt into the box
  promptBox.setValue(state.currentPrompt);

  // Show the prompt box
  promptBox.hidden = false;
  promptBox.show();
  promptBox.focus();

  screen.render();
}

/**
 * Save prompt template information for later saving
 * @param {string} templateName - Name of the template to save
 * @param {string} promptContent - Content of the prompt to save
 * @param {Object} statusBox - Blessed box for status
 */
function savePromptTemplateInfo(templateName, promptContent, statusBox) {
  const state = stateManager.getState();

  if (templateName && promptContent) {
    // Save the template name and prompt content
    state.promptTemplateToSave = templateName;
    state.currentPrompt = promptContent;

    // Show a notification that the template will be saved
    statusBox.setContent(`Prompt template "${templateName}" will be saved when you exit.`);
  }
}

/**
 * Load a prompt template
 * @param {string} templateName - Name of the template to load
 * @param {Object} promptBox - Blessed textarea for prompt input
 * @param {Object} statusBox - Blessed box for status
 * @returns {Promise<boolean>} - True if template was loaded successfully
 */
async function loadPromptTemplate(templateName, promptBox, statusBox) {
  const state = stateManager.getState();

  try {
    const promptContent = await promptManager.loadPromptTemplate(templateName);

    if (promptContent !== null) {
      // Update the state with the loaded prompt
      state.currentPrompt = promptContent;

      // If the prompt box is visible, update its content
      if (!promptBox.hidden) {
        promptBox.setValue(promptContent);
      }

      // Show success message
      statusBox.setContent(`Prompt template "${templateName}" loaded.`);
      return true;
    } else {
      // Show error message
      statusBox.setContent(`{red-fg}Failed to load prompt template "${templateName}".{/red-fg}`);
      return false;
    }
  } catch (error) {
    // Show error message
    statusBox.setContent(`{red-fg}Error loading prompt template: ${error.message}{/red-fg}`);
    return false;
  }
}

/**
 * Show the template loader with both file and prompt templates
 * @param {Object} templateLoaderBox - Blessed box for template loader
 * @param {Object} fileTemplateList - Blessed list for file templates
 * @param {Object} promptTemplateList - Blessed list for prompt templates
 * @param {Object} screen - Blessed screen
 */
async function showTemplateLoader(templateLoaderBox, fileTemplateList, promptTemplateList, screen) {
  const state = stateManager.getState();

  // Reset selected prompt templates
  state.selectedPromptTemplates = [];

  // Load file templates
  const fileTemplateManager = require('../../templates/manager');
  const fileTemplates = await fileTemplateManager.listTemplates();
  fileTemplateList.setItems(fileTemplates.length > 0 ? fileTemplates : ['No file templates']);

  // Load prompt templates
  const promptTemplates = await promptManager.listPromptTemplates();
  promptTemplateList.setItems(promptTemplates.length > 0 ? promptTemplates : ['No prompt templates']);

  // Set initial focus
  state.templateLoaderFocus = 'files';
  fileTemplateList.focus();
  fileTemplateList.style.border = { fg: 'green' }; // Focused style
  promptTemplateList.style.border = { fg: 'white' }; // Unfocused style

  // Show the template loader
  templateLoaderBox.hidden = false;
  templateLoaderBox.show();

  screen.render();
}

module.exports = {
  showPromptInput,
  savePromptTemplateInfo,
  loadPromptTemplate,
  showTemplateLoader
};
