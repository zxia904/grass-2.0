require('colors');
const axios = require('axios');
const fs = require('fs');

const PROXY_SOURCES = {
  '服务器 1': 'https://files.ramanode.top/airdrop/grass/server_1.txt',
  '服务器 2': 'https://files.ramanode.top/airdrop/grass/server_2.txt',
};

async function fetchProxies(url) {
  try {
    const response = await axios.get(url);
    console.log(`\n已从 ${url} 获取代理`.green);
    return response.data.split('\n').filter(Boolean);
  } catch (error) {
    console.error(`从 ${url} 获取代理失败: ${error.message}`.red);
    return [];
  }
}

async function readLines(filename) {
  try {
    const data = await fs.promises.readFile(filename, 'utf-8');
    console.log(`已加载 ${filename} 文件数据`.green);
    return data.split('\n').filter(Boolean);
  } catch (error) {
    console.error(`读取 ${filename} 失败: ${error.message}`.red);
    return [];
  }
}

async function selectProxySource(inquirer) {
  const choices = [
    ...Object.keys(PROXY_SOURCES),
    '自定义代理文件',
    '不使用代理'
  ];
  
  const { source } = await inquirer.prompt([
    {
      type: 'list',
      name: 'source',
      message: '请选择代理来源:'.cyan,
      choices,
    },
  ]);

  if (source === '自定义代理文件') {
    const { filename } = await inquirer.prompt([
      {
        type: 'input',
        name: 'filename',
        message: '请输入代理文件路径:'.cyan,
        default: 'proxy.txt',
      },
    ]);
    return { type: 'file', source: filename };
  } else if (source === '不使用代理') {
    return { type: 'none' };
  }

  return { type: 'url', source: PROXY_SOURCES[source] };
}

module.exports = { fetchProxies, readLines, selectProxySource };
