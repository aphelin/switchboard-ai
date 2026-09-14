import type { Metadata } from 'next';
import { ChatView } from '@/components/chat/chat-view';

export const metadata: Metadata = {
  title: 'Chat',
  description:
    'Chat with an assistant that searches your documents, cites its sources and generates images with your approval.',
  openGraph: {
    title: 'Chat | Mini AI Toolkit',
    description:
      'Chat with an assistant that searches your documents, cites its sources and generates images with your approval.',
  },
};

export default function ChatPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Chat</h1>
        <p className="text-sm text-muted-foreground">
          A tool-using assistant: it searches the knowledge base, cites passages,
          and asks before generating images.
        </p>
      </div>
      <ChatView />
    </div>
  );
}
