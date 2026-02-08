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
  const [joinAnonymously, setJoinAnonymously] = useState(false);
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
      const resolvedName = joinAnonymously ? 'Anonymous' : (displayName.trim() || 'Guest');
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

  const getRoomBadge = (room: Room) => {
    if (room.mode === 'offer') {
      return {
        label: 'CAN HELP',
        containerClass: 'bg-emerald-200',
        textClass: 'text-emerald-900',
      };
    }
    if (room.mode === 'group') {
      return {
        label: 'GROUP',
        containerClass: 'bg-blue-200',
        textClass: 'text-blue-900',
      };
    }
    return {
      label: 'NEEDS HELP',
      containerClass: 'bg-yellow-400',
      textClass: 'text-black',
    };
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-6 py-12 max-w-3xl mx-auto w-full">
        {/* Header */}
        <View className="mb-12">
          <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            {sessionData.selectedCommunity}
          </Text>
          <Text className="text-2xl font-bold text-black mb-2">
            Community Dashboard
          </Text>
          <Text className="text-sm text-gray-600">
            Join rooms, ask for help, or support someone who is waiting
          </Text>
        </View>

        {/* Key Metrics */}
        <View className="mb-12">
          <Text className="text-xs font-bold text-black uppercase tracking-wider mb-6">
            Overview
          </Text>
          <View className="flex-row flex-wrap gap-3">
            <View className="flex-1 min-w-[45%] bg-gray-50 rounded-lg p-4 border border-gray-200">
              <Text className="text-sm text-gray-600 mb-1">Active Rooms</Text>
              <Text className="text-3xl font-bold text-black">{rooms.length}</Text>
            </View>
            <View className="flex-1 min-w-[45%] bg-gray-50 rounded-lg p-4 border border-gray-200">
              <Text className="text-sm text-gray-600 mb-1">Participants</Text>
              <Text className="text-3xl font-bold text-black">{rooms.reduce((count, room) => count + room.participants.length, 0)}</Text>
            </View>
            <View className="flex-1 min-w-[45%] bg-gray-50 rounded-lg p-4 border border-gray-200">
              <Text className="text-sm text-gray-600 mb-1">Open Spots</Text>
              <Text className="text-3xl font-bold text-black">
                {rooms.reduce((count, room) => count + Math.max(0, 2 - room.participants.length), 0)}
              </Text>
            </View>
            <View className="flex-1 min-w-[45%] bg-gray-50 rounded-lg p-4 border border-gray-200">
              <Text className="text-sm text-gray-600 mb-1">Your Current Room</Text>
              <Text className="text-3xl font-bold text-black">
                {sessionData.roomId ? '1' : '0'}
              </Text>
            </View>
          </View>
        </View>

        {/* Create Room Section */}
        {/* <View className="mb-12">
          <Text className="text-xs font-bold text-black uppercase tracking-wider mb-6">
            Create Room
          </Text>
          <View className="mb-6">
            <Text className="text-sm font-semibold text-black mb-3">Room Name *</Text>
            <View className="flex-row gap-2">
              <TextInput
                value={newRoomName}
                onChangeText={setNewRoomName}
                className="flex-1 bg-gray-50 rounded-lg px-4 py-4 text-base text-black border border-gray-200"
                placeholder="e.g. CS101 study session"
                placeholderTextColor="#A3A3A3"
              />
              <TouchableOpacity
                onPress={handleCreateRoom}
                disabled={isCreating}
                className={`px-6 rounded-lg items-center justify-center ${isCreating ? 'bg-gray-400' : 'bg-black'}`}
              >
                <Text className="text-white font-bold text-sm">
                  {isCreating ? 'Creating' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-black mb-3">
              Display Name <Text className="text-gray-500 font-normal">(optional)</Text>
            </Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              editable={!joinAnonymously}
              className={`rounded-lg px-4 py-4 text-base border ${
                joinAnonymously ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-gray-50 text-black border-gray-200'
              }`}
              placeholder={joinAnonymously ? 'Anonymous' : 'Guest'}
              placeholderTextColor="#A3A3A3"
            />
            <TouchableOpacity
              onPress={() => setJoinAnonymously(prev => !prev)}
              className="mt-4 flex-row items-center"
            >
              <View
                className={`w-6 h-6 rounded border-2 mr-3 items-center justify-center ${
                  joinAnonymously ? 'bg-black border-black' : 'bg-white border-gray-300'
                }`}
              >
                {joinAnonymously ? <Text className="text-white text-xs font-extrabold">✓</Text> : null}
              </View>
              <View>
                <Text className="text-sm font-semibold text-black">
                  Join anonymously
                </Text>
                {joinAnonymously ? (
                  <Text className="text-xs text-gray-600">Anonymous mode is enabled</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          </View>

          {actionError ? (
            <View className="bg-red-600 px-5 py-4 rounded-lg mt-4">
              <Text className="text-white font-bold text-sm">{actionError}</Text>
            </View>
          ) : null}
        </View> */}

        {/* Active Rooms Section */}
        <View className="mb-12">
          <Text className="text-xs font-bold text-black uppercase tracking-wider mb-2">
            Active Rooms
          </Text>
          <Text className="text-sm text-gray-600 mb-6">
            {!isLoading && !loadError ? `${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'} available` : ''}
          </Text>

          {isLoading ? (
            <View className="py-24 items-center">
              <ActivityIndicator size="large" color="#000000" />
              <Text className="text-gray-600 mt-5 text-sm">Loading rooms...</Text>
            </View>
          ) : null}

          {!isLoading && loadError ? (
            <View className="bg-red-600 px-6 py-5 rounded-lg">
              <Text className="text-white font-bold text-sm mb-2">Error</Text>
              <Text className="text-white text-sm">{loadError}</Text>
            </View>
          ) : null}

          {!isLoading && !loadError && rooms.length === 0 ? (
            <View className="bg-gray-50 rounded-lg px-5 py-6 border border-gray-200">
              <Text className="text-gray-600 text-sm text-center">No active rooms yet. Create one above.</Text>
            </View>
          ) : null}

          {!isLoading && !loadError && rooms.map(room => {
            const badge = getRoomBadge(room);
            return (
            <View
              key={room.id} 
              className="mb-3 bg-white rounded-2xl overflow-hidden border border-gray-100"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <View className="px-6 py-6">
                <View className="flex-row justify-between items-start mb-4">
                  <View className="flex-1 pr-4">
                    <Text className="text-xl font-bold text-black mb-2">
                      {room.name}
                    </Text>
                    <Text className="text-sm text-gray-500">
                      {room.participants.length} participant{room.participants.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <View className={`${badge.containerClass} px-3 py-1.5 rounded-full`}>
                    <Text className={`${badge.textClass} text-xs font-bold`}>{badge.label}</Text>
                  </View>
                </View>
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => handleJoinRoom(room, 'helping')}
                    className="flex-1 bg-black py-3.5 rounded-lg"
                  >
                    <Text className="text-white text-center font-bold text-sm">
                      Help in Room
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleJoinRoom(room, 'seeking')}
                    className="flex-1 bg-gray-900 py-3.5 rounded-lg"
                  >
                    <Text className="text-white text-center font-bold text-sm">
                      Join Room
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )})}
        </View>

        {/* Actions */}
        <View className="mb-6">
          <TouchableOpacity
            onPress={() => {
              setSessionData(prev => ({
                ...prev,
                userRole: 'seeking',
                returnScreen: 'dashboard',
              }));
              navigate('intake');
            }}
            className="bg-black py-5 rounded-lg mb-3"
          >
            <Text className="text-white text-center text-base font-bold">
              Ask For Help
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigate('community')}
            className="bg-white py-4 rounded-lg border border-gray-300"
          >
            <Text className="text-black text-center font-bold text-base">
              Switch Community
            </Text>
          </TouchableOpacity>
        </View>

        <View className="bg-gray-100 rounded-lg px-5 py-4">
          <Text className="text-sm text-gray-600 text-center">
            This space is always active. You can both request and provide help.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

export default DashboardScreen;
