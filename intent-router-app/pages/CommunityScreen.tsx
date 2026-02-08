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

const CommunityScreen = ({
  navigate,
  sessionData,
  setSessionData,
}: CommunityScreenProps) => {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [displayName, setDisplayName] = useState(sessionData.participantName || '');
  const [email, setEmail] = useState(sessionData.participantEmail || '');
  const [search, setSearch] = useState('');

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
    const sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
    setSessionData((prev) => ({
      ...prev,
      sessionId,
      selectedCommunityId: community.id,
      selectedCommunity: community.name,
      participantName: displayName.trim() || prev.participantName || 'Guest',
      participantEmail: email.trim() || prev.participantEmail || '',
    }));
    navigate('dashboard');
  };

  const filteredCommunities = communities.filter((community) =>
    community.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="flex-1 px-6 py-12 max-w-3xl mx-auto w-full">
        {/* Header */}
        <View className="mb-12">
          <Text className="text-2xl font-bold text-black mb-2">
            Community Selection
          </Text>
          <Text className="text-sm text-gray-600">
            Complete your profile and select a community to continue
          </Text>
        </View>

        {/* Profile Section */}
        <View className="mb-12">
          <Text className="text-xs font-bold text-black uppercase tracking-wider mb-6">
            Profile Information
          </Text>
          
          <View className="mb-6">
            <Text className="text-sm font-semibold text-black mb-3">
              Display Name *
            </Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Enter your name"
              placeholderTextColor="#A3A3A3"
              className="bg-gray-50 px-4 py-4 text-black text-base rounded-lg border border-gray-200"
            />
          </View>

          <View className="mb-6">
            <Text className="text-sm font-semibold text-black mb-3">
              Email <Text className="text-gray-500 font-normal">(optional)</Text>
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="your.email@example.com"
              placeholderTextColor="#A3A3A3"
              keyboardType="email-address"
              autoCapitalize="none"
              className="bg-gray-50 px-4 py-4 text-black text-base rounded-lg border border-gray-200"
            />
          </View>

          {/* Current Session Info */}
          {(sessionData.participantName || sessionData.participantEmail) && (
            <View className="bg-gray-900 px-5 py-4 mt-2 rounded-lg">
              <Text className="text-xs text-white">
                Active Session: <Text className="font-bold">{sessionData.participantName || 'Guest'}</Text>
                {sessionData.participantEmail && (
                  <Text> • {sessionData.participantEmail}</Text>
                )}
              </Text>
            </View>
          )}
        </View>

        {/* Communities Section */}
        <View className="flex-1">
          <View className="mb-6">
            <Text className="text-xs font-bold text-black uppercase tracking-wider mb-2">
              Available Communities
            </Text>
            {!isLoading && !loadError && (
              <Text className="text-sm text-gray-600">
                {filteredCommunities.length} {filteredCommunities.length === 1 ? 'community' : 'communities'}
              </Text>
            )}
          </View>

          {/* Search Bar */}
          {!isLoading && !loadError && communities.length > 0 && (
            <View className="mb-6">
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search by name..."
                placeholderTextColor="#A3A3A3"
                className="bg-gray-50 px-4 py-4 text-black text-base rounded-lg border border-gray-200"
              />
            </View>
          )}

          {/* Loading State */}
          {isLoading && (
            <View className="items-center justify-center py-24">
              <ActivityIndicator size="large" color="#000000" />
              <Text className="text-gray-600 mt-5 text-sm">
                Loading communities...
              </Text>
            </View>
          )}

          {/* Error State */}
          {!isLoading && loadError && (
            <View className="bg-red-600 px-6 py-5 rounded-lg">
              <Text className="text-white font-bold text-sm mb-2">
                Error
              </Text>
              <Text className="text-white text-sm">
                {loadError}
              </Text>
            </View>
          )}

          {/* Communities List */}
          {!isLoading && !loadError && (
            <View>
              {filteredCommunities.map((community, index) => (
                <TouchableOpacity
                  key={community.id}
                  onPress={() => handleSelectCommunity(community)}
                  className="mb-3 bg-white rounded-2xl overflow-hidden border border-gray-100"
                  activeOpacity={0.6}
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.06,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                >
                  <View className="px-6 py-6">
                    <View className="flex-row items-start justify-between mb-3">
                      <Text className="text-xl font-bold text-black flex-1 pr-4">
                        {community.name}
                      </Text>
                      <View className="bg-black px-3 py-1.5 rounded-full">
                        <Text className="text-xs font-bold text-white">
                          JOIN
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center">
                        <Text className="text-sm text-gray-500">
                          {community.members} members
                        </Text>
                        <View className="w-1 h-1 rounded-full bg-gray-300 mx-3" />
                        <Text className="text-sm text-gray-500">
                          {' '}{community.rooms ?? community.activeRooms ?? 0} active rooms
                        </Text>
                      </View>
                      <View className="ml-4">
                        <Text className="text-2xl text-gray-400">→</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}

              {/* No Results */}
              {communities.length > 0 && filteredCommunities.length === 0 && (
                <View className="py-24 bg-gray-50 rounded-xl">
                  <Text className="text-gray-600 text-center text-sm">
                    No communities found matching "{search}"
                  </Text>
                </View>
              )}

              {/* Empty State */}
              {communities.length === 0 && (
                <View className="bg-yellow-400 px-6 py-6 rounded-lg">
                  <Text className="text-black font-bold text-sm mb-2">
                    No Communities Available
                  </Text>
                  <Text className="text-black text-sm">
                    Please contact your administrator to set up communities in the database.
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

export default CommunityScreen;