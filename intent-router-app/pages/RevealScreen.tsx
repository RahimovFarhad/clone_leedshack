import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { requestJson } from '../lib/api';
import { Screen, SessionData } from '../types';

type RevealScreenProps = {
  navigate: (screen: Screen) => void;
  sessionData: SessionData;
  setSessionData: React.Dispatch<React.SetStateAction<SessionData>>;
};

const RevealScreen = ({ navigate, sessionData, setSessionData }: RevealScreenProps) => {
  const [isEnding, setIsEnding] = useState(false);
  const [endError, setEndError] = useState('');

  const handleEndSession = async () => {
    if (!sessionData.roomId || !sessionData.participantId) {
      navigate('feedback');
      return;
    }

    try {
      setIsEnding(true);
      setEndError('');
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
      setEndError('Unable to end the session.');
    } finally {
      setIsEnding(false);
    }
  };

  return (
    <View className="flex-1 bg-slate-50 justify-center px-6">
      <View className="items-center mb-8">
        <View className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full items-center justify-center mb-4">
          <Text className="text-white text-4xl">🤝</Text>
        </View>
        <Text className="text-2xl font-bold text-slate-900 mb-2 text-center">
          You both agreed to connect
        </Text>
        <Text className="text-slate-600 text-center">
          Your identities are now revealed
        </Text>
      </View>

      <View className="bg-white rounded-2xl p-6 mb-6 shadow-lg">
        <View className="mb-4">
          <Text className="text-sm text-slate-500 mb-2">You</Text>
          <View className="flex-row items-center">
            <View className="w-12 h-12 bg-blue-500 rounded-full mr-3 items-center justify-center">
              <Text className="text-white text-xl font-bold">A</Text>
            </View>
            <View>
              <Text className="text-lg font-bold text-slate-900">Alex Chen</Text>
              <Text className="text-sm text-slate-600">alex.chen@university.edu</Text>
            </View>
          </View>
        </View>

        <View className="border-t border-slate-100 pt-4">
          <Text className="text-sm text-slate-500 mb-2">Your peer</Text>
          <View className="flex-row items-center">
            <View className="w-12 h-12 bg-green-500 rounded-full mr-3 items-center justify-center">
              <Text className="text-white text-xl font-bold">S</Text>
            </View>
            <View>
              <Text className="text-lg font-bold text-slate-900">Sam Rodriguez</Text>
              <Text className="text-sm text-slate-600">sam.r@university.edu</Text>
            </View>
          </View>
        </View>
      </View>

      <TouchableOpacity
        onPress={() => navigate('room')}
        className="bg-blue-600 py-5 rounded-xl mb-3"
      >
        <Text className="text-white text-center text-lg font-bold">
          Continue Chat
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleEndSession}
        disabled={isEnding}
        className="py-3"
      >
        <Text className="text-slate-500 text-center font-medium">
          {isEnding ? 'Ending session...' : 'End Session'}
        </Text>
      </TouchableOpacity>

      {endError ? (
        <Text className="text-red-600 text-center text-sm mt-3">{endError}</Text>
      ) : null}
    </View>
  );
};

export default RevealScreen;
