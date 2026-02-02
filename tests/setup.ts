import { jest } from '@jest/globals';

// Suppress console output during tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});
jest.spyOn(console, 'info').mockImplementation(() => {});
jest.spyOn(console, 'debug').mockImplementation(() => {});

// Suppress stdout/stderr writes (for winston and other libraries that write directly)
jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

process.env.SILENT = 'true';
