import { spawnSync } from 'node:child_process';

type RunOptions = {
  env?: NodeJS.ProcessEnv;
};

export type CommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

export function runScript(scriptPath: string, args: string[], options: RunOptions = {}): CommandResult {
  const result = spawnSync('bash', [scriptPath, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ...options.env,
    },
  });

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

export function runInstall(args: string[], options: RunOptions = {}): CommandResult {
  return runScript('scripts/deploy/install-vps.sh', args, options);
}

export function runProvision(args: string[], options: RunOptions = {}): CommandResult {
  return runScript('scripts/deploy/provision-vultr.sh', args, options);
}

