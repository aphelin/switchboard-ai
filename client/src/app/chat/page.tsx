import type { Metadata } from 'next';
import { ChatView } from '@/components/chat/chat-view';

export const metadata: Metadata = {
  title: 'Chat',
  description: 'A tool-using agent that searches your documents, cites its passages and asks before generating images.',
};

export default function ChatPage() {
  return <ChatView />;
}
