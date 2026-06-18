import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CliProgressReporter } from '../../src/services/cliProgressReporter.js';

describe('CliProgressReporter (plain-line, no live bar)', () => {
  let writes: string[];
  let out: { write: (s: string) => boolean };
  let reporter: CliProgressReporter;

  beforeEach(() => {
    writes = [];
    out = { write: (s: string) => { writes.push(s); return true; } };
    reporter = new CliProgressReporter({ out });
  });

  const written = () => writes.join('');

  it('prints the label as a newline-terminated line on start', () => {
    reporter.start(20, 'Cleaning transcripts (batch)');
    expect(written()).toBe('Cleaning transcripts (batch)\n');
  });

  it('writes nothing on start when no label is given', () => {
    reporter.start(20);
    expect(writes).toEqual([]);
  });

  it('prints a newline-terminated line on updateMessage', () => {
    reporter.start(20, 'Cleaning transcripts (batch)');
    writes.length = 0;

    reporter.updateMessage("Batch 'cleaning' in_progress: 5/20 done");

    expect(written()).toBe("Batch 'cleaning' in_progress: 5/20 done\n");
  });

  it('omits a redundant count suffix before any increment (batch mode)', () => {
    reporter.start(20, 'Cleaning transcripts (batch)');
    writes.length = 0;

    reporter.updateMessage("Batch 'cleaning' in_progress: 12/20 done");

    expect(written()).not.toContain('(0/20)');
  });

  it('appends a count suffix once increments have occurred (sync mode)', () => {
    reporter.start(20, 'Cleaning');
    reporter.increment();
    reporter.increment();
    writes.length = 0;

    reporter.updateMessage("Cleaning 'parte-03.txt'");

    expect(written()).toBe("Cleaning 'parte-03.txt' (3/20)\n");
  });

  it('does not emit on increment alone', () => {
    reporter.start(20, 'Cleaning');
    writes.length = 0;
    reporter.increment();
    expect(writes).toEqual([]);
  });

  it('never writes a live progress bar (no carriage-return redraw)', () => {
    reporter.start(20, 'X');
    reporter.increment();
    reporter.updateMessage('msg');
    reporter.stop();
    expect(written()).not.toContain('\r');
    expect(written()).not.toContain('░');
    expect(written()).not.toContain('█');
  });

  it('start/increment/updateMessage/stop never throw', () => {
    expect(() => {
      reporter.start(0);
      reporter.increment();
      reporter.updateMessage('x');
      reporter.stop();
    }).not.toThrow();
  });

  it('defaults to process.stdout when no out is provided', () => {
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      const r = new CliProgressReporter();
      r.start(3, 'Header');
      const seen = spy.mock.calls.map((c) => String(c[0])).join('');
      expect(seen).toContain('Header');
    } finally {
      spy.mockRestore();
    }
  });
});
