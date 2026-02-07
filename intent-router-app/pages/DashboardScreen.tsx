import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { API_BASE_URL, requestJson } from '../lib/api';
import { Room, Screen, SessionData } from '../types';


type DashboardScreenProps = {
  navigate: (screen: Screen) => void;
  sessionData: SessionData;
  setSessionData: React.Dispatch<React.SetStateAction<SessionData>>;
};

const DashboardScreen = ({ navigate, sessionData, setSessionData }: DashboardScreenProps) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [displayName, setDisplayName] = useState(sessionData.participantName || '');
  const [isCreating, setIsCreating] = useState(false);
  const [actionError, setActionError] = useState('');

  const communityId = sessionData.selectedCommunityId;
  const wsBaseUrl = API_BASE_URL.startsWith('https')
    ? API_BASE_URL.replace('https', 'wss')
    : API_BASE_URL.replace('http', 'ws');

  const loadRooms = async () => {
    if (!communityId) {
      return;
    }

    try {
      setIsLoading(true);
      setLoadError('');
      const data = await requestJson(`/communities/${communityId}/rooms`);
      setRooms(data.rooms || []);
    } catch (error: any) {
      setLoadError('Unable to load rooms.');
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadRooms();
  }, [communityId]);

  React.useEffect(() => {
    if (!communityId) {
      return;
    }

    const socket = new WebSocket(`${wsBaseUrl}/ws`);

    socket.onmessage = event => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'snapshot') {
          const snapshotRooms = (payload.rooms || []).filter(
            (room: Room) => room.communityId === communityId
          );
          setRooms(snapshotRooms);
          return;
        }

        if (payload.type === 'room_created' || payload.type === 'room_updated') {
          if (payload.room?.communityId !== communityId) {
            return;
          }
          setRooms(prev => {
            const index = prev.findIndex(room => room.id === payload.room.id);
            if (index === -1) {
              return [...prev, payload.room];
            }
            const next = [...prev];
            next[index] = payload.room;
            return next;
          });
        }

        if (payload.type === 'room_deleted') {
          setRooms(prev => prev.filter(room => room.id !== payload.roomId));
        }
      } catch (error) {
        // Ignore invalid websocket payloads
      }
    };

    return () => {
      socket.close();
    };
  }, [communityId, wsBaseUrl]);

  const handleCreateRoom = async () => {
    if (!communityId) {
      setActionError('Select a community first.');
      return;
    }

    const trimmedName = newRoomName.trim();
    if (!trimmedName) {
      setActionError('Enter a room name.');
      return;
    }

    try {
      setIsCreating(true);
      setActionError('');
      await requestJson('/rooms', {
        method: 'POST',
        body: JSON.stringify({ communityId, name: trimmedName }),
      });
      setNewRoomName('');
    } catch (error: any) {
      setActionError('Unable to create room.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (room: Room, role: 'seeking' | 'helping') => {
    try {
      setActionError('');
      const resolvedName = displayName.trim() || 'Guest';
      const payload = { displayName: resolvedName };
      const data = await requestJson(`/rooms/${room.id}/join`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setSessionData(prev => ({
        ...prev,
        roomId: room.id,
        roomName: room.name,
        participantId: data.participant.id,
        participantName: data.participant.displayName || resolvedName,
        matchTopic: room.name,
        userRole: role,
      }));
      navigate('room');
    } catch (error: any) {
      setActionError('Unable to join the room.');
    }
  };

  return (
    <ScrollView className="flex-1 bg-slate-50">
      <View className="px-6 py-8">
        {/* Header */}
        <View className="mb-8">
          <Text className="text-sm text-blue-700 font-semibold mb-2">
            {sessionData.selectedCommunity}
          </Text>
          <Text className="text-3xl font-bold text-slate-900 mb-2">
            Community Dashboard
          </Text>
          <Text className="text-slate-600">
            Join rooms, ask for help, or support someone who is waiting
          </Text>
        </View>

        {/* Key Metrics */}
        <View className="flex-row flex-wrap gap-3 mb-6">
          <View className="flex-1 min-w-[45%] bg-white rounded-xl p-4 border-2 border-blue-100">
            <Text className="text-sm text-slate-600 mb-1">Active Rooms</Text>
            <Text className="text-3xl font-bold text-blue-600">{rooms.length}</Text>
          </View>
          <View className="flex-1 min-w-[45%] bg-white rounded-xl p-4 border-2 border-green-100">
            <Text className="text-sm text-slate-600 mb-1">Participants</Text>
            <Text className="text-3xl font-bold text-green-600">{rooms.reduce((count, room) => count + room.participants.length, 0)}</Text>
          </View>
          <View className="flex-1 min-w-[45%] bg-white rounded-xl p-4 border-2 border-purple-100">
            <Text className="text-sm text-slate-600 mb-1">You Helped This Week</Text>
            <Text className="text-3xl font-bold text-purple-600">4</Text>
          </View>
          <View className="flex-1 min-w-[45%] bg-white rounded-xl p-4 border-2 border-orange-100">
            <Text className="text-sm text-slate-600 mb-1">Your Sessions</Text>
            <Text className="text-3xl font-bold text-orange-600">9</Text>
          </View>
        </View>

        {/* Active Rooms */}
        <View className="bg-white rounded-2xl p-6 mb-6 border-2 border-slate-100">
          <Text className="text-lg font-bold text-slate-900 mb-4">
            Rooms Active Right Now
          </Text>

          <View className="mb-4">
            <Text className="text-sm text-slate-600 mb-2">Create a new room</Text>
            <View className="flex-row gap-2">
              <TextInput
                value={newRoomName}
                onChangeText={setNewRoomName}
                className="flex-1 bg-slate-100 rounded-xl px-4 py-3 text-base text-slate-900"
                placeholder="e.g. CS101 study session"
                placeholderTextColor="#94a3b8"
              />
              <TouchableOpacity
                onPress={handleCreateRoom}
                disabled={isCreating}
                className={`px-4 rounded-xl items-center justify-center ${isCreating ? 'bg-blue-300' : 'bg-blue-600'}`}
              >
                <Text className="text-white font-semibold">
                  {isCreating ? 'Creating' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-sm text-slate-600 mb-2">Display name (optional)</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              className="bg-slate-100 rounded-xl px-4 py-3 text-base text-slate-900"
              placeholder="Guest"
              placeholderTextColor="#94a3b8"
            />
          </View>

          {actionError ? (
            <Text className="text-red-600 text-sm mb-3">{actionError}</Text>
          ) : null}

          {isLoading ? (
            <View className="py-6 items-center">
              <ActivityIndicator size="large" color="#2563eb" />
              <Text className="text-slate-500 mt-3">Loading rooms...</Text>
            </View>
          ) : null}

          {!isLoading && loadError ? (
            <View className="bg-red-50 border border-red-200 rounded-xl p-4">
              <Text className="text-red-700 font-semibold">{loadError}</Text>
            </View>
          ) : null}

          {!isLoading && !loadError && rooms.length === 0 ? (
            <View className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <Text className="text-slate-600">No active rooms yet. Create one above.</Text>
            </View>
          ) : null}

          {!isLoading && !loadError && rooms.map(room => (
            <View key={room.id} className="mb-4 last:mb-0 bg-slate-50 rounded-xl p-4 border border-slate-200">
              <View className="flex-row justify-between items-center mb-3">
                <View className="flex-1 pr-3">
                  <Text className="text-slate-900 font-bold">
                    {room.name}
                  </Text>
                  <Text className="text-slate-600 text-sm">
                    {room.participants.length} participant{room.participants.length === 1 ? '' : 's'}
                  </Text>
                </View>
                {room.participants.length < 2 && (
                  <View className="bg-amber-100 px-2 py-1 rounded-full">
                    <Text className="text-amber-700 text-xs font-semibold">Needs helpers</Text>
                  </View>
                )}
              </View>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => handleJoinRoom(room, 'helping')}
                  className="flex-1 bg-emerald-600 py-2.5 rounded-lg"
                >
                  <Text className="text-white text-center font-semibold">
                    Help in this room
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleJoinRoom(room, 'seeking')}
                  className="flex-1 bg-blue-600 py-2.5 rounded-lg"
                >
                  <Text className="text-white text-center font-semibold">
                    Join room
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Actions */}
        <TouchableOpacity
          onPress={() => {
            setSessionData(prev => ({
              ...prev,
              userRole: 'seeking',
              returnScreen: 'dashboard',
            }));
            navigate('intake');
          }}
          className="bg-blue-600 py-5 rounded-xl mb-3"
        >
          <Text className="text-white text-center text-lg font-bold">
            Ask For Help
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigate('community')}
          className="bg-white py-4 rounded-xl mb-3 border-2 border-slate-200"
        >
          <Text className="text-slate-800 text-center font-bold">
            Switch Community
          </Text>
        </TouchableOpacity>

        <View className="bg-slate-100 rounded-xl p-4 border border-slate-200">
          <Text className="text-sm text-slate-600 text-center">
            This space is always active. You can both request and provide help.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

export default DashboardScreen;
