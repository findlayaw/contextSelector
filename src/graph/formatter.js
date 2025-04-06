/**
 * Graph formatter module for formatting code graph for LLM consumption
 */
const path = require('path');
const fs = require('fs');
const fileSystem = require('../simpleFileSystem');

/**
 * Format code graph for LLM consumption
 * @param {Array} selectedFiles - Array of selected file objects
 * @param {Object} directoryTree - Directory tree object
 * @param {Object} codeGraph - Code graph object
 * @returns {string} - Formatted content for clipboard
 */
async function formatGraphForLLM(selectedFiles, directoryTree, codeGraph) {
  let result = '';

  // Add directory tree
  result += '# Project Directory Structure\n\n';
  result += '```\n';
  result += fileSystem.formatDirectoryTree(directoryTree);
  result += '```\n\n';

  // Add horizontal rule as separator
  result += '---\n\n';

  // Add code graph overview
  result += '# Code Graph Overview\n\n';
  result += `Total Files: ${selectedFiles.length}\n`;
  result += `Total Nodes: ${codeGraph.nodes.length}\n`;
  result += `Total Relationships: ${codeGraph.edges.length}\n\n`;

  // Add node types breakdown
  const nodeTypes = {};
  for (const node of codeGraph.nodes) {
    nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
  }

  result += '## Node Types\n\n';
  for (const [type, count] of Object.entries(nodeTypes)) {
    result += `- ${type}: ${count}\n`;
  }
  result += '\n';

  // Add relationship types breakdown
  const edgeTypes = {};
  for (const edge of codeGraph.edges) {
    edgeTypes[edge.type] = (edgeTypes[edge.type] || 0) + 1;
  }

  result += '## Relationship Types\n\n';
  for (const [type, count] of Object.entries(edgeTypes)) {
    result += `- ${type}: ${count}\n`;
  }
  result += '\n';

  // Add horizontal rule as separator
  result += '---\n\n';

  // Add file dependencies section
  result += '# File Dependencies\n\n';
  
  // Group files by their dependencies
  const fileDependencies = new Map();
  
  for (const edge of codeGraph.edges) {
    if (edge.type === 'imports') {
      const sourceNode = codeGraph.nodes.find(node => node.id === edge.source);
      const targetNode = codeGraph.nodes.find(node => node.id === edge.target);
      
      if (sourceNode && targetNode) {
        if (!fileDependencies.has(sourceNode.id)) {
          fileDependencies.set(sourceNode.id, []);
        }
        
        fileDependencies.get(sourceNode.id).push({
          id: targetNode.id,
          name: path.basename(targetNode.path)
        });
      }
    }
  }
  
  // Format file dependencies
  for (const [fileId, dependencies] of fileDependencies.entries()) {
    const fileNode = codeGraph.nodes.find(node => node.id === fileId);
    if (fileNode) {
      result += `## ${fileNode.path}\n\n`;
      result += 'Dependencies:\n';
      
      if (dependencies.length === 0) {
        result += '- None\n';
      } else {
        for (const dep of dependencies) {
          result += `- ${dep.name} (${dep.id})\n`;
        }
      }
      
      result += '\n';
    }
  }

  // Add horizontal rule as separator
  result += '---\n\n';

  // Add function calls section
  result += '# Function Calls\n\n';
  
  // Group functions by their calls
  const functionCalls = new Map();
  
  for (const edge of codeGraph.edges) {
    if (edge.type === 'calls') {
      const sourceNode = codeGraph.nodes.find(node => node.id === edge.source);
      const targetNode = codeGraph.nodes.find(node => node.id === edge.target);
      
      if (sourceNode && targetNode) {
        if (!functionCalls.has(sourceNode.id)) {
          functionCalls.set(sourceNode.id, []);
        }
        
        functionCalls.get(sourceNode.id).push({
          id: targetNode.id,
          name: targetNode.label,
          path: targetNode.path
        });
      }
    }
  }
  
  // Format function calls
  for (const [funcId, calls] of functionCalls.entries()) {
    const funcNode = codeGraph.nodes.find(node => node.id === funcId);
    if (funcNode) {
      result += `## ${funcNode.label} (${funcNode.path})\n\n`;
      result += 'Calls:\n';
      
      if (calls.length === 0) {
        result += '- None\n';
      } else {
        for (const call of calls) {
          result += `- ${call.name} (${call.path})\n`;
        }
      }
      
      result += '\n';
    }
  }

  // Add horizontal rule as separator
  result += '---\n\n';

  // Add file contents
  result += '# Selected Files\n\n';

  for (const file of selectedFiles) {
    const content = await fileSystem.readFileContent(file.path);
    const extension = path.extname(file.path).substring(1); // Remove the dot

    // Add file path as heading
    result += `## ${file.path}\n\n`;

    // Add file content in fenced code block with language
    result += '```' + (extension || '') + '\n';
    result += content;

    // Ensure the code block ends with a newline
    if (!content.endsWith('\n')) {
      result += '\n';
    }

    result += '```\n\n';

    // Add horizontal rule as separator between files
    result += '---\n\n';
  }

  return result;
}

