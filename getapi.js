import express from "express";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import fetch from 'node-fetch';
import https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载环境变量
dotenv.config();

const app = express();

// 创建自定义的 HTTPS agent，设置更长的超时时间
const httpsAgent = new https.Agent({
    timeout: 30000, // 30 秒超时
    keepAlive: true
});

// 创建代理 agent
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || 'http://127.0.0.1:26001'; // 系统代理端口
const proxyAgent = new HttpsProxyAgent(proxyUrl);

// 添加错误处理中间件
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// 设置静态文件服务
app.use(express.static(__dirname));

// 添加CORS支持
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
});

// 重试函数
async function fetchWithRetry(url, options, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            console.log(`尝试连接 OpenAI API (第 ${i + 1} 次尝试)...`);
            console.log('使用代理:', proxyUrl);
            const response = await fetch(url, { 
                ...options, 
                agent: proxyAgent,
                timeout: 30000 // 30 秒超时
            });
            return response;
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            console.log(`尝试失败，等待重试... (${error.message})`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒后重试
        }
    }
}

// An endpoint which would work with the client code above - it returns
// the contents of a REST API request to this protected endpoint
app.get("/session", async (req, res) => {
    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key is not set');
        }

        console.log('使用的 API 密钥:', process.env.OPENAI_API_KEY.substring(0, 10) + '...');
        console.log('尝试创建 OpenAI 会话...');
        
        // 使用重试机制的 fetch
        const r = await fetchWithRetry("https://api.openai.com/v1/realtime/sessions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-realtime-preview-2024-12-17",
                voice: "verse",
            }),
        });

        const responseText = await r.text();
        console.log('OpenAI API 响应:', responseText);

        if (!r.ok) {
            throw new Error(`OpenAI API 返回 ${r.status}: ${responseText}`);
        }

        const data = JSON.parse(responseText);
        console.log('会话创建成功');
        res.json(data);
    } catch (error) {
        console.error('会话创建错误:', error);
        res.status(500).json({
            error: error.message,
            details: error.stack
        });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`服务器运行在端口 ${port}`);
    console.log('OpenAI API 密钥:', process.env.OPENAI_API_KEY ? '已设置' : '未设置');
    console.log('使用代理:', proxyUrl);
});