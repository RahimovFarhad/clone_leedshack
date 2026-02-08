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
  qualifies: boolean;
  recommended: boolean;
  reasons: string[];
};

const AUTO_SELECT_THRESHOLD = 70;

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
        const bestPercentage = Number(recommended?.percentage || 0);
        const closest = matchResult?.closest_room || null;
        const score = Number(matchResult?.score);
        const similarity = Number.isFinite(score)
          ? Math.max(0, Math.min(99, Math.round(score)))
          : recommended?.percentage || 0;

        if (!isMounted) return;

        setCandidateRooms(rooms);
        setShowAllCandidates(false);
        setClosestRoom(closest);
        if (nextStatus === 'candidates' && bestPercentage < AUTO_SELECT_THRESHOLD) {
          setSelectedRoomId('');
          setSelectionGuidance(
            `${bestPercentage}% is the best we can do right now. You can join one of the existing rooms or create your own.`
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
      <View className="flex-1 bg-slate-50 justify-center items-center px-6">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="text-xl font-semibold text-slate-900 mt-6 text-center">
          Finding room options... 
        </Text>
        <Text className="text-slate-500 mt-3 text-center">
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
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 24 }}>
      <View className="items-center mb-8">
        <View className={`w-24 h-24 rounded-full items-center justify-center mb-4 ${
          matchStatus === 'candidates' || matchStatus === 'matched' ? 'bg-green-500' : 'bg-amber-500'
        }`}>
          <Text className="text-white text-5xl">
            {matchStatus === 'candidates' || matchStatus === 'matched' ? '✓' : '⏳'}
          </Text>
        </View>
        <Text className="text-2xl font-bold text-slate-900">
          {matchStatus === 'candidates' || matchStatus === 'matched' ? 'Room Options Found' : 'Room Created'}
        </Text>
      </View>

      <View className="bg-white rounded-2xl p-6 mb-6 shadow-lg border-2 border-blue-100">
        <Text className="text-sm font-semibold text-blue-600 mb-4 uppercase tracking-wide">
          Matchmaking Results
        </Text>

        <View className="mb-4">
          <Text className="text-base text-slate-700 font-medium mb-2">Request topic:</Text>
          <Text className="text-lg font-bold text-slate-900">{sessionData.matchTopic}</Text>
        </View>

        {matchStatus === 'candidates' ? (
          <View className="mb-4">
            <Text className="text-slate-700 text-sm mb-3">
              Here are the close rooms we found for you, but you can also create and wait in your own room too.
            </Text>
            {selectionGuidance ? (
              <View className="mb-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
                <Text className="text-amber-900 text-sm font-medium">{selectionGuidance}</Text>
              </View>
            ) : null}
            {visibleCandidateRooms.map(room => {
              const selected = selectedRoomId === room.room_id;
              return (
                <TouchableOpacity
                  key={room.request_id}
                  onPress={() => setSelectedRoomId(room.room_id)}
                  className={`mb-3 p-4 rounded-xl border-2 ${selected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-slate-900 font-semibold" numberOfLines={1}>
                      {room.room_title || `Room #${room.room_id}`}
                    </Text>
                    <Text className="text-blue-700 font-bold">{room.percentage}%</Text>
                  </View>
                  <Text className="text-slate-500 text-xs mb-2">ID: {room.room_id}</Text>
                  {room.recommended ? (
                    <View className="self-start px-2 py-1 rounded-full bg-emerald-100 mb-2">
                      <Text className="text-emerald-700 text-xs font-semibold">Recommended</Text>
                    </View>
                  ) : null}
                  <Text className="text-slate-600 text-xs" numberOfLines={2}>
                    {Array.isArray(room.reasons) ? room.reasons.join(' • ') : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {candidateRooms.length > 2 ? (
              <TouchableOpacity
                onPress={() => setShowAllCandidates(prev => !prev)}
                className="mt-1 self-start px-3 py-2 rounded-lg border border-slate-300 bg-white"
              >
                <Text className="text-slate-700 text-xs font-semibold">
                  {showAllCandidates ? 'See less' : `See more (${candidateRooms.length - 2} more)`}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <View className="bg-amber-50 rounded-xl p-4 mb-4 border border-amber-200">
            <Text className="text-amber-900 font-semibold mb-1">Waiting for match</Text>
            <Text className="text-amber-800 text-sm">
              We created a room for you. You can wait here or join the closest option below.
            </Text>
            {closestRoom ? (
              <TouchableOpacity
                onPress={() => setSelectedRoomId(String(closestRoom.room_id || ''))}
                className="mt-3 p-3 rounded-lg border border-amber-300 bg-white"
              >
                <Text className="text-slate-900 font-semibold">
                  Closest option: {closestRoom.room_title || `Room #${closestRoom.room_id}`}
                </Text>
                <Text className="text-slate-600 text-xs mt-1">{closestRoom.percentage}% match</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {matchMessage ? (
          <Text className="text-blue-700 text-sm">{matchMessage}</Text>
        ) : null}
      </View>

      {!isLoading ? (
        <TouchableOpacity
          onPress={() => setJoinAnonymously(prev => !prev)}
          className={`mt-2 mb-2 flex-row items-center self-start px-3 py-2 rounded-xl border-2 ${
            joinAnonymously ? 'bg-blue-50 border-blue-500' : 'bg-white border-slate-300'
          }`}
        >
          <View
            className={`w-7 h-7 rounded-md border-2 mr-3 items-center justify-center ${
              joinAnonymously ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-400'
            }`}
          >
            {joinAnonymously ? <Text className="text-white text-sm font-extrabold">✓</Text> : null}
          </View>
          <View>
            <Text className={`text-sm font-semibold ${joinAnonymously ? 'text-blue-700' : 'text-slate-700'}`}>
              Join anonymously
            </Text>
            {joinAnonymously ? (
              <Text className="text-xs text-blue-700">Anonymous mode ON (you will get a hidden alias)</Text>
            ) : null}
          </View>
        </TouchableOpacity>
      ) : null}

      {!isLoading ? (
        <TouchableOpacity
          onPress={handleCreateOwnRoom}
          disabled={isCreatingOwnRoom}
          className={`py-4 rounded-xl mt-3 border-2 ${
            isCreatingOwnRoom ? 'bg-slate-100 border-slate-200' : 'bg-white border-blue-200'
          }`}
        >
          <Text className={`text-center font-bold ${isCreatingOwnRoom ? 'text-slate-500' : 'text-blue-700'}`}>
            {isCreatingOwnRoom ? 'Creating your room...' : 'Create Your Own Room'}
          </Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        onPress={handleJoinCommunityRoom}
        disabled={isJoining}
        className={`py-5 rounded-xl mt-3 ${isJoining ? 'bg-blue-300' : 'bg-blue-600'}`}
      >
        <Text className="text-white text-center text-lg font-bold">
          {isJoining ? 'Joining...' : 'Join Selected Room'}
        </Text>
      </TouchableOpacity>

      {joinError ? <Text className="text-red-600 text-center text-sm mt-3">{joinError}</Text> : null}
      {matchingError ? <Text className="text-amber-700 text-center text-sm mt-3">{matchingError}</Text> : null}

      <TouchableOpacity onPress={() => navigate('intake')} className="mt-4 py-3">
        <Text className="text-slate-500 text-center font-medium">Try different match</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default MatchingScreen;
