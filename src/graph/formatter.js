/**
 * Enhanced graph formatter module for formatting code graph for LLM consumption
 */
const path = require('path');
const fs = require('fs');
const fileSystem = require('../simpleFileSystem');
const tokenCounter = require('../utils/tokenCounter');

/**
 * Format code graph for LLM consumption
 * @param {Array} selectedFiles - Array of selected file objects
 * @param {Object} directoryTree - Directory tree object
 * @param {Object} codeGraph - Code graph object
 * @param {string} currentPrompt - Current prompt text
 * @returns {string} - Formatted content for clipboard
 */
async function formatGraphForLLM(selectedFiles, directoryTree, codeGraph, currentPrompt) {
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
          name: path.basename(targetNode.path),
          importName: edge.importName || '*'
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
          result += `- ${dep.name} (${dep.importName})\n`;
        }
      }

      result += '\n';
    }
  }

  // Add horizontal rule as separator
  result += '---\n\n';

  // Add class hierarchy section
  result += '# Class Hierarchy\n\n';

  // Get all class nodes
  const classNodes = codeGraph.nodes.filter(node => node.type === 'class');

  // Group classes by inheritance
  const classHierarchy = new Map();
  const rootClasses = [];

  for (const classNode of classNodes) {
    const extendsEdges = codeGraph.edges.filter(edge =>
      edge.source === classNode.id && edge.type === 'extends'
    );

    if (extendsEdges.length > 0) {
      for (const edge of extendsEdges) {
        if (!classHierarchy.has(edge.target)) {
          classHierarchy.set(edge.target, []);
        }
        classHierarchy.get(edge.target).push(classNode);
      }
    } else {
      rootClasses.push(classNode);
    }
  }

  // Format class hierarchy
  function formatClassHierarchy(classNode, level = 0) {
    let hierarchyText = '';
    const indent = '  '.repeat(level);

    hierarchyText += `${indent}- ${classNode.label} (${classNode.path})`;

    // Add methods and properties if available
    if (classNode.methods && classNode.methods.length > 0) {
      hierarchyText += ` [Methods: ${classNode.methods.join(', ')}]`;
    }

    if (classNode.properties && classNode.properties.length > 0) {
      hierarchyText += ` [Properties: ${classNode.properties.join(', ')}]`;
    }

    hierarchyText += '\n';

    // Add child classes
    const children = classHierarchy.get(classNode.id) || [];
    for (const child of children) {
      hierarchyText += formatClassHierarchy(child, level + 1);
    }

    return hierarchyText;
  }

  if (rootClasses.length > 0) {
    for (const rootClass of rootClasses) {
      result += formatClassHierarchy(rootClass);
    }
  } else {
    result += 'No class hierarchy detected.\n';
  }

  result += '\n';

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
          path: targetNode.path,
          args: edge.args || '',
          line: edge.line,
          column: edge.column
        });
      }
    }
  }

  // Format function calls
  for (const [funcId, calls] of functionCalls.entries()) {
    const funcNode = codeGraph.nodes.find(node => node.id === funcId);
    if (funcNode) {
      result += `## ${funcNode.label} (${funcNode.path})\n\n`;

      // Add function type and parameters if available
      if (funcNode.functionType) {
        result += `Type: ${funcNode.functionType}\n`;
      }

      if (funcNode.params && funcNode.params.length > 0) {
        result += `Parameters: ${funcNode.params.join(', ')}\n`;
      }

      result += 'Calls:\n';

      if (calls.length === 0) {
        result += '- None\n';
      } else {
        for (const call of calls) {
          let callText = `- ${call.name} (${path.basename(call.path)})`;

          if (call.args) {
            callText += ` with args: ${call.args}`;
          }

          if (call.line) {
            callText += ` at line ${call.line}`;
          }

          result += callText + '\n';
        }
      }

      result += '\n';
    }
  }

  // Add horizontal rule as separator
  result += '---\n\n';

  // Add variable usage section
  result += '# Important Variables\n\n';

  // Get all variable nodes
  const variableNodes = codeGraph.nodes.filter(node => node.type === 'variable');

  if (variableNodes.length > 0) {
    for (const varNode of variableNodes) {
      result += `## ${varNode.label} (${varNode.path})\n\n`;

      result += `Type: ${varNode.kind} ${varNode.valueType || ''}\n`;

      // Find references to this variable
      const references = codeGraph.edges.filter(edge =>
        (edge.source === varNode.id || edge.target === varNode.id) &&
        edge.type !== 'defined_in'
      );

      if (references.length > 0) {
        result += 'Referenced by:\n';

        for (const ref of references) {
          const otherNodeId = ref.source === varNode.id ? ref.target : ref.source;
          const otherNode = codeGraph.nodes.find(node => node.id === otherNodeId);

          if (otherNode) {
            result += `- ${otherNode.label} (${otherNode.type}) in ${path.basename(otherNode.path)}\n`;
          }
        }
      } else {
        result += 'No references found.\n';
      }

      result += '\n';
    }
  } else {
    result += 'No important variables detected.\n\n';
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
 * Format a Cypher query for Neo4j from the code graph
 * @param {Object} codeGraph - Code graph object
 * @returns {string} - Cypher query
 */
function formatCypherQuery(codeGraph) {
  let query = '';

  // Create nodes
  for (const node of codeGraph.nodes) {
    query += `CREATE (n${node.id.replace(/[^a-zA-Z0-9]/g, '_')}:${node.type} {`;

    // Add properties
    const props = [];
    for (const [key, value] of Object.entries(node)) {
      if (key !== 'node' && value !== undefined) { // Skip the AST node
        if (typeof value === 'string') {
          props.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
        } else if (Array.isArray(value)) {
          props.push(`${key}: [${value.map(v => `"${v.replace(/"/g, '\\"')}"`).join(', ')}]`);
        } else if (typeof value === 'object') {
          props.push(`${key}: "${JSON.stringify(value).replace(/"/g, '\\"')}"`);
        } else {
          props.push(`${key}: ${value}`);
        }
      }
    }

    query += props.join(', ');
    query += '})\n';
  }

  // Create relationships
  for (const edge of codeGraph.edges) {
    const sourceId = edge.source.replace(/[^a-zA-Z0-9]/g, '_');
    const targetId = edge.target.replace(/[^a-zA-Z0-9]/g, '_');

    query += `CREATE (n${sourceId})-[:${edge.type} {`;

    // Add properties
    const props = [];
    for (const [key, value] of Object.entries(edge)) {
      if (key !== 'source' && key !== 'target' && key !== 'type' && key !== 'id' && value !== undefined) {
        if (typeof value === 'string') {
          props.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
        } else if (typeof value === 'boolean') {
          props.push(`${key}: ${value}`);
        } else {
          props.push(`${key}: ${value}`);
        }
      }
    }

    query += props.join(', ');
    query += `}]->(n${targetId})\n`;
  }

  return query;
}

/**
 * Format an S-expression from the code graph
 * @param {Object} codeGraph - Code graph object
 * @returns {string} - S-expression
 */
function formatSExpression(codeGraph) {
  let result = '(code-graph\n';

  // Add nodes
  result += '  (nodes\n';
  for (const node of codeGraph.nodes) {
    result += `    (node :id "${node.id}" :type "${node.type}" :label "${node.label || ''}"`;

    // Add other properties
    for (const [key, value] of Object.entries(node)) {
      if (key !== 'id' && key !== 'type' && key !== 'label' && key !== 'node' && value !== undefined) {
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

  // Add prompt if it exists
  if (currentPrompt && currentPrompt.trim().length > 0) {
    result += '---\n\n';
    result += '## IMPORTANT: User Instructions\n\n';
    result += currentPrompt;

    // Ensure trailing newline if prompt doesn't end with one
    if (!currentPrompt.endsWith('\n')) {
      result += '\n';
    }
  }

  return result;
}

module.exports = {
  formatGraphForLLM,
  formatCypherQuery,
  formatSExpression
};
