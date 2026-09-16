/** Product identity and the session's window list. */
export const SITE_NAME = 'Switchboard AI';
export const SESSION_LABEL = 'switchboard-ai';
export const MCP_SERVER_NAME = 'switchboard-ai';
export const SITE_DESCRIPTION =
  'An AI workbench that traces and prices every model call and asks before the agent spends. It queues image and text generation, indexes your documents for retrieval, runs a tool-using chat agent with human approval, and exposes the same tools over MCP.';
export const REPO_URL = 'https://github.com/bernikson/mini-ai-toolkit';

export interface SessionWindow {
  /** The key that switches to this window. */
  key: string;
  href: string;
  label: string;
}

export const WINDOWS: SessionWindow[] = [
  { key: '0', href: '/', label: 'generate' },
  { key: '1', href: '/gallery', label: 'gallery' },
  { key: '2', href: '/history', label: 'history' },
  { key: '3', href: '/documents', label: 'documents' },
  { key: '4', href: '/chat', label: 'chat' },
  { key: '5', href: '/traces', label: 'traces' },
];

export const WELCOME_PATH = '/welcome';
