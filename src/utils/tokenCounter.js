/**
 * Count tokens in a string
 * @param {string} text - Text to count tokens in
 * @returns {number} - Approximate token count
 */
function countTokens(text) {
  if (!text) return 0;

  // This is a simple approximation of token counting
  // For a more accurate count, you would use a proper tokenizer like tiktoken
  // But for simplicity, we'll use a rough approximation

  // Split by whitespace and punctuation
  const words = text.split(/\s+/);

  // Count words and add some overhead for punctuation and special tokens
  return Math.ceil(words.length * 1.3);
}

/**
 * Count tokens in the formatted output
 * @param {string} formattedContent - Formatted content for LLM
 * @returns {number} - Approximate token count
 */
function countFormattedTokens(formattedContent) {
  if (!formattedContent) return 0;

  // Use the same token counting logic as above
  return countTokens(formattedContent);
}

module.exports = { countTokens, countFormattedTokens };
