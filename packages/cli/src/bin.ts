import { createCli } from './index.js';

const program = createCli();
program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
