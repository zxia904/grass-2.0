// index.js
require('colors');
const inquirer = require('inquirer');
const Bot = require('./src/Bot');
const Config = require('./src/Config');
const {
  fetchProxies,
  readLines,
  selectProxySource,
} = require('./src/ProxyManager');
const { delay, displayHeader } = require('./src/utils');

async function validateSetup() {
  try {
    const userIDs = await readLines('uid.txt');
    if (userIDs.length === 0) {
      throw new Error('No user IDs found in uid.txt');
    }
    return userIDs;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('uid.txt file not found. Please create it with your user IDs');
    }
    throw error;
  }
}

async function getProxies(proxySource) {
  let proxies = [];
  
  try {
    if (proxySource.type === 'file') {
      proxies = await readLines(proxySource.source);
      console.log(`Loading proxies from file: ${proxySource.source}`.cyan);
    } else if (proxySource.type === 'url') {
      console.log(`Fetching proxies from URL: ${proxySource.source}`.cyan);
      proxies = await fetchProxies(proxySource.source);
    }

    if (proxySource.type !== 'none' && proxies.length === 0) {
      throw new Error('No valid proxies found');
    }

    return proxies;
  } catch (error) {
    throw new Error(`Failed to load proxies: ${error.message}`);
  }
}

async function initializeConnections(bot, userIDs, proxies, proxySource) {
  const totalConnections = proxySource.type !== 'none' 
    ? userIDs.length * proxies.length 
    : userIDs.length;

  console.log(`\nInitializing ${totalConnections} connections...`.cyan);
  console.log(`Mode: ${proxySource.type !== 'none' ? 'Proxy' : 'Direct'}\n`.cyan);

  const connectionPromises = userIDs.flatMap((userID) => {
    if (proxySource.type !== 'none') {
      return proxies.map(async (proxy) => {
        try {
          await bot.connectToProxy(proxy, userID);
        } catch (error) {
          console.error(`Failed to connect using proxy ${proxy} for user ${userID}: ${error.message}`.red);
        }
      });
    } else {
      return [
        bot.connectDirectly(userID).catch(error => {
          console.error(`Failed to connect directly for user ${userID}: ${error.message}`.red);
        })
      ];
    }
  });

  return Promise.all(connectionPromises);
}

async function main() {
  try {
    displayHeader();
    console.log(`Initializing...\n`.yellow);
    await delay(1000);

    // 初始化配置和bot实例
    const config = new Config();
    const bot = new Bot(config);

    // 验证用户ID
    const userIDs = await validateSetup();
    console.log(`Found ${userIDs.length} user IDs`.green);

    // 选择代理来源
    const proxySource = await selectProxySource(inquirer);
    
    // 获取代理列表
    let proxies = [];
    if (proxySource.type !== 'none') {
      proxies = await getProxies(proxySource);
      console.log(`Successfully loaded ${proxies.length} proxies`.green);
    } else {
      console.log('Direct connection mode selected'.cyan);
    }

    // 确认启动
    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Start connections now?',
      default: true
    }]);

    if (!confirm) {
      console.log('Operation cancelled by user'.yellow);
      return;
    }

    // 初始化连接
    await initializeConnections(bot, userIDs, proxies, proxySource);

  } catch (error) {
    console.error(`\nError: ${error.message}`.red);
    console.error('Application terminated due to error'.red);
    process.exit(1);
  }
}

// 添加进程异常处理
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:'.red, error);
});

process.on('SIGINT', () => {
  console.log('\nGracefully shutting down...'.yellow);
  process.exit(0);
});

main().catch(console.error);
