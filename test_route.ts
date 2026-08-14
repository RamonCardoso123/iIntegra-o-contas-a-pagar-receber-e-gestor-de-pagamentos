import { parseDDAFromOCR } from './src/lib/parsers/ocrParsers';
const mockText = 'GOMMA PNEUS 29.563.201/0001-89 28/07/2026 1.250,59';
const parsed = parseDDAFromOCR(mockText);
console.log(parsed);