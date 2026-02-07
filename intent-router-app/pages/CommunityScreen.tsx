import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { requestJson } from '../lib/api';
import { Community, Screen, SessionData } from '../types';

type CommunityScreenProps = {
  navigate: (screen: Screen) => void;
  sessionData: SessionData;
  setSessionData: React.Dispatch<React.SetStateAction<SessionData>>;
};

const CommunityScreen = ({ navigate, sessionData, setSessionData }: CommunityScreenProps) => {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [displayName, setDisplayName] = useState(sessionData.participantName || '');
  const [email, setEmail] = useState(sessionData.participantEmail || '');

  React.useEffect(() => {
    let isMounted = true;

    const loadCommunities = async () => {
      try {
        setIsLoading(true);
        setLoadError('');
        const data = await requestJson('/communities');
        if (isMounted) {
          setCommunities(data.communities || []);
        }
      } catch (error: any) {
        if (isMounted) {
          setLoadError('Unable to load communities.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadCommunities();
    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    setDisplayName(sessionData.participantName || '');
    setEmail(sessionData.participantEmail || '');
  }, [sessionData.participantName, sessionData.participantEmail]);

  const handleSelectCommunity = (community: Community) => {
    // Generate session ID
    const sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
    setSessionData(prev => ({
      ...prev,
      sessionId,
      selectedCommunityId: community.id,
      selectedCommunity: community.name,
      participantName: displayName.trim() || prev.participantName || 'Guest',
      participantEmail: email.trim() || prev.participantEmail || '',
    }));
    navigate('dashboard');
  };

  return (
    <ScrollView className="flex-1 bg-slate-50">
      <View className="px-6 py-8">
        <View className="mb-8">
          <Text className="text-3xl font-bold text-slate-900 mb-2">
            Choose your community
          </Text>
          <Text className="text-slate-600">
            Start from a space where your voice can be seen and heard
          </Text>
        </View>

        <View className="bg-white rounded-2xl p-4 border-2 border-slate-100 mb-6">
          <Text className="text-sm font-semibold text-slate-700 mb-2">Your name</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            className="bg-slate-100 rounded-xl px-4 py-3 text-base text-slate-900 mb-4"
            placeholder="Guest"
            placeholderTextColor="#94a3b8"
          />
          <Text className="text-sm font-semibold text-slate-700 mb-2">Your email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            className="bg-slate-100 rounded-xl px-4 py-3 text-base text-slate-900"
            placeholder="you@example.com"
            placeholderTextColor="#94a3b8"
          />
          <Text className="text-xs text-slate-500 mt-3">
            Saved as{' '}
            <Text className="font-semibold text-slate-700">
              {sessionData.participantName || 'Guest'}
            </Text>
            {sessionData.participantEmail ? (
              <Text className="text-slate-500">
                {' '}•{' '}
                <Text className="font-semibold text-slate-700">
                  {sessionData.participantEmail}
                </Text>
              </Text>
            ) : null}
          </Text>
        </View>

        <View className="gap-3 mb-8">
          {isLoading && (
            <View className="py-8 items-center">
              <ActivityIndicator size="large" color="#2563eb" />
              <Text className="text-slate-500 mt-3">Loading communities...</Text>
            </View>
          )}

          {!isLoading && loadError ? (
            <View className="bg-red-50 border border-red-200 rounded-xl p-4">
              <Text className="text-red-700 font-semibold">{loadError}</Text>
            </View>
          ) : null}

          {!isLoading && !loadError && communities.map(community => (
            <TouchableOpacity
              key={community.id}
              onPress={() => handleSelectCommunity(community)}
              className="bg-white rounded-2xl p-4 border-2 border-slate-100"
            >
              <View className="flex-row items-center">
                <View className={`w-11 h-11 rounded-xl ${community.theme || 'bg-blue-500'} items-center justify-center mr-3`}>
                  <Text className="text-white text-lg">🏘️</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-bold text-slate-900 mb-1">
                    {community.name}
                  </Text>
                  <Text className="text-slate-600 text-sm">
                    {community.members} members • {community.rooms ?? community.activeRooms ?? 0} active rooms
                  </Text>
                </View>
                <Text className="text-slate-400 text-xl">›</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <Text className="text-blue-900 font-semibold mb-1">Why this step?</Text>
          <Text className="text-blue-800 text-sm leading-relaxed">
            Communities are noisy. We help route your voice inside the right group,
            then connect you to rooms where you can ask for support or help others.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

export default CommunityScreen;
