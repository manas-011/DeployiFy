
import express from 'express'
import httpProxy from 'http-proxy' 

const app = express()
const PORT = 8000

// s3 bucket base-path
const BASE_PATH = '' 

const proxy = httpProxy.createProxy()

app.use((req, res) => {
    const hostname = req.hostname;
    const subdomain = hostname.split('.')[0];

    const resolvesTo = `${BASE_PATH}/${subdomain}`

    return proxy.web(req, res, { target: resolvesTo, changeOrigin: true })
})

proxy.on('proxyReq', (proxyReq, req, res) => {
    const url = req.url;
    if (url === '/')
        proxyReq.path += 'index.html'
})

app.listen(PORT, () => console.log(`Proxy Running On Port...${PORT}`))
