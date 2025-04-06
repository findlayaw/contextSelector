#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const app = require('../src/index');

program
  .name('aw')
  .description('Context Selector: Select files from your codebase for LLM context')
  .version('1.0.0')
  .option('-t, --template <name>', 'Load a saved selection template')
  .option('-s, --search <query>', 'Start with a search query')
  .option('-d, --directory <path>', 'Specify the starting directory', process.cwd())
  .option('-g, --graph', 'Enable graph mode to analyze code relationships')
  .action(async (options) => {
    try {
      await app.run(options);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
