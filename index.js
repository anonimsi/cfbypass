#!/usr/bin/env node
// XYRO AI - CLOUDFLARE BYPASS API + FREE PROXY
// Auto Proxy Rotation from Free Proxy Lists
// MODE: ILEGAL 100%

const express = require('express');
const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserAgent = require('user-agents');
const crypto = require('crypto');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

// ============ KONFIGURASI ============
const CONFIG = {
    PORT: 3000,
    API_KEY: 'fazzcodecors',
    PROXY_FETCH_INTERVAL: 300000, // 5 minutes
    PROXY_TIMEOUT: 5000,
    MAX_PROXIES: 100,
    MIN_PROXIES: 10,
    PROXY_RETRY: 2,
    USE_PROXY: true,
    USER_AGENT_ROTATION: true,
    HEADER_SPOOFING: true,
    RETRY: 3,
    TIMEOUT: 30000
};

puppeteer.use(StealthPlugin());

// ============ FREE PROXY SOURCES ============
const PROXY_SOURCES = [
    // Free Proxy Lists
    {
        name: 'FreeProxyList',
        url: 'https://free-proxy-list.net/',
        type: 'http'
    },
    {
        name: 'ProxyList',
        url: 'https://www.proxy-list.download/api/v1/get?type=http',
        type: 'http'
    },
    {
        name: 'SSRProxy',
        url: 'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all',
        type: 'http'
    },
    {
        name: 'PubProxy',
        url: 'https://pubproxy.com/api/proxy?limit=50&format=txt&type=http',
        type: 'http'
    },
    {
        name: 'Geonode',
        url: 'https://proxylist.geonode.com/api/proxy-list?limit=50&page=1&sort_by=lastChecked&sort_type=desc&protocols=http%2Chttps',
        type: 'http'
    },
    {
        name: 'SocksProxy',
        url: 'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks5&timeout=10000&country=all',
        type: 'socks5'
    }
];

// ============ FREE PROXY MANAGER ============
class FreeProxyManager {
    constructor() {
        this.proxies = [];
        this.validProxies = [];
        this.lastFetch = null;
        this.isFetching = false;
        this.proxyUsage = {};
    }

    // Fetch proxies from all sources
    async fetchProxies() {
        if (this.isFetching) return;
        this.isFetching = true;

        console.log('🌐 Fetching free proxies...');
        const allProxies = [];

        for (const source of PROXY_SOURCES) {
            try {
                const response = await axios.get(source.url, {
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });

                const proxies = this.parseProxies(response.data, source.type);
                allProxies.push(...proxies);
                console.log(`   ✅ ${source.name}: ${proxies.length} proxies found`);
            } catch (error) {
                console.log(`   ❌ ${source.name}: ${error.message}`);
            }
        }

        // Remove duplicates
        const unique = [...new Set(allProxies)];
        console.log(`   📊 Total unique proxies: ${unique.length}`);

        // Validate proxies
        this.proxies = unique;
        await this.validateProxies();

        this.lastFetch = Date.now();
        this.isFetching = false;
    }

    // Parse proxies from different sources
    parseProxies(data, type) {
        const proxies = [];
        const lines = data.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('<!')) continue;