/**
 * Format a Cypher query for the code graph
 * @param {Object} codeGraph - Code graph object
 * @returns {string} - Cypher query
 */
function formatCypherQuery(codeGraph) {
  let query = '// Cypher query for importing the code graph into Neo4j\n\n';
  
  // Create nodes
  for (const node of codeGraph.nodes) {
    let properties = '';
    for (const [key, value] of Object.entries(node)) {
      if (key !== 'id' && key !== 'type' && value !== undefined) {
        if (typeof value === 'string') {
          properties += `${key}: "${value.replace(/"/g, '\\"')}", `;
        } else if (Array.isArray(value)) {
          properties += `${key}: [${value.map(v => `"${v}"`).join(', ')}], `;
        } else {
          properties += `${key}: ${JSON.stringify(value)}, `;
        }
      }
    }
    
    // Remove trailing comma and space
    if (properties.endsWith(', ')) {
      properties = properties.slice(0, -2);
    }
    
    query += `CREATE (n:${node.type.charAt(0).toUpperCase() + node.type.slice(1)} {id: "${node.id}", ${properties}})\n`;
  }
  
  query += '\n';
  
  // Create relationships
  for (const edge of codeGraph.edges) {
    query += `MATCH (a), (b) WHERE a.id = "${edge.source}" AND b.id = "${edge.target}"\n`;
    query += `CREATE (a)-[:${edge.type.toUpperCase()}]->(b)\n`;
  }
  
  return query;
}

/**
 * Format a graph in S-expression format
 * @param {Object} codeGraph - Code graph object
 * @returns {string} - S-expression
 */
function formatSExpression(codeGraph) {
  let result = '(graph\n';
  
  // Add nodes
  result += '  (nodes\n';
  for (const node of codeGraph.nodes) {
    result += `    (node :id "${node.id}" :type "${node.type}" :label "${node.label || ''}"`;
    
    // Add other properties
    for (const [key, value] of Object.entries(node)) {
      if (key !== 'id' && key !== 'type' && key !== 'label' && value !== undefined) {
        if (typeof value === 'string') {
          result += ` :${key} "${value}"`;
        } else if (Array.isArray(value)) {
          result += ` :${key} (${value.map(v => `"${v}"`).join(' ')})`;
        } else if (typeof value === 'object') {
          result += ` :${key} ${JSON.stringify(value)}`;
        } else {
          result += ` :${key} ${value}`;
        }
      }
    }
    
    result += ')\n';
  }
  result += '  )\n';
  
  // Add edges
  result += '  (edges\n';
  for (const edge of codeGraph.edges) {
    result += `    (edge :source "${edge.source}" :target "${edge.target}" :type "${edge.type}"`;
    
    // Add other properties
    for (const [key, value] of Object.entries(edge)) {
      if (key !== 'source' && key !== 'target' && key !== 'type' && key !== 'id' && value !== undefined) {
        if (typeof value === 'boolean') {
          result += ` :${key} ${value}`;
        } else if (typeof value === 'string') {
          result += ` :${key} "${value}"`;
        } else {
          result += ` :${key} ${value}`;
        }
      }
    }
    
    result += ')\n';
  }
  result += '  )\n';
  
  result += ')\n';
  
  return result;
}

module.exports = {
  formatGraphForLLM,
  formatCypherQuery,
  formatSExpression
};
