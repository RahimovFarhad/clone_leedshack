export type Community = {
  id: string;
  name: string;
  members: number;
  rooms?: number;
  activeRooms?: number;
  theme?: string;
};

export type Room = {
  id: string;
  communityId: string;
  name: string;
  mode?: 'help' | 'offer' | 'group';
  tags?: string[];
  createdAt: string;
  participants: Array<{
    id: string;
    displayName: string;
    joinedAt: string;
  }>;
};

export type ChatMessage = {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
};

export type Screen =
  | 'community'
  | 'home'
  | 'intake'
  | 'matching'
  | 'room'
  | 'reveal'
  | 'feedback'
  | 'dashboard';

export type SessionData = {
  sessionId: string;
  selectedCommunityId: string;
  selectedCommunity: string;
  roomId: string;
  roomName: string;
  participantId: string;
  participantName: string;
  participantEmail: string;
  returnScreen: Screen;
  needText: string;
  module: string;
  urgency: string;
  matchTopic: string;
  similarity: number;
  userAnimal: string;
  peerAnimal: string;
  userRole: 'seeking' | 'helping';
  wasHelpful: boolean | null;
};
