// bot.js
require('colors');
const WebSocket = require('ws');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');

class Bot {
  constructor(config) {
    this.config = config;
    this.reconnectAttempts = new Map();
    this.MAX_RECONNECT_ATTEMPTS = 5;
    this.INITIAL_RETRY_DELAY = 5000;
  }

  async getProxyIP(proxy) {
    const agent = proxy.startsWith('http')
      ? new HttpsProxyAgent(proxy)
      : new SocksProxyAgent(proxy);
    try {
      const response = await axios.get(this.config.ipCheckURL, {
        httpsAgent: agent,
        timeout: 10000
      });
      console.log(`Connected through proxy ${proxy}`.green);
      return response.data;
    } catch (error) {
      console.error(`Skipping proxy ${proxy} due to connection error: ${error.message}`.yellow);
      return null;
    }
  }

  async connectToProxy(proxy, userID) {
    const formattedProxy = proxy.startsWith('socks5://') || proxy.startsWith('http')
      ? proxy
      : `socks5://${proxy}`;
      
    const attempts = this.reconnectAttempts.get(proxy) || 0;
    if (attempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.log(`Max reconnection attempts (${this.MAX_RECONNECT_ATTEMPTS}) reached for ${proxy}. Stopping.`.red);
      return;
    }

    const proxyInfo = await this.getProxyIP(formattedProxy);
    if (!proxyInfo) return;

    try {
      const ws = await this.createWebSocket(formattedProxy);
      this.setupWebSocketHandlers(ws, userID, proxy, proxyInfo);
    } catch (error) {
      console.error(`Failed to connect with proxy ${proxy}: ${error.message}`.red);
      this.handleReconnect(proxy, userID);
    }
  }

  async connectDirectly(userID) {
    try {
      const ws = await this.createWebSocket();
      this.setupWebSocketHandlers(ws, userID, 'direct', { ip: 'Direct IP' });
    } catch (error) {
      console.error(`Failed to connect directly: ${error.message}`.red);
      this.handleReconnect('direct', userID);
    }
  }

  createWebSocket(proxy = null) {
    const wsURL = `wss://${this.config.wssHost}`;
    const options = {
      headers: this.getHeaders(),
      handshakeTimeout: 10000,
    };

    if (proxy) {
      options.agent = proxy.startsWith('http')
        ? new HttpsProxyAgent(proxy)
        : new SocksProxyAgent(proxy);
    }

    return new WebSocket(wsURL, options);
  }

  setupWebSocketHandlers(ws, userID, proxy, proxyInfo) {
    let pingInterval;
    let missedPongs = 0;
    const MAX_MISSED_PONGS = 3;

    ws.on('open', () => {
      console.log(`Connected to ${proxy}`.cyan);
      console.log(`Proxy IP Info: ${JSON.stringify(proxyInfo)}`.magenta);
      
      this.reconnectAttempts.set(proxy, 0);
      
      pingInterval = this.startHeartbeat(ws, proxyInfo.ip, () => {
        missedPongs++;
        if (missedPongs >= MAX_MISSED_PONGS) {
          console.log(`Too many missed PONGs (${MAX_MISSED_PONGS}). Reconnecting...`.yellow);
          ws.terminate();
        }
      });
    });

    ws.on('message', (message) => {
      try {
        const msg = JSON.parse(message);
        console.log(`Received message: ${JSON.stringify(msg)}`.blue);

        if (msg.action === 'AUTH') {
          this.handleAuth(ws, msg, userID);
        } else if (msg.action === 'PONG') {
          missedPongs = 0;
          console.log(`Received PONG: ${JSON.stringify(msg)}`.blue);
        }
      } catch (error) {
        console.error(`Failed to parse message: ${error.message}`.red);
      }
    });

    ws.on('close', (code, reason) => {
      clearInterval(pingInterval);
      console.log(`WebSocket closed with code: ${code}, reason: ${reason}`.yellow);
      this.handleReconnect(proxy, userID);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error on proxy ${proxy}: ${error.message}`.red);
      clearInterval(pingInterval);
      ws.terminate();
    });

    ws.on('ping', () => ws.pong());
  }

  handleAuth(ws, msg, userID) {
    const authResponse = {
      id: msg.id,
      origin_action: 'AUTH',
      result: {
        browser_id: uuidv4(),
        user_id: userID,
        user_agent: 'Mozilla/5.0',
        timestamp: Math.floor(Date.now() / 1000),
        device_type: 'desktop',
        version: '4.28.2',
      }
    };
    
    try {
      ws.send(JSON.stringify(authResponse));
      console.log(`Sent auth response: ${JSON.stringify(authResponse)}`.green);
    } catch (error) {
      console.error(`Failed to send auth response: ${error.message}`.red);
    }
  }

  startHeartbeat(ws, proxyIP, onMissedPong) {
    return setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          const pingMessage = {
            id: uuidv4(),
            version: '1.0.0',
            action: 'PING',
            data: {}
          };
          ws.send(JSON.stringify(pingMessage));
          console.log(`Sent ping - IP: ${proxyIP}`.cyan);
          onMissedPong();
        } catch (error) {
          console.error(`Failed to send ping: ${error.message}`.red);
          ws.terminate();
        }
      }
    }, 26000);
  }

  handleReconnect(proxy, userID) {
    const attempts = (this.reconnectAttempts.get(proxy) || 0) + 1;
    this.reconnectAttempts.set(proxy, attempts);

    const delay = this.INITIAL_RETRY_DELAY * Math.pow(2, attempts - 1);
    console.log(`Attempting to reconnect to ${proxy} in ${delay/1000}s (Attempt ${attempts}/${this.MAX_RECONNECT_ATTEMPTS})`.yellow);

    setTimeout(() => {
      if (proxy === 'direct') {
        this.connectDirectly(userID);
      } else {
        this.connectToProxy(proxy, userID);
      }
    }, delay);
  }

  getHeaders() {
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:92.0) Gecko/20100101 Firefox/92.0',
      'Pragma': 'no-cache',
      'Accept-Language': 'uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
      'OS': 'Windows',
      'Platform': 'Desktop',
      'Browser': 'Mozilla'
    };
  }
}

module.exports = Bot;
