import React, { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { requestJson } from '../lib/api';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const modules = ['CS101', 'MATH201', 'PHYS102', 'CHEM151', 'ENG103', 'Other'];
  const urgencies = ['now', 'today', 'this week'];

  const handleFindMatch = async () => {
    const trimmedNeed = needText.trim();
    if (!trimmedNeed) {
      setSubmitError('Please describe your need first.');
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError('');

      const contextText = module
        ? `${trimmedNeed}. Module/subject: ${module}`
        : trimmedNeed;

      const classified = await requestJson('/api/classify-intent', {
        method: 'POST',
        body: JSON.stringify({ text: contextText }),
      });

      const topicLabel = String(classified?.topic_label || '').trim();
      const normalizedTopicLabel = topicLabel.toLowerCase();
      const isGenericTopicLabel =
        !topicLabel ||
        normalizedTopicLabel === 'community request' ||
        normalizedTopicLabel === 'help request';
      const matchTopic = isGenericTopicLabel ? contextText : topicLabel;

      setSessionData({
        ...sessionData,
        roomId: '',
        roomName: '',
        participantId: '',
        needText: trimmedNeed,
        module: module || 'General',
        urgency,
        matchTopic,
        similarity: 0,
        userRole: 'seeking',
      });

      navigate('matching');
    } catch (error: any) {
      setSubmitError('Could not classify your request. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-6 py-12 max-w-3xl mx-auto w-full">
        <TouchableOpacity
          onPress={() => navigate(sessionData.returnScreen || 'dashboard')}
          className="mb-8 flex-row items-center"
        >
          <Text className="text-black text-lg mr-2">←</Text>
          <Text className="text-black font-semibold text-sm">Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <View className="mb-12">
          <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            {sessionData.selectedCommunity}
          </Text>
          <Text className="text-2xl font-bold text-black mb-2">
            What do you need help with?
          </Text>
          <Text className="text-sm text-gray-600">
            We'll match you with someone who understands
          </Text>
        </View>

        {/* Main Input */}
        <View className="mb-12">
          <Text className="text-xs font-bold text-black uppercase tracking-wider mb-6">
            Your Request
          </Text>
          <View className="mb-6">
            <Text className="text-sm font-semibold text-black mb-3">
              Describe your need *
            </Text>
            <TextInput
              value={needText}
              onChangeText={setNeedText}
              multiline
              numberOfLines={4}
              className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-4 text-base text-black"
              placeholder="e.g. recursion, calculus exam prep, lab report"
              placeholderTextColor="#A3A3A3"
              textAlignVertical="top"
            />
          </View>

          {/* Module Selection */}
          <View className="mb-6">
            <Text className="text-sm font-semibold text-black mb-3">
              Module / Subject <Text className="text-gray-500 font-normal">(optional)</Text>
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {modules.map(mod => (
                <TouchableOpacity
                  key={mod}
                  onPress={() => setModule(mod)}
                  className={`px-4 py-2.5 rounded-lg border ${
                    module === mod
                      ? 'border-black bg-gray-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <Text
                    className={`font-semibold text-sm ${
                      module === mod ? 'text-black' : 'text-gray-700'
                    }`}
                  >
                    {mod}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Urgency */}
          <View className="mb-6">
            <Text className="text-sm font-semibold text-black mb-3">
              When do you need help? *
            </Text>
            <View className="flex-row gap-2">
              {urgencies.map(urg => (
                <TouchableOpacity
                  key={urg}
                  onPress={() => setUrgency(urg)}
                  className={`flex-1 py-3.5 rounded-lg ${
                    urgency === urg
                      ? 'bg-black'
                      : 'bg-white border border-gray-200'
                  }`}
                >
                  <Text
                    className={`text-center font-bold text-sm ${
                      urgency === urg ? 'text-white' : 'text-gray-700'
                    }`}
                  >
                    {urg}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Find Match Button */}
        <TouchableOpacity
          onPress={handleFindMatch}
          disabled={!needText.trim() || isSubmitting}
          className={`py-5 rounded-lg mb-3 ${
            needText.trim() && !isSubmitting ? 'bg-black' : 'bg-gray-300'
          }`}
        >
          <Text className="text-white text-center text-base font-bold">
            {isSubmitting ? 'Analyzing...' : 'Find Match'}
          </Text>
        </TouchableOpacity>

        {submitError ? (
          <View className="bg-red-600 px-5 py-4 rounded-lg">
            <Text className="text-white font-bold text-sm">
              {submitError}
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
};

export default IntakeScreen;