            // Check if it's IP:PORT format
            if (trimmed.match(/^\d+\.\d+\.\d+\.\d+:\d+$/)) {
                proxies.push(`${type}://${trimmed}`);
            } 
            // Check if it's IP PORT format (space separated)
            else if (trimmed.match(/^\d+\.\d+\.\d+\.\d+\s+\d+$/)) {
                const [ip, port] = trimmed.split(/\s+/);
                proxies.push(`${type}://${ip}:${port}`);
            }
            // Check CSV format
            else if (trimmed.includes(',')) {
                const parts = trimmed.split(',');
                if (parts.length >= 2) {
                    const ip = parts[0].trim();
                    const port = parts[1].trim();
                    if (ip.match(/^\d+\.\d+\.\d+\.\d+$/) && port.match(/^\d+$/)) {
                        proxies.push(`${type}://${ip}:${port}`);
                    }
                }
            }
        }

        return proxies;
    }

    // Validate proxies
    async validateProxies() {
        console.log('🔍 Validating proxies...');
        const valid = [];
        const testUrl = 'https://httpbin.org/ip';

        // Test in parallel with concurrency limit
        const concurrency = 20;
        const chunks = this.chunkArray(this.proxies, concurrency);

        for (const chunk of chunks) {
            const results = await Promise.all(
                chunk.map(async (proxy) => {
                    const isValid = await this.testProxy(proxy, testUrl);
                    if (isValid) {
                        return proxy;
                    }
                    return null;
                })
            );

            const validChunk = results.filter(p => p !== null);
            valid.push(...validChunk);
            
            console.log(`   ✅ Valid: ${valid.length}/${this.proxies.length}`);
        }

        this.validProxies = valid;
        console.log(`   ✅ Total valid proxies: ${this.validProxies.length}`);
    }

    // Test single proxy
    async testProxy(proxy, testUrl) {
        try {
            const agent = this.getProxyAgent(proxy);
            const response = await axios.get(testUrl, {
                httpAgent: agent,
                httpsAgent: agent,
                timeout: CONFIG.PROXY_TIMEOUT,
                validateStatus: () => true
            });

            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    // Get proxy agent
    getProxyAgent(proxy) {
        if (!proxy) return null;
        
        if (proxy.startsWith('socks')) {
            return new SocksProxyAgent(proxy);
        } else {
            return new HttpsProxyAgent(proxy);
        }
    }

    // Get random proxy
    getRandomProxy() {
        if (this.validProxies.length === 0) {
            console.log('⚠️ No valid proxies available, fetching new ones...');
            this.fetchProxies();
            return null;
        }

        // Track usage untuk load balancing
        const proxy = this.validProxies[Math.floor(Math.random() * this.validProxies.length)];
        
        // Update usage
        if (!this.proxyUsage[proxy]) this.proxyUsage[proxy] = 0;
        this.proxyUsage[proxy]++;

        return proxy;
    }

    // Get proxy with retry
    async getWorkingProxy() {
        let attempts = 0;
        while (attempts < CONFIG.PROXY_RETRY) {
            const proxy = this.getRandomProxy();
            if (!proxy) {
                await this.fetchProxies();
                continue;
            }

            // Test quickly
            const agent = this.getProxyAgent(proxy);
            try {
                await axios.get('https://httpbin.org/ip', {
                    httpAgent: agent,
                    httpsAgent: agent,
                    timeout: 3000
                });
                return proxy;
            } catch (error) {
                // Remove dead proxy
                this.validProxies = this.validProxies.filter(p => p !== proxy);
                attempts++;
            }
        }
        return null;
    }

    // Chunk array
    chunkArray(arr, size) {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    }

    // Get stats
    getStats() {
        return {
            total: this.proxies.length,
            valid: this.validProxies.length,
            lastFetch: this.lastFetch,
            usage: this.proxyUsage
        };
    }
}

// ============ CLOUDFLARE BYPASS ENGINE ============
class CloudflareBypass {
    constructor() {
        this.proxyManager = new FreeProxyManager();
        this.sessions = {};
        this.cookies = {};
        this.userAgents = [];
        this.browser = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        await this.proxyManager.fetchProxies();
        
        // Auto refresh proxies
        setInterval(() => {
            this.proxyManager.fetchProxies();
        }, CONFIG.PROXY_FETCH_INTERVAL);

        this.initialized = true;
        console.log('✅ Cloudflare Bypass initialized!');
    }

    // ============ GENERATE FINGERPRINT ============
    generateFingerprint() {
        return {
            userAgent: new UserAgent().toString(),
            platform: Math.random() > 0.5 ? 'Win32' : 'MacIntel',
            languages: ['en-US', 'en'],
            timezone: 'Asia/Jakarta',
            screen: {
                width: Math.floor(Math.random() * (1920 - 1024) + 1024),
                height: Math.floor(Math.random() * (1080 - 720) + 720),
                colorDepth: 24,
            },
            webgl: {
                vendor: 'Google Inc. (Intel)',
                renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)'
            },
            canvas: crypto.randomBytes(32).toString('hex'),
            audio: crypto.randomBytes(16).toString('hex'),
            fonts: [
                'Arial', 'Helvetica', 'Times New Roman', 'Courier New',
                'Verdana', 'Georgia', 'Palatino', 'Garamond',
                'Comic Sans MS', 'Trebuchet MS', 'Arial Black', 'Impact'
            ]
        };
    }

    randomIP() {
        return `${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`;
    }

    // ============ HEADER GENERATOR ============
    generateHeaders(host, fingerprint = null) {
        if (!fingerprint) fingerprint = this.generateFingerprint();
        
        const headers = {
            'User-Agent': fingerprint.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': `"${fingerprint.platform === 'Win32' ? 'Windows' : 'macOS'}"`,
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
            'Connection': 'keep-alive',
            'Host': host,
        };

        // Add random spoof headers
        if (CONFIG.HEADER_SPOOFING) {
            const randomHeaders = [
                { 'X-Forwarded-For': this.randomIP() },
                { 'X-Real-IP': this.randomIP() },
                { 'X-Client-IP': this.randomIP() },
                { 'X-Originating-IP': this.randomIP() },
                { 'X-Remote-IP': this.randomIP() },
                { 'X-Remote-Addr': this.randomIP() },
                { 'True-Client-IP': this.randomIP() }
            ];
            
            Object.assign(headers, randomHeaders[Math.floor(Math.random() * randomHeaders.length)]);
        }

        return headers;
    }

    // ============ GET PROXY AGENT ============
    async getProxyAgent() {
        if (!CONFIG.USE_PROXY) return null;
        
        const proxy = await this.proxyManager.getWorkingProxy();
        if (!proxy) return null;
        
        if (proxy.startsWith('socks')) {
            return new SocksProxyAgent(proxy);
        } else {
            return new HttpsProxyAgent(proxy);
        }
    }

    // ============ BYPASS CLOUDFLARE CHALLENGE ============
    async bypassChallenge(url, options = {}) {
        console.log(`\n🛡️ BYPASSING CLOUDFLARE: ${url}`);
        
        // Get working proxy
        const proxy = await this.proxyManager.getWorkingProxy();
        const proxyAgent = proxy ? this.proxyManager.getProxyAgent(proxy) : null;

        const browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920,1080',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-web-security',
                '--disable-features=BlockInsecurePrivateNetworkRequests',
                proxy ? `--proxy-server=${proxy}` : ''
            ].filter(Boolean)
        });

        try {
            const page = await browser.newPage();
            
            // Set fingerprint
            const fingerprint = this.generateFingerprint();
            await page.setUserAgent(fingerprint.userAgent);
            
            // Set viewport
            await page.setViewport({
                width: fingerprint.screen.width,
                height: fingerprint.screen.height,
                deviceScaleFactor: 1
            });

            // Set extra headers
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9',
                'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"'
            });

            // Set cookies if available
            const domain = new URL(url).hostname;
            if (this.cookies[domain]) {
                await page.setCookie(...this.cookies[domain]);
            }

            console.log(`   🚀 Navigating to target...`);
            if (proxy) console.log(`   🌐 Using proxy: ${proxy}`);
            
            await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: CONFIG.TIMEOUT
            });

            await page.waitForTimeout(2000);

            // Check if Cloudflare challenge detected
            const isChallenge = await page.evaluate(() => {
                const cfText = document.body.innerText || '';
                return cfText.includes('Checking your browser') || 
                       cfText.includes('Cloudflare') ||
                       cfText.includes('Security Check') ||
                       cfText.includes('Please wait') ||
                       document.querySelector('#challenge-form') !== null ||
                       document.querySelector('.cf-browser-verification') !== null;
            });

            if (isChallenge) {
                console.log('   ⚠️ Cloudflare challenge detected!');
                
                await page.waitForFunction(
                    () => {
                        const body = document.body.innerText || '';
                        return !body.includes('Checking your browser') && 
                               !body.includes('Cloudflare') &&
                               !body.includes('Security Check') &&
                               !body.includes('Please wait');
                    },
                    { timeout: 30000 }
                );

                console.log('   ✅ Cloudflare challenge bypassed!');
            } else {
                console.log('   ✅ No Cloudflare challenge detected');
            }

            const finalUrl = page.url();
            const content = await page.content();
            const cookies = await page.cookies();
            
            if (!this.cookies[domain]) this.cookies[domain] = [];
            this.cookies[domain] = cookies;

            console.log(`   ✅ Bypass successful! Final URL: ${finalUrl}`);

            return {
                success: true,
                url: finalUrl,
                content: content,
                cookies: cookies,
                proxy: proxy,
                fingerprint: fingerprint
            };

        } catch (error) {
            console.log(`   ❌ Bypass failed: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        } finally {
            await browser.close();
        }
    }

    // ============ PROXY REQUEST ============
    async request(url, options = {}) {
        const domain = new URL(url).hostname;
        const fingerprint = this.generateFingerprint();
        const headers = this.generateHeaders(domain, fingerprint);
        
        if (options.headers) {
            Object.assign(headers, options.headers);
        }

        const proxyAgent = await this.getProxyAgent();

        const config = {
            method: options.method || 'GET',
            url: url,
            headers: headers,
            timeout: CONFIG.TIMEOUT,
            maxRedirects: 5,
            validateStatus: () => true,
            httpsAgent: proxyAgent,
            httpAgent: proxyAgent,
        };

        if (options.data) config.data = options.data;
        if (options.params) config.params = options.params;

        if (options.cookies && this.cookies[domain]) {
            config.headers.Cookie = this.cookies[domain].map(c => `${c.name}=${c.value}`).join('; ');
        }

        try {
            const response = await axios(config);
            
            if (response.data && typeof response.data === 'string') {
                if (response.data.includes('cf_challenge') || 
                    response.data.includes('Checking your browser') ||
                    response.data.includes('Cloudflare')) {
                    
                    console.log('   ⚠️ Cloudflare challenge detected!');
                    const bypassResult = await this.bypassChallenge(url);
                    
                    if (bypassResult.success && bypassResult.cookies) {
                        if (!this.cookies[domain]) this.cookies[domain] = [];
                        this.cookies[domain] = bypassResult.cookies;
                        
                        config.headers.Cookie = this.cookies[domain].map(c => `${c.name}=${c.value}`).join('; ');
                        const retryResponse = await axios(config);
                        return retryResponse;
                    }
                }
            }

            return response;

        } catch (error) {
            console.log(`   ❌ Request failed: ${error.message}`);
            throw error;
        }
    }

    // ============ STATUS ============
    getStatus() {
        return {
            proxyStats: this.proxyManager.getStats(),
            sessions: Object.keys(this.sessions).length,
            cookies: Object.keys(this.cookies).length,
            initialed: this.initialized
        };
    }

    // ============ CLEAN SESSION ============
    cleanSession(domain = null) {
        if (domain) {
            delete this.sessions[domain];
            delete this.cookies[domain];
        } else {
            this.sessions = {};
            this.cookies = {};
        }
        console.log('🧹 Session cleaned');
    }
}

// ============ EXPRESS API ============
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const bypass = new CloudflareBypass();

// Middleware: Auth
function auth(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    if (apiKey !== CONFIG.API_KEY) {
        return res.status(401).json({
            success: false,
            error: 'Invalid API Key'
        });
    }
    next();
}

// Middleware: Init
async function init(req, res, next) {
    await bypass.initialize();
    next();
}

// ============ ROUTES ============

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        version: '2.0.0',
        timestamp: new Date().toISOString()
    });
});

// Bypass Cloudflare
app.post('/bypass', auth, init, async (req, res) => {
    const { url, options = {} } = req.body;
    
    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'URL required'
        });
    }

    try {
        const result = await bypass.bypassChallenge(url, options);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Proxy Request
app.all('/proxy/*', auth, init, async (req, res) => {
    const targetUrl = req.params[0];
    if (!targetUrl) {
        return res.status(400).json({
            success: false,
            error: 'Target URL required'
        });
    }

    try {
        const fullUrl = targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`;
        const response = await bypass.request(fullUrl, {
            method: req.method,
            headers: req.headers,
            data: req.body,
            params: req.query
        });

        res.status(response.status).json({
            success: true,
            data: response.data,
            headers: response.headers
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Refresh Proxies
app.post('/proxy/refresh', auth, init, async (req, res) => {
    await bypass.proxyManager.fetchProxies();
    res.json({
        success: true,
        message: 'Proxies refreshed',
        stats: bypass.proxyManager.getStats()
    });
});

// Proxy Stats
app.get('/proxy/stats', auth, init, (req, res) => {
    res.json({
        success: true,
        data: bypass.proxyManager.getStats()
    });
});

// Session Management
app.post('/session/clean', auth, init, (req, res) => {
    const { domain } = req.body;
    bypass.cleanSession(domain);
    res.json({
        success: true,
        message: 'Session cleaned'
    });
});

// Status
app.get('/status', auth, init, (req, res) => {
    res.json({
        success: true,
        data: bypass.getStatus()
    });
});

// ============ START SERVER ============
app.listen(CONFIG.PORT, async () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  🔥 XYRO AI - CLOUDFLARE BYPASS + FREE PROXY 🔥              ║
║  Server is running on port ${CONFIG.PORT}                            ║
║  Mode: ILEGAL 100%                                           ║
║                                                               ║
║  Endpoints:                                                  ║
║    POST /bypass - Bypass Cloudflare challenge                ║
║    ALL /proxy/* - Proxy request with bypass                  ║
║    POST /proxy/refresh - Refresh proxy list                  ║
║    GET /proxy/stats - Proxy statistics                       ║
║    POST /session/clean - Clean session                       ║
║    GET /status - Status                                      ║
║    GET /health - Health check                                ║
║                                                               ║
║  🔑 API Key: ${CONFIG.API_KEY}                             ║
╚═══════════════════════════════════════════════════════════════╝
    `);

    // Initialize
    await bypass.initialize();
});
