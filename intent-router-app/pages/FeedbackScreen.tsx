import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Screen, SessionData } from '../types';


type FeedbackScreenProps = {
  navigate: (screen: Screen) => void;
  sessionData: SessionData;
  setSessionData: React.Dispatch<React.SetStateAction<SessionData>>;
};

const FeedbackScreen = ({ navigate, sessionData, setSessionData }: FeedbackScreenProps) => {
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [reason, setReason] = useState('');

  const handleDone = () => {
    setSessionData({ ...sessionData, wasHelpful: helpful });
    navigate('dashboard');
  };

  return (
    <View className="flex-1 bg-slate-50 justify-center px-6">
      <View className="mb-8">
        <Text className="text-3xl font-bold text-slate-900 mb-2 text-center">
          Was this helpful?
        </Text>
        <Text className="text-slate-600 text-center">
          Your feedback improves future matches
        </Text>
      </View>

      {/* Yes/No Buttons */}
      <View className="flex-row gap-4 mb-6">
        <TouchableOpacity
          onPress={() => setHelpful(true)}
          className={`flex-1 py-6 rounded-2xl border-2 ${
            helpful === true
              ? 'border-green-500 bg-green-50'
              : 'border-slate-200 bg-white'
          }`}
        >
          <Text className="text-center text-4xl mb-2">✓</Text>
          <Text
            className={`text-center font-bold text-lg ${
              helpful === true ? 'text-green-600' : 'text-slate-700'
            }`}
          >
            Yes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setHelpful(false)}
          className={`flex-1 py-6 rounded-2xl border-2 ${
            helpful === false
              ? 'border-red-500 bg-red-50'
              : 'border-slate-200 bg-white'
          }`}
        >
          <Text className="text-center text-4xl mb-2">✗</Text>
          <Text
            className={`text-center font-bold text-lg ${
              helpful === false ? 'text-red-600' : 'text-slate-700'
            }`}
          >
            No
          </Text>
        </TouchableOpacity>
      </View>

      {/* Optional Reason */}
      {helpful !== null && (
        <View className="mb-8">
          <Text className="text-sm font-semibold text-slate-700 mb-3">
            Tell us more (optional)
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={3}
            className="bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-base text-slate-900"
            placeholder={helpful ? 'What worked well?' : 'What could be better?'}
            placeholderTextColor="#94a3b8"
            textAlignVertical="top"
          />
        </View>
      )}

      {/* Done Button */}
      <TouchableOpacity
        onPress={handleDone}
        disabled={helpful === null}
        className={`py-5 rounded-xl ${
          helpful !== null ? 'bg-blue-600' : 'bg-slate-300'
        }`}
      >
        <Text className="text-white text-center text-lg font-bold">
          Done
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigate('dashboard')}
        className="mt-4 py-3"
      >
        <Text className="text-slate-500 text-center font-medium">
          Skip feedback
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default FeedbackScreen;
