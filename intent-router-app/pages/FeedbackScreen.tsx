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
    <View className="flex-1 bg-white justify-center px-6">
      <View className="max-w-xl mx-auto w-full">
        <View className="mb-12">
          <Text className="text-2xl font-bold text-black mb-2 text-center">
            Was this helpful?
          </Text>
          <Text className="text-sm text-gray-600 text-center">
            Your feedback improves future matches
          </Text>
        </View>

        {/* Yes/No Buttons */}
        <View className="flex-row gap-4 mb-8">
          <TouchableOpacity
            onPress={() => setHelpful(true)}
            className={`flex-1 py-8 rounded-lg border-2 ${
              helpful === true
                ? 'border-black bg-gray-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <Text className="text-center text-4xl mb-3">✓</Text>
            <Text
              className={`text-center font-bold text-base ${
                helpful === true ? 'text-black' : 'text-gray-700'
              }`}
            >
              Yes
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setHelpful(false)}
            className={`flex-1 py-8 rounded-lg border-2 ${
              helpful === false
                ? 'border-red-600 bg-red-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <Text className="text-center text-4xl mb-3">✗</Text>
            <Text
              className={`text-center font-bold text-base ${
                helpful === false ? 'text-red-600' : 'text-gray-700'
              }`}
            >
              No
            </Text>
          </TouchableOpacity>
        </View>

        {/* Optional Reason */}
        {helpful !== null && (
          <View className="mb-8">
            <Text className="text-sm font-semibold text-black mb-3">
              Tell us more <Text className="text-gray-500 font-normal">(optional)</Text>
            </Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={4}
              className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-4 text-base text-black"
              placeholder={helpful ? 'What worked well?' : 'What could be better?'}
              placeholderTextColor="#A3A3A3"
              textAlignVertical="top"
            />
          </View>
        )}

        {/* Done Button */}
        <TouchableOpacity
          onPress={handleDone}
          disabled={helpful === null}
          className={`py-5 rounded-lg mb-3 ${
            helpful !== null ? 'bg-black' : 'bg-gray-300'
          }`}
        >
          <Text className="text-white text-center text-base font-bold">
            Done
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigate('dashboard')}
          className="py-3"
        >
          <Text className="text-gray-500 text-center font-medium text-sm">
            Skip feedback
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default FeedbackScreen;