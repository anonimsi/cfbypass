// XYRO AI - CLOUDFLARE BYPASS + FREE PROXY (FIXED EXPORT)
// Fixed: Serverless compatible (Vercel, AWS Lambda, etc)
// MODE: ILEGAL 100%

const express = require('express');
const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserAgent = require('user-agents');
const crypto = require('crypto');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

// ============ CONFIG ============
const CONFIG = {
    PORT: process.env.PORT || 3000,
    PROXY_FETCH_INTERVAL: 300000,
    PROXY_TIMEOUT: 5000,
    TIMEOUT: 30000
};

puppeteer.use(StealthPlugin());

// ============ PROXY SOURCES ============
const PROXY_SOURCES = [
    { url: 'https://free-proxy-list.net/', type: 'http' },
    { url: 'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all', type: 'http' },
    { url: 'https://pubproxy.com/api/proxy?limit=50&format=txt&type=http', type: 'http' },
    { url: 'https://proxylist.geonode.com/api/proxy-list?limit=50&page=1&sort_by=lastChecked&sort_type=desc&protocols=http%2Chttps', type: 'http' },
    { url: 'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks5&timeout=10000&country=all', type: 'socks5' }
];

// ============ PROXY MANAGER ============
class ProxyManager {
    constructor() {
        this.proxies = [];
        this.validProxies = [];
        this.isFetching = false;
    }

    async fetchProxies() {
        if (this.isFetching) return;
        this.isFetching = true;

        const allProxies = [];
        for (const source of PROXY_SOURCES) {
            try {
                const res = await axios.get(source.url, { timeout: 10000 });
                const parsed = this.parseProxies(res.data, source.type);
                allProxies.push(...parsed);
            } catch (e) {}
        }

        this.proxies = [...new Set(allProxies)];
        await this.validateProxies();
        this.isFetching = false;
    }

    parseProxies(data, type) {
        const proxies = [];
        const lines = data.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('<!')) continue;
            
            if (trimmed.match(/^\d+\.\d+\.\d+\.\d+:\d+$/)) {
                proxies.push(`${type}://${trimmed}`);
            } else if (trimmed.match(/^\d+\.\d+\.\d+\.\d+\s+\d+$/)) {
                const [ip, port] = trimmed.split(/\s+/);
                proxies.push(`${type}://${ip}:${port}`);
            }
        }
        return proxies;
    }

    async validateProxies() {
        const valid = [];
        const concurrency = 20;
        const chunks = this.chunkArray(this.proxies, concurrency);

        for (const chunk of chunks) {
            const results = await Promise.all(
                chunk.map(async (proxy) => {
                    try {
                        const agent = this.getAgent(proxy);
                        const res = await axios.get('https://httpbin.org/ip', {
                            httpAgent: agent,
                            httpsAgent: agent,
                            timeout: CONFIG.PROXY_TIMEOUT
                        });
                        return res.status === 200 ? proxy : null;
                    } catch (e) {
                        return null;
                    }
                })
            );
            valid.push(...results.filter(p => p !== null));
        }

        this.validProxies = valid;
    }

    getAgent(proxy) {
        if (!proxy) return null;
        return proxy.startsWith('socks') ? new SocksProxyAgent(proxy) : new HttpsProxyAgent(proxy);
    }

    getRandomProxy() {
        if (this.validProxies.length === 0) {
            this.fetchProxies();
            return null;
        }
        return this.validProxies[Math.floor(Math.random() * this.validProxies.length)];
    }

    async getWorkingProxy() {
        let attempts = 0;
        while (attempts < 3) {
            const proxy = this.getRandomProxy();
            if (!proxy) break;
            
            try {
                const agent = this.getAgent(proxy);
                await axios.get('https://httpbin.org/ip', {
                    httpAgent: agent,
                    httpsAgent: agent,
                    timeout: 3000
                });
                return proxy;
            } catch (e) {
                this.validProxies = this.validProxies.filter(p => p !== proxy);
                attempts++;
            }
        }
        return null;
    }

    chunkArray(arr, size) {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    }

    getStats() {
        return {
            total: this.proxies.length,
            valid: this.validProxies.length
        };
    }
}

// ============ CLOUDFLARE BYPASS ============
class CloudflareBypass {
    constructor() {
        this.proxyManager = new ProxyManager();
        this.cookies = {};
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        await this.proxyManager.fetchProxies();
        setInterval(() => this.proxyManager.fetchProxies(), CONFIG.PROXY_FETCH_INTERVAL);
        this.initialized = true;
    }

    fingerprint() {
        const ua = new UserAgent().toString();
        return {
            userAgent: ua,
            platform: Math.random() > 0.5 ? 'Win32' : 'MacIntel',
            screen: {
                width: Math.floor(Math.random() * (1920 - 1024) + 1024),
                height: Math.floor(Math.random() * (1080 - 720) + 720)
            },
            canvas: crypto.randomBytes(32).toString('hex')
        };
    }

    randomIP() {
        return `${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`;
    }

    headers(host, fp = null) {
        if (!fp) fp = this.fingerprint();
        return {
            'User-Agent': fp.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': `"${fp.platform === 'Win32' ? 'Windows' : 'macOS'}"`,
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Upgrade-Insecure-Requests': '1',
            'Host': host,
            'X-Forwarded-For': this.randomIP(),
            'X-Real-IP': this.randomIP()
        };
    }

