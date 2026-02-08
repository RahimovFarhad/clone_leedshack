import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { requestJson } from '../lib/api';
import { Screen, SessionData } from '../types';

type MatchingScreenProps = {
  navigate: (screen: Screen) => void;
  sessionData: SessionData;
  setSessionData: React.Dispatch<React.SetStateAction<SessionData>>;
};

type MatchStatus = 'candidates' | 'waiting' | 'matched';

type CandidateRoom = {
  room_id: string;
  room_title?: string;
  request_id: string;
  score: number;
  percentage: number;
  confidence?: 'high' | 'medium' | 'low';
  qualifies: boolean;
  recommended: boolean;
  reasons: string[];
};

const MatchingScreen = ({ navigate, sessionData, setSessionData }: MatchingScreenProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [isCreatingOwnRoom, setIsCreatingOwnRoom] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [matchingError, setMatchingError] = useState('');
  const [matchMessage, setMatchMessage] = useState('');
  const [matchStatus, setMatchStatus] = useState<MatchStatus>('waiting');
  const [candidateRooms, setCandidateRooms] = useState<CandidateRoom[]>([]);
  const [closestRoom, setClosestRoom] = useState<CandidateRoom | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const [selectionGuidance, setSelectionGuidance] = useState('');
  const [joinAnonymously, setJoinAnonymously] = useState(false);

  React.useEffect(() => {
    let isMounted = true;

    const runMatching = async () => {
      if (!sessionData.needText?.trim()) {
        if (isMounted) {
          setMatchingError('Please submit your request details first.');
          setIsLoading(false);
        }
        return;
      }

      try {
        setMatchingError('');
        const userId =
          sessionData.participantEmail?.trim() ||
          sessionData.sessionId ||
          sessionData.participantName?.trim() ||
          'anonymous';

        const text = sessionData.module && sessionData.module !== 'General'
          ? `${sessionData.needText}. Module/subject: ${sessionData.module}`
          : sessionData.needText;

        const matchResult = await requestJson('/post-request', {
          method: 'POST',
          headers: { 'x-user-id': userId },
          body: JSON.stringify({
            text,
            urgency: sessionData.urgency || 'this week',
            communityId: sessionData.selectedCommunityId,
          }),
        });

        const backendStatus = String(matchResult?.match_status || '').trim();
        const nextStatus: MatchStatus =
          backendStatus === 'candidates' ? 'candidates' : backendStatus === 'matched' ? 'matched' : 'waiting';

        const rooms = Array.isArray(matchResult?.candidate_rooms)
          ? (matchResult.candidate_rooms as CandidateRoom[])
          : [];
        const recommended = rooms.find(room => room.recommended) || rooms[0] || null;
        const bestConfidence = String(recommended?.confidence || 'low').toLowerCase();
        const closest = matchResult?.closest_room || null;
        const score = Number(matchResult?.score);
        const similarity = Number.isFinite(score)
          ? Math.max(0, Math.min(99, Math.round(score)))
          : recommended?.percentage || 0;

        if (!isMounted) return;

        setCandidateRooms(rooms);
        setShowAllCandidates(false);
        setClosestRoom(closest);
        if ((nextStatus === 'candidates' || nextStatus === 'matched') && bestConfidence !== 'high') {
          setSelectedRoomId('');
          setSelectionGuidance(
            `Top confidence is ${bestConfidence.toUpperCase()}. Review the reasons below and choose a room, or create your own.`
          );
        } else {
          setSelectedRoomId(String(recommended?.room_id || matchResult?.room_id || '').trim());
          setSelectionGuidance('');
        }
        setMatchStatus(nextStatus);
        setMatchMessage(String(matchResult?.message || '').trim());

        setSessionData(prev => ({
          ...prev,
          roomId: String(matchResult?.waiting_room_id || matchResult?.room_id || prev.roomId || ''),
          roomName: prev.matchTopic || 'Community Room',
          similarity,
          matchTopic: prev.matchTopic || text,
        }));
      } catch (error: any) {
        if (isMounted) {
          setMatchingError('Unable to complete backend matching. You can still open a room.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    runMatching();
    return () => {
      isMounted = false;
    };
  }, [
    sessionData.needText,
    sessionData.module,
    sessionData.urgency,
    sessionData.participantEmail,
    sessionData.participantName,
    sessionData.sessionId,
    sessionData.selectedCommunityId,
    setSessionData,
  ]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-white justify-center items-center px-6">
        <ActivityIndicator size="large" color="#000000" />
        <Text className="text-xl font-bold text-black mt-6 text-center">
          Finding room options...
        </Text>
        <Text className="text-gray-600 mt-3 text-center text-sm">
          Ranking compatible rooms and preparing recommendations
        </Text>
      </View>
    );
  }

  const handleJoinCommunityRoom = async () => {
    if (!sessionData.selectedCommunityId) {
      setJoinError('Select a community first.');
      return;
    }

    try {
      setIsJoining(true);
      setJoinError('');
      const resolvedDisplayName = joinAnonymously
        ? 'Anonymous'
        : (sessionData.participantName || '').trim() || 'Guest';

      let targetRoomId = String(selectedRoomId || sessionData.roomId || '').trim();
      let targetRoomName = sessionData.roomName || sessionData.matchTopic || 'Community Room';

      if (matchStatus === 'candidates' && !selectedRoomId) {
        setJoinError('Choose one of the existing rooms first, or create your own room.');
        return;
      }

      if (!targetRoomId) {
        const roomName = sessionData.matchTopic || 'New Room';
        const roomResponse = await requestJson('/rooms', {
          method: 'POST',
          body: JSON.stringify({
            communityId: sessionData.selectedCommunityId,
            name: roomName,
            mode: sessionData.userRole === 'helping' ? 'offer' : 'help',
          }),
        });
        targetRoomId = roomResponse.room.id;
        targetRoomName = roomResponse.room.name;
      }

      const joinResponse = await requestJson(`/rooms/${targetRoomId}/join`, {
        method: 'POST',
        body: JSON.stringify({ displayName: resolvedDisplayName }),
      });

      setSessionData(prev => ({
        ...prev,
        roomId: targetRoomId,
        roomName: targetRoomName,
        participantId: joinResponse.participant.id,
        participantName: joinResponse.participant.displayName || resolvedDisplayName,
      }));
      navigate('room');
    } catch (error: any) {
      setJoinError('Unable to join the selected room.');
    } finally {
      setIsJoining(false);
    }
  };

  const visibleCandidateRooms = showAllCandidates
    ? candidateRooms
    : candidateRooms.slice(0, 2);

  const confidenceStyle = (confidence?: string) => {
    const key = String(confidence || '').toLowerCase();
    if (key === 'high') return { label: 'HIGH', box: 'bg-emerald-100', text: 'text-emerald-800' };
    if (key === 'medium') return { label: 'MEDIUM', box: 'bg-amber-100', text: 'text-amber-800' };
    return { label: 'LOW', box: 'bg-gray-200', text: 'text-gray-700' };
  };

  const handleCreateOwnRoom = async () => {
    if (!sessionData.selectedCommunityId) {
      setJoinError('Select a community first.');
      return;
    }

    try {
      setIsCreatingOwnRoom(true);
      setJoinError('');
      const resolvedDisplayName = joinAnonymously
        ? 'Anonymous'
        : (sessionData.participantName || '').trim() || 'Guest';

      const roomName = sessionData.matchTopic || 'My Room';
      const roomResponse = await requestJson('/rooms', {
        method: 'POST',
        body: JSON.stringify({
          communityId: sessionData.selectedCommunityId,
          name: roomName,
          mode: sessionData.userRole === 'helping' ? 'offer' : 'help',
        }),
      });

      const joinResponse = await requestJson(`/rooms/${roomResponse.room.id}/join`, {
        method: 'POST',
        body: JSON.stringify({ displayName: resolvedDisplayName }),
      });

      setSessionData(prev => ({
        ...prev,
        roomId: roomResponse.room.id,
        roomName: roomResponse.room.name,
        participantId: joinResponse.participant.id,
        participantName: joinResponse.participant.displayName || resolvedDisplayName,
      }));
      navigate('room');
    } catch (error: any) {
      setJoinError('Unable to create your room.');
    } finally {
      setIsCreatingOwnRoom(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-6 py-12 max-w-3xl mx-auto w-full">
        <View className="items-center mb-12">
          <View className={`w-24 h-24 rounded-full items-center justify-center mb-4 ${
            matchStatus === 'candidates' || matchStatus === 'matched' ? 'bg-black' : 'bg-yellow-400'
          }`}>
            <Text className="text-white text-5xl">
              {matchStatus === 'candidates' || matchStatus === 'matched' ? '✓' : '⏳'}
            </Text>
          </View>
          <Text className="text-2xl font-bold text-black">
            {matchStatus === 'candidates' || matchStatus === 'matched' ? 'Room Options Found' : 'Room Created'}
          </Text>
        </View>

        <View className="mb-12">
          <Text className="text-xs font-bold text-black uppercase tracking-wider mb-6">
            Matchmaking Results
          </Text>

          <View className="bg-gray-50 rounded-lg p-5 mb-6 border border-gray-200">
            <Text className="text-sm text-gray-600 mb-2">Request topic:</Text>
            <Text className="text-lg font-bold text-black">{sessionData.matchTopic}</Text>
          </View>

          {matchStatus === 'candidates' || matchStatus === 'matched' ? (
            <View className="mb-6">
              <Text className="text-sm text-gray-700 mb-4">
                Here are the close rooms we found for you, but you can also create and wait in your own room too.
              </Text>
              {selectionGuidance ? (
                <View className="mb-4 p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                  <Text className="text-black text-sm font-semibold">{selectionGuidance}</Text>
                </View>
              ) : null}
              {visibleCandidateRooms.map(room => {
                const selected = selectedRoomId === room.room_id;
                return (
                  <TouchableOpacity
                    key={room.request_id}
                    onPress={() => setSelectedRoomId(room.room_id)}
                    className={`mb-3 rounded-lg overflow-hidden border ${
                      selected ? 'border-black bg-gray-50' : 'border-gray-200 bg-white'
                    }`}
                    style={{
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: selected ? 0.08 : 0.04,
                      shadowRadius: 4,
                      elevation: selected ? 2 : 1,
                    }}
                  >
                    <View className="p-5">
                      <View className="flex-row items-center justify-between mb-3">
                        <Text className="text-base font-bold text-black flex-1 pr-3" numberOfLines={1}>
                          {room.room_title || `Room #${room.room_id}`}
                        </Text>
                        <View className={`px-2.5 py-1 rounded-full ${confidenceStyle(room.confidence).box}`}>
                          <Text className={`text-xs font-bold ${confidenceStyle(room.confidence).text}`}>
                            {confidenceStyle(room.confidence).label}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-gray-500 text-xs mb-3">ID: {room.room_id} • Score {room.percentage}%</Text>
                      {room.recommended ? (
                        <View className="self-start px-3 py-1 rounded-full bg-black mb-3">
                          <Text className="text-white text-xs font-bold">RECOMMENDED</Text>
                        </View>
                      ) : null}
                      <Text className="text-gray-600 text-sm" numberOfLines={3}>
                        {Array.isArray(room.reasons) ? room.reasons.slice(0, 3).join(' • ') : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {candidateRooms.length > 2 ? (
                <TouchableOpacity
                  onPress={() => setShowAllCandidates(prev => !prev)}
                  className="mt-1 self-start px-4 py-2 rounded-lg border border-gray-300 bg-white"
                >
                  <Text className="text-gray-700 text-sm font-semibold">
                    {showAllCandidates ? 'See less' : `See more (${candidateRooms.length - 2} more)`}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <View className="bg-yellow-50 rounded-lg p-5 mb-6 border border-yellow-200">
              <Text className="text-black font-bold mb-2 text-sm">Waiting for match</Text>
              <Text className="text-black text-sm mb-3">
                We created a room for you. You can wait here or join the closest option below.
              </Text>
              {closestRoom ? (
                <TouchableOpacity
                  onPress={() => setSelectedRoomId(String(closestRoom.room_id || ''))}
                  className="mt-2 p-4 rounded-lg border border-gray-300 bg-white"
                >
                  <Text className="text-black font-bold text-sm">
                    Closest option: {closestRoom.room_title || `Room #${closestRoom.room_id}`}
                  </Text>
                  <Text className="text-gray-600 text-xs mt-1">
                    Confidence {String(closestRoom.confidence || 'low').toUpperCase()} • Score {closestRoom.percentage}%
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {matchMessage ? (
            <Text className="text-gray-700 text-sm mb-6">{matchMessage}</Text>
          ) : null}
        </View>

        {!isLoading ? (
          <TouchableOpacity
            onPress={() => setJoinAnonymously(prev => !prev)}
            className="mb-6 flex-row items-center"
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
        ) : null}

        {!isLoading ? (
          <TouchableOpacity
            onPress={handleCreateOwnRoom}
            disabled={isCreatingOwnRoom}
            className={`py-4 rounded-lg mb-3 border ${
              isCreatingOwnRoom ? 'bg-gray-100 border-gray-200' : 'bg-white border-gray-300'
            }`}
          >
            <Text className={`text-center font-bold text-sm ${isCreatingOwnRoom ? 'text-gray-500' : 'text-black'}`}>
              {isCreatingOwnRoom ? 'Creating your room...' : 'Create Your Own Room'}
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          onPress={handleJoinCommunityRoom}
          disabled={isJoining}
          className={`py-5 rounded-lg mb-3 ${isJoining ? 'bg-gray-400' : 'bg-black'}`}
        >
          <Text className="text-white text-center text-base font-bold">
            {isJoining ? 'Joining...' : 'Join Selected Room'}
          </Text>
        </TouchableOpacity>

        {joinError ? (
          <View className="bg-red-600 px-5 py-4 rounded-lg mb-3">
            <Text className="text-white font-bold text-sm">{joinError}</Text>
          </View>
        ) : null}
        
        {matchingError ? (
          <View className="bg-yellow-400 px-5 py-4 rounded-lg mb-3">
            <Text className="text-black font-bold text-sm">{matchingError}</Text>
          </View>
        ) : null}

        <TouchableOpacity onPress={() => navigate('intake')} className="py-3">
          <Text className="text-gray-500 text-center font-medium text-sm">Try different match</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default MatchingScreen;
