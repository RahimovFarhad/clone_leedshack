import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import './global.css';

// Navigation State Management
type Screen = 
  | 'community'
  | 'home'
  | 'intake'
  | 'matching'
  | 'room'
  | 'reveal'
  | 'feedback'
  | 'dashboard';

const App = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('community');
  const [sessionData, setSessionData] = useState({
    sessionId: '',
    selectedCommunity: '',
    needText: '',
    module: '',
    urgency: 'this week',
    matchTopic: '',
    similarity: 0,
    userAnimal: 'Blue Fox',
    peerAnimal: 'Green Pine',
    userRole: 'seeking' as 'seeking' | 'helping',
    wasHelpful: null as boolean | null,
  });

  const navigate = (screen: Screen) => setCurrentScreen(screen);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'community':
        return <CommunityScreen navigate={navigate} setSessionData={setSessionData} />;
      case 'home':
        return <HomeScreen navigate={navigate} sessionData={sessionData} />;
      case 'intake':
        return <IntakeScreen navigate={navigate} sessionData={sessionData} setSessionData={setSessionData} />;
      case 'matching':
        return <MatchingScreen navigate={navigate} sessionData={sessionData} />;
      case 'room':
        return <RoomScreen navigate={navigate} sessionData={sessionData} />;
      case 'reveal':
        return <RevealScreen navigate={navigate} />;
      case 'feedback':
        return <FeedbackScreen navigate={navigate} sessionData={sessionData} setSessionData={setSessionData} />;
      case 'dashboard':
        return <DashboardScreen navigate={navigate} sessionData={sessionData} setSessionData={setSessionData} />;
      default:
        return <CommunityScreen navigate={navigate} setSessionData={setSessionData} />;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      {renderScreen()}
    </SafeAreaView>
  );
};

