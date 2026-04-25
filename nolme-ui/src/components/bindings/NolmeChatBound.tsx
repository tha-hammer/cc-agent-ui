import { useCcuSession } from '../../hooks/useCcuSession';
import { NolmeChat } from '../NolmeChat';

export function NolmeChatBound() {
  const binding = useCcuSession();
  if (!binding) return null;
  return <NolmeChat threadId={binding.sessionId} projectName={binding.projectName} />;
}
