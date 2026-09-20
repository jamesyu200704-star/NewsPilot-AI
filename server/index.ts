import { loadLocalEnvironment, readServerConfig } from './config.js';
import { createServer } from 'node:http';
import { createConfiguredApiApp } from './运行时.js';

loadLocalEnvironment();

const config = readServerConfig();
const server = createServer(createConfiguredApiApp(process.env));

server.listen(config.port, config.host, () => {
  console.log(
    '[NewsPilot] Generator Service 已启动：http://' +
      config.host +
      ':' +
      config.port +
      '（provider: ' +
      config.provider +
      '，fallback: mock）',
  );
});

const closeServer = () => {
  server.close(() => process.exit(0));
};

process.once('SIGINT', closeServer);
process.once('SIGTERM', closeServer);
