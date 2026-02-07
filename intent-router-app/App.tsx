import React, { useState } from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import './global.css';
import CommunityScreen from './pages/CommunityScreen';
import DashboardScreen from './pages/DashboardScreen';
import FeedbackScreen from './pages/FeedbackScreen';
import HomeScreen from './pages/HomeScreen';
import IntakeScreen from './pages/IntakeScreen';
import MatchingScreen from './pages/MatchingScreen';
import RevealScreen from './pages/RevealScreen';
import RoomScreen from './pages/RoomScreen';
import { Screen, SessionData } from './types';

const App = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('community');
  const [sessionData, setSessionData] = useState<SessionData>({
    sessionId: '',
    selectedCommunityId: '',
    selectedCommunity: '',
    roomId: '',
    roomName: '',
    participantId: '',
    participantName: '',
    participantEmail: '',
    returnScreen: 'dashboard' as Screen,
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
        return (
          <CommunityScreen
            navigate={navigate}
            sessionData={sessionData}
            setSessionData={setSessionData}
          />
        );
      case 'home':
        return <HomeScreen navigate={navigate} sessionData={sessionData} />;
      case 'intake':
        return <IntakeScreen navigate={navigate} sessionData={sessionData} setSessionData={setSessionData} />;
      case 'matching':
        return <MatchingScreen navigate={navigate} sessionData={sessionData} setSessionData={setSessionData} />;
      case 'room':
        return <RoomScreen navigate={navigate} sessionData={sessionData} setSessionData={setSessionData} />;
      case 'reveal':
        return <RevealScreen navigate={navigate} sessionData={sessionData} setSessionData={setSessionData} />;
      case 'feedback':
        return <FeedbackScreen navigate={navigate} sessionData={sessionData} setSessionData={setSessionData} />;
      case 'dashboard':
        return <DashboardScreen navigate={navigate} sessionData={sessionData} setSessionData={setSessionData} />;
      default:
        return (
          <CommunityScreen
            navigate={navigate}
            sessionData={sessionData}
            setSessionData={setSessionData}
          />
        );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      {renderScreen()}
    </SafeAreaView>
  );
};
export default App;
