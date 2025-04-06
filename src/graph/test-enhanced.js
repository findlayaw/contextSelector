/**
 * Test file for the enhanced Graph Mode
 */
const parser = require('./parser');
const analyzer = require('./analyzer');
const formatter = require('./formatter');
const fs = require('fs');
const path = require('path');

/**
 * Test the enhanced Graph Mode with a sample file
 */
async function testGraphMode() {
  try {
    console.log('Testing Enhanced Graph Mode...');
    
    // Create a list of files to analyze
    const selectedFiles = [
      { path: path.resolve(__dirname, './parser.js') },
      { path: path.resolve(__dirname, './codeParser.js') },
      { path: path.resolve(__dirname, './analyzer.js') },
      { path: path.resolve(__dirname, './formatter.js') },
      { path: path.resolve(__dirname, './test-enhanced.js') }
    ];
    
    // Create a simple directory tree
    const directoryTree = {
      name: 'graph',
      path: path.resolve(__dirname),
      children: selectedFiles.map(file => ({
        name: path.basename(file.path),
        path: file.path,
        isDirectory: false
      }))
    };
    
    console.log(`Analyzing ${selectedFiles.length} files...`);
    
    // Build the code graph
    const codeGraph = analyzer.buildCodeGraph(selectedFiles);
    
    console.log(`Built code graph with ${codeGraph.nodes.length} nodes and ${codeGraph.edges.length} relationships`);
    
    // Format the graph for LLM
    const formattedGraph = await formatter.formatGraphForLLM(selectedFiles, directoryTree, codeGraph);
    
    // Save the formatted graph to a file
    const outputPath = path.resolve(__dirname, '../../graph-output.md');
    fs.writeFileSync(outputPath, formattedGraph, 'utf8');
    
    console.log(`Graph analysis saved to ${outputPath}`);
    
    // Print some statistics
    const nodeTypes = {};
    for (const node of codeGraph.nodes) {
      nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
    }
    
    console.log('Node types:');
    for (const [type, count] of Object.entries(nodeTypes)) {
      console.log(`- ${type}: ${count}`);
    }
    
    const edgeTypes = {};
    for (const edge of codeGraph.edges) {
      edgeTypes[edge.type] = (edgeTypes[edge.type] || 0) + 1;
    }
    
    console.log('Relationship types:');
    for (const [type, count] of Object.entries(edgeTypes)) {
      console.log(`- ${type}: ${count}`);
    }
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Error testing Graph Mode:', error);
  }
}

// Run the test
testGraphMode();
