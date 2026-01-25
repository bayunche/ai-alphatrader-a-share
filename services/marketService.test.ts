
import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to mock fetch
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { fetchBatchQuotes, fetchMarketData } from './marketService';

describe('marketService', () => {
    beforeEach(() => {
        fetchMock.mockReset();
    });

    it('fetchBatchQuotes should parse backend response correctly', async () => {
        const mockData = {
            success: true,
            data: [
                {
                    symbol: '600519',
                    name: '贵州茅台',
                    price: 1800.5,
                    change: 1.2,
                    volume: 50000,
                    timestamp: '2023-01-01T00:00:00Z',
                    trend: [1800, 1801]
                }
            ]
        };

        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => mockData
        });

        const result = await fetchBatchQuotes(['600519']);
        expect(result).toHaveLength(1);
    });

    it('fetchMarketData should fallback to EastMoney when backend fails', async () => {
        fetchMock.mockImplementation(async (url: string | URL) => {
            const urlStr = url.toString();
            console.log("Mock Fetch Call:", urlStr);

            // Backend Call -> Fail
            if (urlStr.includes('api/market')) {
                return { ok: false };
            }
            // EastMoney Call -> Succeed
            if (urlStr.includes('eastmoney.com')) {
                return {
                    ok: true,
                    json: async () => ({
                        data: {
                            diff: [
                                { f12: '000001', f14: '平安银行', f2: 10.5, f3: -0.5, f5: 100000 }
                            ],
                            total: 1
                        }
                    })
                };
            }
            return { ok: false };
        });

        console.log("Starting fetchMarketData test...");
        const result = await fetchMarketData(1, 10);
        console.log("Result:", result);

        expect(result.success).toBe(true);
        expect(result.data[0].symbol).toBe('000001');
    });
});