    async bypass(url) {
        const proxy = await this.proxyManager.getWorkingProxy();
        const agent = proxy ? this.proxyManager.getAgent(proxy) : null;

        const browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--window-size=1920,1080',
                '--disable-blink-features=AutomationControlled',
                proxy ? `--proxy-server=${proxy}` : ''
            ].filter(Boolean)
        });

        try {
            const page = await browser.newPage();
            const fp = this.fingerprint();
            await page.setUserAgent(fp.userAgent);
            await page.setViewport({ width: fp.screen.width, height: fp.screen.height });

            const domain = new URL(url).hostname;
            if (this.cookies[domain]) {
                await page.setCookie(...this.cookies[domain]);
            }

            await page.goto(url, { waitUntil: 'networkidle2', timeout: CONFIG.TIMEOUT });
            await page.waitForTimeout(2000);

            const isChallenge = await page.evaluate(() => {
                const text = document.body.innerText || '';
                return text.includes('Checking your browser') || 
                       text.includes('Cloudflare') ||
                       text.includes('Security Check') ||
                       document.querySelector('#challenge-form') !== null;
            });

            if (isChallenge) {
                await page.waitForFunction(
                    () => {
                        const text = document.body.innerText || '';
                        return !text.includes('Checking your browser') && 
                               !text.includes('Cloudflare') &&
                               !text.includes('Security Check');
                    },
                    { timeout: 30000 }
                );
            }

            const finalUrl = page.url();
            const content = await page.content();
            const cookies = await page.cookies();

            if (!this.cookies[domain]) this.cookies[domain] = [];
            this.cookies[domain] = cookies;

            return {
                success: true,
                url: finalUrl,
                content: content,
                cookies: cookies,
                proxy: proxy
            };

        } catch (e) {
            return { success: false, error: e.message };
        } finally {
            await browser.close();
        }
    }

    async request(url, options = {}) {
        const domain = new URL(url).hostname;
        const fp = this.fingerprint();
        const headers = this.headers(domain, fp);

        if (options.headers) Object.assign(headers, options.headers);

        const proxy = await this.proxyManager.getWorkingProxy();
        const agent = proxy ? this.proxyManager.getAgent(proxy) : null;

        const config = {
            method: options.method || 'GET',
            url: url,
            headers: headers,
            timeout: CONFIG.TIMEOUT,
            maxRedirects: 5,
            validateStatus: () => true,
            httpsAgent: agent,
            httpAgent: agent
        };

        if (options.data) config.data = options.data;
        if (options.params) config.params = options.params;

        if (options.cookies && this.cookies[domain]) {
            config.headers.Cookie = this.cookies[domain].map(c => `${c.name}=${c.value}`).join('; ');
        }

        try {
            const res = await axios(config);
            
            if (res.data && typeof res.data === 'string' && 
                (res.data.includes('cf_challenge') || res.data.includes('Checking your browser'))) {
                
                const bypassResult = await this.bypass(url);
                if (bypassResult.success && bypassResult.cookies) {
                    if (!this.cookies[domain]) this.cookies[domain] = [];
                    this.cookies[domain] = bypassResult.cookies;
                    
                    config.headers.Cookie = this.cookies[domain].map(c => `${c.name}=${c.value}`).join('; ');
                    return await axios(config);
                }
            }
            return res;
        } catch (e) {
            throw e;
        }
    }

    getStatus() {
        return {
            proxyStats: this.proxyManager.getStats(),
            cookies: Object.keys(this.cookies).length,
            initialized: this.initialized
        };
    }

    cleanSession(domain = null) {
        if (domain) {
            delete this.cookies[domain];
        } else {
            this.cookies = {};
        }
    }
}

// ============ EXPRESS APP ============
const app = express();
app.use(express.json());

const bypass = new CloudflareBypass();

// Init middleware
const init = async (req, res, next) => {
    await bypass.init();
    next();
};

// ============ ROUTES ============

app.get('/health', (req, res) => {
    res.json({ status: 'online', version: '2.0.0' });
});

app.post('/bypass', init, async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'URL required' });
    
    const result = await bypass.bypass(url);
    res.json(result);
});

app.all('/proxy/*', init, async (req, res) => {
    const targetUrl = req.params[0];
    if (!targetUrl) return res.status(400).json({ success: false, error: 'Target URL required' });

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
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/proxy/refresh', init, async (req, res) => {
    await bypass.proxyManager.fetchProxies();
    res.json({ success: true, stats: bypass.proxyManager.getStats() });
});

app.get('/proxy/stats', init, (req, res) => {
    res.json({ success: true, data: bypass.proxyManager.getStats() });
});

app.post('/session/clean', init, (req, res) => {
    bypass.cleanSession(req.body.domain);
    res.json({ success: true });
});

app.get('/status', init, (req, res) => {
    res.json({ success: true, data: bypass.getStatus() });
});

// ============ EXPORT FOR VERCEL/AWS LAMBDA ============
// FIX: Export app as default export (serverless compatible)
if (process.env.VERCEL || process.env.AWS_LAMBDA) {
    // For Vercel/AWS Lambda
    module.exports = app;
} else {
    // For local server
    const server = app.listen(CONFIG.PORT, async () => {
        await bypass.init();
        console.log(`🔥 Server running on port ${CONFIG.PORT}`);
    });
    module.exports = { app, server, bypass };
}

// ============ FOR VERCEL ============
// Also export as handler for Vercel
const serverless = require('serverless-http');
if (process.env.VERCEL) {
    module.exports = serverless(app);
}
