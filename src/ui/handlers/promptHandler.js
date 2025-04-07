/**
 * Prompt handler for managing prompt functionality
 */

const stateManager = require('../state');
const promptManager = require('../../prompts/manager');
const statusView = require('../components/statusView');

/**
 * Show the prompt selection dialog
 * @param {Object} box - Blessed list box for prompt selection
 */
async function showPromptSelection(box) {
  const state = stateManager.getState();
  
  // Get available prompts
  state.availablePrompts = await promptManager.listPrompts();
  
  // Create display items with selection indicators
  const displayItems = [];
  
  if (state.availablePrompts.length === 0) {
    displayItems.push('No prompts available. Press "a" to add a new prompt.');
  } else {
    state.availablePrompts.forEach(name => {
      const isSelected = state.selectedPrompts.has(name);
      // Add indicator for selected prompts
      const prefix = isSelected ? '{green-fg}✓{/green-fg} ' : '  ';
      displayItems.push(`${prefix}${name}`);
    });
  }
  
  // Set items and show the box
  box.setItems(displayItems);
  box.hidden = false;
  box.show();
  box.focus();
}

/**
 * Toggle selection of the currently highlighted prompt
 * @param {Object} box - Blessed list box for prompt selection
 */
async function togglePromptSelection(box) {
  const state = stateManager.getState();
  const selectedIndex = box.selected;
  
  // Check if there are any prompts and if the selection is valid
  if (state.availablePrompts.length === 0 || selectedIndex < 0 || selectedIndex >= state.availablePrompts.length) {
    return; // No valid prompt selected
  }
  
  const promptName = state.availablePrompts[selectedIndex];
  
  if (state.selectedPrompts.has(promptName)) {
    // Deselect the prompt
    state.selectedPrompts.delete(promptName);
  } else {
    // Select the prompt - load its content first
    const promptData = await promptManager.loadPrompt(promptName);
    if (promptData && promptData.content) {
      state.selectedPrompts.set(promptName, promptData.content);
    }
  }
  
  // Refresh the display
  await showPromptSelection(box);
  
  // Restore the selection
  box.select(selectedIndex);
}

/**
 * Delete the currently highlighted prompt
 * @param {Object} box - Blessed list box for prompt selection
 * @param {Object} confirmationBox - Blessed box for confirmation dialog
 * @param {Object} statusBox - Blessed box for status messages
 */
async function deleteSelectedPrompt(box, confirmationBox, statusBox) {
  const state = stateManager.getState();
  const selectedIndex = box.selected;
  
  // Check if there are any prompts and if the selection is valid
  if (state.availablePrompts.length === 0 || selectedIndex < 0 || selectedIndex >= state.availablePrompts.length) {
    return; // No valid prompt selected
  }
  
  const promptName = state.availablePrompts[selectedIndex];
  
  // Show confirmation dialog
  statusView.showConfirmationDialog(
    confirmationBox,
    `Delete prompt "${promptName}"? (Cannot be undone)\n\n[y] Yes  [n] No`,
    async (confirmed) => {
      if (confirmed) {
        const success = await promptManager.deletePrompt(promptName);
        if (success) {
          // Remove from selected if it was selected
          state.selectedPrompts.delete(promptName);
          statusBox.setContent(`Prompt "${promptName}" deleted.`);
        } else {
          statusBox.setContent(`{red-fg}Error deleting prompt "${promptName}".{/red-fg}`);
        }
        
        // Refresh the list
        await showPromptSelection(box);
      } else {
        statusBox.setContent('Deletion cancelled.');
      }
      
      // Restore status after a delay
      setTimeout(() => {
        statusView.updateStatus(statusBox, state.isSearchActive, false, null);
        box.screen.render();
      }, 2000);
      
      box.focus();
      box.screen.render();
    }
  );
}

/**
 * Initiate the add prompt flow
 * @param {Object} promptSelectBox - Blessed list box for prompt selection
 * @param {Object} promptAddBox - Blessed textbox for prompt name input
 */
function initiateAddPrompt(promptSelectBox, promptAddBox) {
  const state = stateManager.getState();
  
  state.isPromptAddMode = true;
  promptSelectBox.hide();
  promptAddBox.hidden = false;
  promptAddBox.setValue('');
  promptAddBox.focus();
}

/**
 * Save a new prompt
 * @param {string} name - Prompt name
 * @param {string} content - Prompt content
 * @param {Object} statusBox - Blessed box for status messages
 */
async function saveNewPrompt(name, content, statusBox) {
  try {
    await promptManager.savePrompt(name, content);
    statusBox.setContent(`Prompt "${name}" saved.`);
  } catch (error) {
    statusBox.setContent(`{red-fg}Error saving prompt: ${error.message}{/red-fg}`);
  }
  
  // Restore status after a delay
  setTimeout(() => {
    const state = stateManager.getState();
    statusView.updateStatus(statusBox, state.isSearchActive, false, null);
    statusBox.screen.render();
  }, 2000);
}

module.exports = {
  showPromptSelection,
  togglePromptSelection,
  deleteSelectedPrompt,
  initiateAddPrompt,
  saveNewPrompt
};
