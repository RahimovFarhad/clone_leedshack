import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Screen, SessionData } from '../types';

type HomeScreenProps = {
  navigate: (screen: Screen) => void;
  sessionData: SessionData;
};

const HomeScreen = ({ navigate, sessionData }: HomeScreenProps) => {
  return (
    <View className="flex-1 bg-gradient-to-b from-blue-50 to-slate-50 justify-center px-6">
      <View className="items-center mb-12">
        <View className="w-20 h-20 bg-blue-500 rounded-full items-center justify-center mb-6">
          <Text className="text-white text-3xl">🤝</Text>
        </View>

        <Text className="text-3xl font-bold text-slate-900 text-center mb-4 leading-tight">
          {sessionData.selectedCommunity || 'Your Community'}
        </Text>
        <Text className="text-slate-600 text-center">
          You are part of an active support network
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => navigate('dashboard')}
        className="bg-blue-600 py-5 rounded-2xl shadow-lg"
      >
        <Text className="text-white text-center text-xl font-bold">
          Open Dashboard
        </Text>
      </TouchableOpacity>

      <Text className="text-slate-400 text-center mt-8 text-sm">
        Ask for help or offer help to others
      </Text>
    </View>
  );
};

export default HomeScreen;
