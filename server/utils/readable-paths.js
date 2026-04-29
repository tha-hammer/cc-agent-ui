import os from 'os';
import path from 'path';

function withTrailingSeparator(value) {
  const resolved = path.resolve(value);
  return resolved.endsWith(path.sep) ? resolved : `${resolved}${path.sep}`;
}

export function getClaudeTaskOutputRoot(uid = typeof process.getuid === 'function' ? process.getuid() : os.userInfo().uid) {
  return path.join(os.tmpdir(), `claude-${uid}`);
}

export function isClaudeTaskOutputPath(filePath, uid) {
  const resolved = path.resolve(filePath);
  const taskRoot = withTrailingSeparator(getClaudeTaskOutputRoot(uid));
  return (
    resolved.startsWith(taskRoot) &&
    path.basename(path.dirname(resolved)) === 'tasks' &&
    path.basename(resolved).endsWith('.output')
  );
}

export function isReadableProjectPath(filePath, { projectRoot, homeDir = os.homedir(), uid } = {}) {
  const resolved = path.resolve(filePath);
  const roots = [
    projectRoot ? path.resolve(projectRoot) : '',
    path.join(homeDir, '.claude'),
  ].filter(Boolean);

  if (roots.some((root) => resolved === root || resolved.startsWith(withTrailingSeparator(root)))) {
    return true;
  }

  return isClaudeTaskOutputPath(resolved, uid);
}
