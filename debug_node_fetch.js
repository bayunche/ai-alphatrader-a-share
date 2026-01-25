
const parseDoubleSafe = (val) => {
    if (val === '-' || val === null || val === undefined || val === '') return 0;
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
};

const buildBrowserHeaders = (referer = 'https://quote.eastmoney.com/') => ({
    //   'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Referer': referer,
    //   'Sec-Ch-Ua': '"Chromium";v="123", "Not:A-Brand";v="8"',
    //   'Sec-Ch-Ua-Mobile': '?0',
    //   'Sec-Ch-Ua-Platform': '"Windows"',
});

const fetchEastMoneyPage = async (page, pageSize) => {
    const fs = 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23';
    const fields = 'f12,f13,f14,f2,f3,f4,f5,f6,f15,f16,f17,f18,f20,f21,f9,f23';
    const fid = 'f3';
    const headers = buildBrowserHeaders('https://quote.eastmoney.com/');

    const baseUrls = [
        'https://push2.eastmoney.com',
        'http://80.push2.eastmoney.com',
        'http://64.push2.eastmoney.com',
        'http://82.push2.eastmoney.com',
    ];

    let lastError = null;
    for (const base of baseUrls) {
        const targetUrl = `${base}/api/qt/clist/get?pn=${page}&pz=${pageSize}&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=${fid}&fs=${encodeURIComponent(fs)}&fields=${encodeURIComponent(fields)}`;
        console.log(`Trying ${targetUrl}...`);
        try {
            const resp = await fetch(targetUrl, { headers });
            if (!resp.ok) {
                console.log(`Failed: ${resp.status}`);
                lastError = new Error(`eastmoney ${resp.status}`);
                continue;
            }
            const data = await resp.json();
            console.log('Success! Data sample:', JSON.stringify(data).slice(0, 100));
            return data;
        } catch (e) {
            console.log(`Error: ${e.message}`);
            lastError = e;
            continue;
        }
    }
    throw lastError || new Error('eastmoney fetch failed');
};

fetchEastMoneyPage(1, 10).catch(err => console.error("Final Error:", err));
