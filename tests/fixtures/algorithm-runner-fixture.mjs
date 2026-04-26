process.stdin.setEncoding('utf8');

let input = '';
for await (const chunk of process.stdin) {
  input += chunk;
  if (input.includes('\n')) break;
}

const request = JSON.parse(input.trim());
const fixture = request.payload?.fixture ?? request.payload?.metadata?.fixture;

function write(frame, newline = true) {
  process.stdout.write(`${JSON.stringify(frame)}${newline ? '\n' : ''}`);
}

function result(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: 'result',
    requestId: request.requestId,
    runId: request.runId,
    ok: true,
    ...overrides,
  };
}

if (fixture === 'timeout') {
  setTimeout(() => write(result()), 5000);
} else if (fixture === 'malformed') {
  process.stdout.write('not-json\n');
} else if (fixture === 'badSchema') {
  write({ ...result(), schemaVersion: 2 });
} else if (fixture === 'mismatchRequest') {
  write({ ...result(), requestId: 'other' });
} else if (fixture === 'nonzero') {
  process.stderr.write('private failure detail\n');
  process.exit(2);
} else if (fixture === 'partial') {
  const line = JSON.stringify(result());
  process.stdout.write(line.slice(0, Math.floor(line.length / 2)));
  setTimeout(() => {
    process.stdout.write(line.slice(Math.floor(line.length / 2)));
  }, 10);
} else if (request.command === 'start') {
  const accepted = {
    schemaVersion: 1,
    kind: 'accepted',
    requestId: request.requestId,
    runId: request.runId,
    externalRunHandle: 'fixture-run',
    sessionId: request.payload?.sessionId ?? null,
  };
  const terminal = result({ status: 'completed' });
  if (fixture === 'acceptedTerminalSameChunk') {
    process.stdout.write(`${JSON.stringify(accepted)}\n${JSON.stringify(terminal)}\n`);
  } else {
    write(accepted);
    if (fixture === 'acceptedOnly') {
      setTimeout(() => {}, 5000);
    } else {
      write({
        schemaVersion: 1,
        kind: 'event',
        runId: request.runId,
        event: { type: 'algorithm.run.started', payload: {} },
      });
      write(terminal);
    }
  }
} else {
  write(result());
}
