
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Mock @google/genai BEFORE import
vi.mock('@google/genai', () => {
    return {
        GoogleGenAI: vi.fn().mockImplementation(() => ({
            models: {
                generateContent: vi.fn()
            }
        })),
        Type: {
            OBJECT: 'OBJECT',
            STRING: 'STRING',
            NUMBER: 'NUMBER'
        },
        Schema: {}
    };
});

// 2. Mock global fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

// 3. Import the service AFTER mocks
import { analyzeMarket } from './geminiService';
import { TradeAction } from '../types';

describe('geminiService', () => {
    beforeEach(() => {
        fetchMock.mockReset();
    });

    it('should parse valid JSON response correctly', async () => {
        const mockResponse = {
            choices: [{
                message: {
                    content: JSON.stringify({
                        action: 'BUY',
                        symbol: '600519',
                        confidence: 0.9,
                        suggestedQuantity: 50,
                        strategyName: 'Test Strategy',
                        reasoning: 'Good trend'
                    })
                }
            }]
        };

        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => mockResponse,
            text: async () => ""
        });

        const result = await analyzeMarket(
            { symbol: '600519', name: 'Moutai', price: 100, change: 1.5, volume: 1000, trend: [] } as any,
            { cash: 1000, positions: [], totalEquity: 1000, equityHistory: [] } as any,
            { provider: 'OPENAI', modelName: 'test-model', apiEndpoint: 'http://test' }
        );

        expect(result.action).toBe(TradeAction.BUY);
        expect(result.confidence).toBe(0.9);
    });

    it('should include history, volume, and portfolio context in prompt', async () => {
        const mockResponse = { choices: [{ message: { content: "{}" } }] };
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => mockResponse,
            text: async () => ""
        });

        const historyData = [
            { date: '2023-01-01', open: 10, close: 11, high: 12, low: 9, volume: 1000000, change_pct: 10 }
        ] as any;

        const position = {
            symbol: '600519',
            quantity: 100,
            averageCost: 80,
            marketValue: 10000,
            pnl: 2000,
            pnlPercentage: 25
        };

        const marketData = {
            symbol: '600519',
            name: 'Moutai',
            price: 100,
            change: 1.5,
            volume: 5000000,
            trend: [99, 100]
        } as any;

        await analyzeMarket(
            marketData,
            { cash: 1000, totalEquity: 20000, positions: [position], equityHistory: [] } as any,
            { provider: 'OPENAI', modelName: 'test', apiEndpoint: 'http://test' },
            'en',
            historyData
        );

        // Verify the prompt sent to fetch
        const callArgs = fetchMock.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        const prompt = body.messages[1].content;

        // Check for new context fields
        expect(prompt).toContain('RECENT HISTORY (Last 5 Days)');
        expect(prompt).toContain('Date:2023-01-01 Close:11 Vol:100w Pct:10%'); // History check
        // 5000000 / 100 = 50000
        expect(prompt).toContain('Volume: 50000 lots'); // Volume check
        expect(prompt).toContain('Average Cost: ¥80.00'); // Portfolio Cost check
        expect(prompt).toContain('Unrealized PnL: 25.00%'); // Portfolio PnL check
    });
});
