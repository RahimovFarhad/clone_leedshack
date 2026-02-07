import React, { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Screen, SessionData } from '../types';

type IntakeScreenProps = {
  navigate: (screen: Screen) => void;
  sessionData: SessionData;
  setSessionData: React.Dispatch<React.SetStateAction<SessionData>>;
};

const IntakeScreen = ({ navigate, sessionData, setSessionData }: IntakeScreenProps) => {
  const [needText, setNeedText] = useState('');
  const [module, setModule] = useState('');
  const [urgency, setUrgency] = useState('this week');

  const modules = ['CS101', 'MATH201', 'PHYS102', 'CHEM151', 'ENG103', 'Other'];
  const urgencies = ['now', 'today', 'this week'];

  const handleFindMatch = () => {
    // Mock NLP classification
    const topics = ['Recursion', 'CS101', 'Exam prep'];
    const similarity = Math.floor(Math.random() * 20) + 80; // 80-99%

    setSessionData({
      ...sessionData,
      needText,
      module: module || 'CS101',
      urgency,
      matchTopic: topics.join(', '),
      similarity,
      userRole: 'seeking',
    });

    navigate('matching');
  };

  return (
    <ScrollView className="flex-1 bg-slate-50">
      <View className="px-6 py-8">
        <TouchableOpacity
          onPress={() => navigate(sessionData.returnScreen || 'dashboard')}
          className="mb-4 flex-row items-center"
        >
          <Text className="text-blue-600 text-lg mr-2">←</Text>
          <Text className="text-blue-600 font-semibold">Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <View className="mb-8">
          <Text className="text-3xl font-bold text-slate-900 mb-2">
            What do you need help with?
          </Text>
          <Text className="text-slate-600">
            We'll match you with someone who understands
          </Text>
          <Text className="text-blue-700 font-semibold mt-2">
            Community: {sessionData.selectedCommunity}
          </Text>
        </View>

        {/* Main Input */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-slate-700 mb-3">
            Describe your need
          </Text>
          <TextInput
            value={needText}
            onChangeText={setNeedText}
            multiline
            numberOfLines={4}
            className="bg-white border-2 border-slate-200 rounded-xl px-4 py-4 text-base text-slate-900"
            placeholder="e.g. recursion, calculus exam prep, lab report"
            placeholderTextColor="#94a3b8"
            textAlignVertical="top"
          />
        </View>

        {/* Module Selection */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-slate-700 mb-3">
            Module / Subject (optional)
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {modules.map(mod => (
              <TouchableOpacity
                key={mod}
                onPress={() => setModule(mod)}
                className={`px-4 py-2 rounded-full border-2 ${
                  module === mod
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <Text
                  className={`font-medium ${
                    module === mod ? 'text-blue-600' : 'text-slate-700'
                  }`}
                >
                  {mod}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Urgency */}
        <View className="mb-8">
          <Text className="text-sm font-semibold text-slate-700 mb-3">
            When do you need help?
          </Text>
          <View className="flex-row gap-2">
            {urgencies.map(urg => (
              <TouchableOpacity
                key={urg}
                onPress={() => setUrgency(urg)}
                className={`flex-1 py-3 rounded-xl border-2 ${
                  urgency === urg
                    ? 'border-blue-600 bg-blue-600'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <Text
                  className={`text-center font-semibold ${
                    urgency === urg ? 'text-white' : 'text-slate-700'
                  }`}
                >
                  {urg}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Find Match Button */}
        <TouchableOpacity
          onPress={handleFindMatch}
          disabled={!needText.trim()}
          className={`py-5 rounded-xl ${
            needText.trim() ? 'bg-blue-600' : 'bg-slate-300'
          }`}
        >
          <Text className="text-white text-center text-lg font-bold">
            Find Match
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default IntakeScreen;
