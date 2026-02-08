import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Screen, SessionData } from '../types';

type HomeScreenProps = {
  navigate: (screen: Screen) => void;
  sessionData: SessionData;
};

const HomeScreen = ({ navigate, sessionData }: HomeScreenProps) => {
  return (
    <View className="flex-1 bg-white justify-center px-6">
      <View className="max-w-xl mx-auto w-full">
        <View className="items-center mb-16">
          <View className="w-24 h-24 bg-black rounded-full items-center justify-center mb-8">
            <Text className="text-white text-4xl">🤝</Text>
          </View>
          <Text className="text-3xl font-bold text-black text-center mb-3 leading-tight">
            {sessionData.selectedCommunity || 'Your Community'}
          </Text>
          <Text className="text-sm text-gray-600 text-center">
            You are part of an active support network
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => navigate('dashboard')}
          className="bg-black py-5 rounded-lg mb-4"
        >
          <Text className="text-white text-center text-base font-bold">
            Open Dashboard
          </Text>
        </TouchableOpacity>

        <Text className="text-gray-400 text-center mt-6 text-sm">
          Ask for help or offer help to others
        </Text>
      </View>
    </View>
  );
};

export default HomeScreen;