// ============================================================================
// SCREEN 0: COMMUNITY SELECT (Entry Point)
// ============================================================================
const CommunityScreen = ({ navigate, setSessionData }: any) => {
  const communities = [
    { id: 'c1', name: 'Computer Science Club', members: 248, rooms: 12, theme: 'bg-blue-500' },
    { id: 'c2', name: 'Design & Creators', members: 143, rooms: 6, theme: 'bg-emerald-500' },
    { id: 'c3', name: 'First-Year Study Circle', members: 319, rooms: 18, theme: 'bg-amber-500' },
    { id: 'c4', name: 'Hack Nights Community', members: 97, rooms: 4, theme: 'bg-rose-500' },
  ];

  const handleSelectCommunity = (communityName: string) => {
    // Generate session ID
    const sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
    setSessionData((prev: any) => ({
      ...prev,
      sessionId,
      selectedCommunity: communityName,
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

        <View className="gap-3 mb-8">
          {communities.map(community => (
            <TouchableOpacity
              key={community.id}
              onPress={() => handleSelectCommunity(community.name)}
              className="bg-white rounded-2xl p-4 border-2 border-slate-100"
            >
              <View className="flex-row items-center">
                <View className={`w-11 h-11 rounded-xl ${community.theme} items-center justify-center mr-3`}>
                  <Text className="text-white text-lg">🏘️</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-bold text-slate-900 mb-1">
                    {community.name}
                  </Text>
                  <Text className="text-slate-600 text-sm">
                    {community.members} members • {community.rooms} active rooms
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

// ============================================================================
// SCREEN 0.5: COMMUNITY HOME
// ============================================================================
const HomeScreen = ({ navigate, sessionData }: any) => {
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

// ============================================================================
// SCREEN 1: INTAKE (Core Screen)
// ============================================================================
const IntakeScreen = ({ navigate, sessionData, setSessionData }: any) => {
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

// ============================================================================
// SCREEN 2: MATCHING (AI Explainability - THE KEY MOMENT)
// ============================================================================
const MatchingScreen = ({ navigate, sessionData }: any) => {
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    // Simulate AI matching
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <View className="flex-1 bg-slate-50 justify-center items-center px-6">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="text-xl font-semibold text-slate-900 mt-6 text-center">
          Finding someone with{'\n'}similar needs...
        </Text>
        <Text className="text-slate-500 mt-3 text-center">
          Analyzing topics and matching peers
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50 justify-center px-6">
      {/* Success Icon */}
      <View className="items-center mb-8">
        <View className="w-24 h-24 bg-green-500 rounded-full items-center justify-center mb-4">
          <Text className="text-white text-5xl">✓</Text>
        </View>
        <Text className="text-2xl font-bold text-slate-900">
          Match Found!
        </Text>
      </View>

      {/* Match Card - THE KEY AI EXPLAINABILITY MOMENT FOR JUDGES */}
      <View className="bg-white rounded-2xl p-6 mb-6 shadow-lg border-2 border-blue-100">
        <Text className="text-sm font-semibold text-blue-600 mb-4 uppercase tracking-wide">
          AI Matching Analysis
        </Text>
        
        <View className="mb-4">
          <Text className="text-base text-slate-700 font-medium mb-2">
            Matched on:
          </Text>
          <Text className="text-lg font-bold text-slate-900">
            {sessionData.matchTopic}
          </Text>
        </View>

        <View className="bg-blue-50 rounded-xl p-4 mb-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-slate-700 font-medium">
              Similarity Score
            </Text>
            <Text className="text-2xl font-bold text-blue-600">
              {sessionData.similarity}%
            </Text>
          </View>
          <View className="bg-blue-600 h-2 rounded-full mt-3">
            <View 
              className="bg-blue-400 h-2 rounded-full"
              style={{ width: `${sessionData.similarity}%` }}
            />
          </View>
        </View>

        <View className="border-t border-slate-100 pt-4">
          <Text className="text-sm text-slate-600 leading-relaxed">
            ✓ Same topic area{'\n'}
            ✓ Similar urgency level{'\n'}
            ✓ Active peer available now
          </Text>
        </View>
      </View>

      {/* CTA */}
      <TouchableOpacity
        onPress={() => navigate('room')}
        className="bg-blue-600 py-5 rounded-xl"
      >
        <Text className="text-white text-center text-lg font-bold">
          Join Community Room
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigate('intake')}
        className="mt-4 py-3"
      >
        <Text className="text-slate-500 text-center font-medium">
          Try different match
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ============================================================================
// SCREEN 3: ANONYMOUS ROOM
// ============================================================================
const RoomScreen = ({ navigate, sessionData }: any) => {
  const [messages, setMessages] = useState(
    sessionData.userRole === 'helping'
      ? [
          { id: 1, sender: 'them', text: "Hey, I can't debug this recursion base case. Can you take a look?", time: '2:34 PM' },
          { id: 2, sender: 'me', text: 'Yes, share the failing input and expected output.', time: '2:35 PM' },
          { id: 3, sender: 'them', text: 'Input is 0, expected 1 but I get infinite calls.', time: '2:35 PM' },
        ]
      : [
          { id: 1, sender: 'them', text: "Hey! I'm also struggling with recursion. Have you tried the tree traversal examples?", time: '2:34 PM' },
          { id: 2, sender: 'me', text: "Not yet, I'm still trying to understand the base case concept", time: '2:35 PM' },
          { id: 3, sender: 'them', text: "Oh that's the key! Let me explain how I think about it...", time: '2:35 PM' },
        ]
  );
  const [inputText, setInputText] = useState('');
  const [showReport, setShowReport] = useState(false);

  const sendMessage = () => {
    if (inputText.trim()) {
      setMessages([
        ...messages,
        { id: messages.length + 1, sender: 'me', text: inputText, time: 'Now' },
      ]);
      setInputText('');
    }
  };

  return (
    <View className="flex-1 bg-slate-50">
      {/* Header */}
      <View className="bg-white border-b-2 border-slate-100 px-6 py-4">
        <Text className="text-xs text-blue-600 font-semibold mb-1">
          {sessionData.selectedCommunity}
        </Text>
        <Text className="text-xs text-slate-500 mb-1">Room topic</Text>
        <Text className="text-xl font-bold text-slate-900 mb-3">
          {sessionData.matchTopic.split(',')[0]} — {sessionData.module}
        </Text>
        <Text className="text-slate-600 text-sm mb-3">
          {sessionData.userRole === 'helping'
            ? 'You are helping a peer in this room.'
            : 'You are receiving support from a matched peer.'}
        </Text>
        
        <View className="flex-row items-center gap-4">
          <View className="flex-row items-center">
            <View className="w-8 h-8 bg-blue-500 rounded-full mr-2" />
            <Text className="text-sm text-slate-700">
              You are: <Text className="font-semibold">{sessionData.userAnimal}</Text>
            </Text>
          </View>
          <View className="flex-row items-center">
            <View className="w-8 h-8 bg-green-500 rounded-full mr-2" />
            <Text className="text-sm text-slate-700">
              Peer: <Text className="font-semibold">{sessionData.peerAnimal}</Text>
            </Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      <ScrollView className="flex-1 px-6 py-4">
        {messages.map(message => (
          <View
            key={message.id}
            className={`mb-4 ${message.sender === 'me' ? 'items-end' : 'items-start'}`}
          >
            <View
              className={`max-w-[75%] px-4 py-3 rounded-2xl ${
                message.sender === 'me'
                  ? 'bg-blue-600 rounded-br-sm'
                  : 'bg-white border border-slate-200 rounded-bl-sm'
              }`}
            >
              <Text
                className={`text-base leading-relaxed ${
                  message.sender === 'me' ? 'text-white' : 'text-slate-900'
                }`}
              >
                {message.text}
              </Text>
            </View>
            <Text className="text-xs text-slate-400 mt-1 px-1">
              {message.time}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Action Buttons */}
      <View className="bg-white border-t-2 border-slate-100 px-4 py-3">
        <View className="flex-row gap-2 mb-3">
          <TouchableOpacity
            onPress={() => navigate('reveal')}
            className="flex-1 bg-blue-50 py-3 rounded-lg border border-blue-200"
          >
            <Text className="text-blue-600 text-center font-semibold text-sm">
              Reveal Identity
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigate('feedback')}
            className="flex-1 bg-slate-50 py-3 rounded-lg border border-slate-200"
          >
            <Text className="text-slate-700 text-center font-semibold text-sm">
              Leave Room
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowReport(true)}
            className="bg-red-50 px-4 py-3 rounded-lg border border-red-200"
          >
            <Text className="text-red-600 text-center font-semibold text-sm">
              Report
            </Text>
          </TouchableOpacity>
        </View>

        {/* Message Input */}
        <View className="flex-row gap-2">
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            className="flex-1 bg-slate-100 rounded-xl px-4 py-3 text-base text-slate-900"
            placeholder="Type a message..."
            placeholderTextColor="#94a3b8"
          />
          <TouchableOpacity
            onPress={sendMessage}
            className="bg-blue-600 w-12 h-12 rounded-xl items-center justify-center"
          >
            <Text className="text-white text-xl">→</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Report Modal */}
      {showReport && (
        <View className="absolute inset-0 bg-black/50 items-center justify-center px-6">
          <View className="bg-white rounded-2xl p-6 w-full max-w-md">
            <Text className="text-xl font-bold text-slate-900 mb-4">
              Report User
            </Text>
            <Text className="text-slate-600 mb-4">
              Why are you reporting this user?
            </Text>
            <View className="gap-2 mb-6">
              {['Inappropriate content', 'Harassment', 'Spam', 'Other'].map(reason => (
                <TouchableOpacity
                  key={reason}
                  className="bg-slate-50 py-3 px-4 rounded-lg border border-slate-200"
                >
                  <Text className="text-slate-700">{reason}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowReport(false)}
                className="flex-1 bg-slate-100 py-3 rounded-lg"
              >
                <Text className="text-slate-700 text-center font-semibold">
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowReport(false);
                  // Handle report submission
                }}
                className="flex-1 bg-red-600 py-3 rounded-lg"
              >
                <Text className="text-white text-center font-semibold">
                  Submit
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

// ============================================================================
// SCREEN 4: MUTUAL REVEAL
// ============================================================================
const RevealScreen = ({ navigate }: any) => {
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
        onPress={() => navigate('feedback')}
        className="bg-blue-600 py-5 rounded-xl mb-3"
      >
        <Text className="text-white text-center text-lg font-bold">
          Continue Chat
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigate('feedback')}
        className="py-3"
      >
        <Text className="text-slate-500 text-center font-medium">
          End Session
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ============================================================================
// SCREEN 5: FEEDBACK
// ============================================================================
const FeedbackScreen = ({ navigate, sessionData, setSessionData }: any) => {
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
            placeholder={helpful ? "What worked well?" : "What could be better?"}
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

// ============================================================================
// SCREEN 6: DASHBOARD (PwC Scoring Screen - Community Insights)
// ============================================================================
const DashboardScreen = ({ navigate, sessionData, setSessionData }: any) => {
  const activeRooms = [
    { id: 'r1', topic: 'Recursion debug clinic', module: 'CS101', people: 8, needsHelpers: true },
    { id: 'r2', topic: 'Calculus derivatives sprint', module: 'MATH201', people: 5, needsHelpers: false },
    { id: 'r3', topic: 'Lab report peer review', module: 'CHEM151', people: 6, needsHelpers: true },
  ];

  const askQueue = [
    { id: 'q1', title: 'Need help with base case logic', module: 'CS101', waiting: '2 min' },
    { id: 'q2', title: 'Quick check before quiz', module: 'PHYS102', waiting: '5 min' },
  ];

  const handleHelpNow = (room: any) => {
    setSessionData((prev: any) => ({
      ...prev,
      module: room.module,
      matchTopic: room.topic,
      userRole: 'helping',
      peerAnimal: 'Amber Owl',
    }));
    navigate('room');
  };

  return (
    <ScrollView className="flex-1 bg-slate-50">
      <View className="px-6 py-8">
        {/* Header */}
        <View className="mb-8">
          <Text className="text-sm text-blue-700 font-semibold mb-2">
            {sessionData.selectedCommunity}
          </Text>
          <Text className="text-3xl font-bold text-slate-900 mb-2">
            Community Dashboard
          </Text>
          <Text className="text-slate-600">
            Join rooms, ask for help, or support someone who is waiting
          </Text>
        </View>

        {/* Key Metrics */}
        <View className="flex-row flex-wrap gap-3 mb-6">
          <View className="flex-1 min-w-[45%] bg-white rounded-xl p-4 border-2 border-blue-100">
            <Text className="text-sm text-slate-600 mb-1">Active Rooms</Text>
            <Text className="text-3xl font-bold text-blue-600">{activeRooms.length}</Text>
          </View>
          <View className="flex-1 min-w-[45%] bg-white rounded-xl p-4 border-2 border-green-100">
            <Text className="text-sm text-slate-600 mb-1">People Waiting</Text>
            <Text className="text-3xl font-bold text-green-600">{askQueue.length}</Text>
          </View>
          <View className="flex-1 min-w-[45%] bg-white rounded-xl p-4 border-2 border-purple-100">
            <Text className="text-sm text-slate-600 mb-1">You Helped This Week</Text>
            <Text className="text-3xl font-bold text-purple-600">4</Text>
          </View>
          <View className="flex-1 min-w-[45%] bg-white rounded-xl p-4 border-2 border-orange-100">
            <Text className="text-sm text-slate-600 mb-1">Your Sessions</Text>
            <Text className="text-3xl font-bold text-orange-600">9</Text>
          </View>
        </View>

        {/* Active Rooms */}
        <View className="bg-white rounded-2xl p-6 mb-6 border-2 border-slate-100">
          <Text className="text-lg font-bold text-slate-900 mb-4">
            Rooms Active Right Now
          </Text>
          {activeRooms.map(room => (
            <View key={room.id} className="mb-4 last:mb-0 bg-slate-50 rounded-xl p-4 border border-slate-200">
              <View className="flex-row justify-between items-center mb-3">
                <View className="flex-1 pr-3">
                  <Text className="text-slate-900 font-bold">
                    {room.topic}
                  </Text>
                  <Text className="text-slate-600 text-sm">
                    {room.module} • {room.people} participants
                  </Text>
                </View>
                {room.needsHelpers && (
                  <View className="bg-amber-100 px-2 py-1 rounded-full">
                    <Text className="text-amber-700 text-xs font-semibold">Needs helpers</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                onPress={() => handleHelpNow(room)}
                className="bg-emerald-600 py-2.5 rounded-lg"
              >
                <Text className="text-white text-center font-semibold">
                  Help in this room
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* People currently waiting */}
        <View className="bg-white rounded-2xl p-6 mb-6 border-2 border-slate-100">
          <Text className="text-lg font-bold text-slate-900 mb-4">
            People Waiting For Help
          </Text>
          {askQueue.map(item => (
            <View key={item.id} className="mb-3 last:mb-0 flex-row items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3">
              <View className="flex-1 pr-2">
                <Text className="text-slate-900 font-medium">{item.title}</Text>
                <Text className="text-slate-600 text-sm">{item.module} • waiting {item.waiting}</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleHelpNow({ topic: item.title, module: item.module })}
                className="bg-emerald-100 px-3 py-2 rounded-lg border border-emerald-300"
              >
                <Text className="text-emerald-700 font-semibold text-sm">Join</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Actions */}
        <TouchableOpacity
          onPress={() => {
            setSessionData((prev: any) => ({ ...prev, userRole: 'seeking' }));
            navigate('intake');
          }}
          className="bg-blue-600 py-5 rounded-xl mb-3"
        >
          <Text className="text-white text-center text-lg font-bold">
            Ask For Help
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigate('community')}
          className="bg-white py-4 rounded-xl mb-3 border-2 border-slate-200"
        >
          <Text className="text-slate-800 text-center font-bold">
            Switch Community
          </Text>
        </TouchableOpacity>

        <View className="bg-slate-100 rounded-xl p-4 border border-slate-200">
          <Text className="text-sm text-slate-600 text-center">
            This space is always active. You can both request and provide help.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

export default App;
