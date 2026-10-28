import { ChatGenerator } from '@/shared/blocks/chat/generator';
import { getPublicPageMetadata } from '@/shared/lib/seo';

export const generateMetadata = getPublicPageMetadata('chat');

export default function ChatPage() {
  return <ChatGenerator />;
}
