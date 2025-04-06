/**
 * Manager module for prompt templates
 */

const storage = require('./storage');

/**
 * Save a prompt template
 * @param {string} name - Template name
 * @param {string} promptContent - Prompt content
 * @returns {Promise<void>}
 */
async function savePromptTemplate(name, promptContent) {
  try {
    await storage.savePromptTemplate(name, promptContent);
  } catch (error) {
    console.error('Error saving prompt template:', error.message);
    throw error;
  }
}

/**
 * Load a prompt template
 * @param {string} name - Template name
 * @returns {Promise<string|null>} - Prompt content
 */
async function loadPromptTemplate(name) {
  try {
    return await storage.loadPromptTemplate(name);
  } catch (error) {
    console.error('Error loading prompt template:', error.message);
    return null;
  }
}

/**
 * List all prompt templates
 * @returns {Promise<Array>} - Array of template names
 */
async function listPromptTemplates() {
  try {
    return await storage.listPromptTemplates();
  } catch (error) {
    console.error('Error listing prompt templates:', error.message);
    return [];
  }
}

/**
 * Delete a prompt template
 * @param {string} name - Template name
 * @returns {Promise<boolean>} - True if successful
 */
async function deletePromptTemplate(name) {
  try {
    return await storage.deletePromptTemplate(name);
  } catch (error) {
    console.error('Error deleting prompt template:', error.message);
    return false;
  }
}

module.exports = {
  savePromptTemplate,
  loadPromptTemplate,
  listPromptTemplates,
  deletePromptTemplate
};
