import React, { useState } from 'react';
import { Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL, requestJson } from '../lib/api';
import { ChatMessage, Screen, SessionData } from '../types';

type RoomScreenProps = {
  navigate: (screen: Screen) => void;
  sessionData: SessionData;
  setSessionData: React.Dispatch<React.SetStateAction<SessionData>>;
};

const RoomScreen = ({ navigate, sessionData, setSessionData }: RoomScreenProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [sendError, setSendError] = useState('');
  const socketRef = React.useRef<WebSocket | null>(null);
  const wsBaseUrl = API_BASE_URL.startsWith('https')
    ? API_BASE_URL.replace('https', 'wss')
    : API_BASE_URL.replace('http', 'ws');

  React.useEffect(() => {
    if (!sessionData.roomId || !sessionData.participantId) {
      return;
    }

    const socket = new WebSocket(`${wsBaseUrl}/ws`);
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: 'join_room',
          roomId: sessionData.roomId,
          participantId: sessionData.participantId,
          displayName: sessionData.participantName || 'Guest',
        })
      );
    };

    socket.onmessage = event => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'room_history' && payload.roomId === sessionData.roomId) {
          setMessages(payload.messages || []);
          return;
        }
        if (payload.type === 'chat_message' && payload.message?.roomId === sessionData.roomId) {
          setMessages(prev => [...prev, payload.message]);
        }
      } catch (error) {
        // Ignore invalid websocket payloads
      }
    };

    socket.onerror = () => {
      setSendError('Chat connection error.');
    };

    return () => {
      try {
        socket.send(
          JSON.stringify({
            type: 'leave_room',
            roomId: sessionData.roomId,
            participantId: sessionData.participantId,
          })
        );
      } catch (error) {
        // Ignore websocket close errors
      }
      socket.close();
      socketRef.current = null;
    };
  }, [sessionData.roomId, sessionData.participantId, sessionData.participantName, wsBaseUrl]);

  React.useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    const handlePageExit = () => {
      if (!sessionData.roomId || !sessionData.participantId) {
        return;
      }

      try {
        fetch(`${API_BASE_URL}/rooms/${sessionData.roomId}/leave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participantId: sessionData.participantId }),
          keepalive: true,
        });
      } catch (error) {
        // Best-effort on page exit
      }
    };

    window.addEventListener('beforeunload', handlePageExit);
    window.addEventListener('pagehide', handlePageExit);

    return () => {
      window.removeEventListener('beforeunload', handlePageExit);
      window.removeEventListener('pagehide', handlePageExit);
    };
  }, [sessionData.roomId, sessionData.participantId]);

  const sendMessage = () => {
    const trimmed = inputText.trim();
    if (!trimmed) {
      return;
    }

    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setSendError('Chat not connected.');
      return;
    }

    setSendError('');
    socketRef.current.send(
      JSON.stringify({
        type: 'chat_message',
        roomId: sessionData.roomId,
        text: trimmed,
      })
    );
    setInputText('');
  };

  const handleLeaveRoom = async () => {
    if (!sessionData.roomId || !sessionData.participantId) {
      navigate('feedback');
      return;
    }

    try {
      setIsLeaving(true);
      setLeaveError('');
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: 'leave_room',
            roomId: sessionData.roomId,
            participantId: sessionData.participantId,
          })
        );
      }
      await requestJson(`/rooms/${sessionData.roomId}/leave`, {
        method: 'POST',
        body: JSON.stringify({ participantId: sessionData.participantId }),
      });
      setSessionData(prev => ({
        ...prev,
        roomId: '',
        roomName: '',
        participantId: '',
        participantName: '',
      }));
      navigate('feedback');
    } catch (error: any) {
      setLeaveError('Unable to leave the room.');
    } finally {
      setIsLeaving(false);
    }
  };

  return (
    <View className="flex-1 bg-slate-50">
      {/* Header */}
      <View className="bg-white border-b-2 border-slate-100 px-6 py-4">
        <Text className="text-xs text-blue-600 font-semibold mb-1">
          {sessionData.selectedCommunity}
        </Text>
        <Text className="text-xs text-slate-500 mb-1">Room topic</Text>
        <Text className="text-xl font-bold text-slate-900 mb-3">
          {sessionData.roomName || (sessionData.matchTopic ? sessionData.matchTopic.split(',')[0] : 'Room')} — {sessionData.module}
        </Text>
        <Text className="text-slate-600 text-sm mb-3">
          {sessionData.userRole === 'helping'
            ? 'You are helping a peer in this room.'
            : 'You are receiving support from a matched peer.'}
        </Text>

        <Text className="text-sm text-slate-600">
          Participant: <Text className="font-semibold text-slate-800">{sessionData.participantName || 'Guest'}</Text>
        </Text>
      </View>

      {/* Messages */}
      <ScrollView className="flex-1 px-6 py-4">
        {messages.map(message => (
          <View
            key={message.id}
            className={`mb-4 ${message.senderId === sessionData.participantId ? 'items-end' : 'items-start'}`}
          >
            <Text className="text-xs text-slate-500 mb-1 px-1">
              {message.senderId === sessionData.participantId ? 'You' : message.senderName}
            </Text>
            <View
              className={`max-w-[75%] px-4 py-3 rounded-2xl ${
                message.senderId === sessionData.participantId
                  ? 'bg-blue-600 rounded-br-sm'
                  : 'bg-white border border-slate-200 rounded-bl-sm'
              }`}
            >
              <Text
                className={`text-base leading-relaxed ${
                  message.senderId === sessionData.participantId ? 'text-white' : 'text-slate-900'
                }`}
              >
                {message.text}
              </Text>
            </View>
            <Text className="text-xs text-slate-400 mt-1 px-1">
              {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Action Buttons */}
      <View className="bg-white border-t-2 border-slate-100 px-4 py-3">
        <View className="flex-row gap-2 mb-3">
          <TouchableOpacity
            onPress={() => navigate('reveal')}
            className="flex-1 bg-blue-50 py-3 rounded-lg border border-blue-200"
          >
            <Text className="text-blue-600 text-center font-semibold text-sm">
              Reveal Identity
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleLeaveRoom}
            disabled={isLeaving}
            className={`flex-1 py-3 rounded-lg border ${
              isLeaving ? 'bg-slate-100 border-slate-200' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <Text className="text-slate-700 text-center font-semibold text-sm">
              {isLeaving ? 'Leaving...' : 'Leave Room'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowReport(true)}
            className="bg-red-50 px-4 py-3 rounded-lg border border-red-200"
          >
            <Text className="text-red-600 text-center font-semibold text-sm">
              Report
            </Text>
          </TouchableOpacity>
        </View>

        {/* Message Input */}
        <View className="flex-row gap-2">
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            className="flex-1 bg-slate-100 rounded-xl px-4 py-3 text-base text-slate-900"
            placeholder="Type a message..."
            placeholderTextColor="#94a3b8"
          />
          <TouchableOpacity
            onPress={sendMessage}
            className="bg-blue-600 w-12 h-12 rounded-xl items-center justify-center"
          >
            <Text className="text-white text-xl">→</Text>
          </TouchableOpacity>
        </View>
      </View>

      {leaveError ? (
        <View className="px-6 pb-3">
          <Text className="text-red-600 text-sm text-center">{leaveError}</Text>
        </View>
      ) : null}

      {sendError ? (
        <View className="px-6 pb-3">
          <Text className="text-red-600 text-sm text-center">{sendError}</Text>
        </View>
      ) : null}

      {/* Report Modal */}
      {showReport && (
        <View className="absolute inset-0 bg-black/50 items-center justify-center px-6">
          <View className="bg-white rounded-2xl p-6 w-full max-w-md">
            <Text className="text-xl font-bold text-slate-900 mb-4">
              Report User
            </Text>
            <Text className="text-slate-600 mb-4">
              Why are you reporting this user?
            </Text>
            <View className="gap-2 mb-6">
              {['Inappropriate content', 'Harassment', 'Spam', 'Other'].map(reason => (
                <TouchableOpacity
                  key={reason}
                  className="bg-slate-50 py-3 px-4 rounded-lg border border-slate-200"
                >
                  <Text className="text-slate-700">{reason}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowReport(false)}
                className="flex-1 bg-slate-100 py-3 rounded-lg"
              >
                <Text className="text-slate-700 text-center font-semibold">
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowReport(false);
                  // Handle report submission
                }}
                className="flex-1 bg-red-600 py-3 rounded-lg"
              >
                <Text className="text-white text-center font-semibold">
                  Submit
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default RoomScreen;
