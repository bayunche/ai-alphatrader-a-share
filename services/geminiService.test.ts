
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Mock @google/genai BEFORE import
vi.mock('@google/genai', () => {
    return {
        GoogleGenAI: vi.fn(),
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
vi.stubGlobal('fetch', fetchMock);

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
            { cash: 1000, positions: [] } as any,
            { provider: 'OPENAI', modelName: 'test-model', apiEndpoint: 'http://test' }
        );

        expect(result.action).toBe(TradeAction.BUY);
        expect(result.confidence).toBe(0.9);
    });

    it('should handle JSON wrapped in markdown code blocks', async () => {
        const mockResponse = {
            choices: [{
                message: {
                    content: "```json\n" + JSON.stringify({
                        action: 'HOLD',
                        symbol: '600519',
                        confidence: 0.5,
                        suggestedQuantity: 0,
                        strategyName: 'Wait',
                        reasoning: 'Not clear'
                    }) + "\n```"
                }
            }]
        };

        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => mockResponse,
            text: async () => ""
        });

        const result = await analyzeMarket(
            { symbol: '600519', name: 'Moutai', price: 100, change: 0, volume: 0, trend: [] } as any,
            { cash: 1000, positions: [] } as any,
            { provider: 'OPENAI', modelName: 'test', apiEndpoint: 'http://test' }
        );

        expect(result.action).toBe(TradeAction.HOLD);
        expect(result.strategyName).toBe('Wait');
    });

    it('should return HOLD fallback on error', async () => {
        fetchMock.mockRejectedValue(new Error('Network error'));
        const result = await analyzeMarket(
            { symbol: '600519', name: 'Moutai', price: 100, change: 0, volume: 0, trend: [] } as any,
            { cash: 1000, positions: [] } as any,
            { provider: 'OPENAI', modelName: 'test', apiEndpoint: 'http://test' }
        );
        expect(result.action).toBe(TradeAction.HOLD);
        expect(result.reasoning).toContain('Network error');
    });
});
