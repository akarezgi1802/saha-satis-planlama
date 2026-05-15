import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../AuthContext';
import api from '../api';
import { colors } from '../theme';

import LoginScreen from '../screens/LoginScreen';
import QRScanScreen from '../screens/QRScanScreen';
import DashboardScreen from '../screens/DashboardScreen';
import MyPlanScreen from '../screens/MyPlanScreen';
import VisitDetailScreen from '../screens/VisitDetailScreen';
import AnnouncementsScreen from '../screens/AnnouncementsScreen';
import CustomersScreen from '../screens/CustomersScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AIAssistantScreen from '../screens/AIAssistantScreen';
import TabIcon from './TabIcon';

const RootStack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();
const AppStack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

const ANNOUNCEMENT_POLL_MS = 20000;
const LAST_SEEN_KEY = 'announcements_last_seen_id';

function useAnnouncementBadge() {
  const [count, setCount] = useState(0);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    let mounted = true;
    let interval;

    const check = async () => {
      try {
        const res = await api.get('/announcements/');
        const lastSeenRaw = await AsyncStorage.getItem(LAST_SEEN_KEY);
        const lastSeen = parseInt(lastSeenRaw || '0', 10);
        const unread = (res.data || []).filter(a => a.id > lastSeen).length;
        if (mounted) setCount(unread);
      } catch {}
    };

    check();
    interval = setInterval(() => {
      if (appStateRef.current === 'active') check();
    }, ANNOUNCEMENT_POLL_MS);

    const sub = AppState.addEventListener('change', (s) => {
      appStateRef.current = s;
      if (s === 'active') check();
    });

    return () => {
      mounted = false;
      clearInterval(interval);
      sub.remove();
    };
  }, []);

  return count;
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="QRScan" component={QRScanScreen} options={{ presentation: 'modal' }} />
    </AuthStack.Navigator>
  );
}

function TabsNavigator() {
  const badge = useAnnouncementBadge();
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: colors.border,
          paddingTop: 6,
          height: 64,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarIcon: ({ color, focused }) => {
          const map = {
            Home: 'home',
            Plan: 'route',
            AI: 'bot',
            Announcements: 'bell',
            Profile: 'user',
          };
          return <TabIcon name={map[route.name]} color={color} size={22} />;
        },
      })}
    >
      <Tabs.Screen name="Home" component={DashboardScreen} options={{ title: 'Ana Sayfa' }} />
      <Tabs.Screen name="Plan" component={MyPlanScreen} options={{ title: 'Planım' }} />
      <Tabs.Screen
        name="AI"
        component={AIAssistantScreen}
        options={{
          title: 'Asistan',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="bot" color={focused ? colors.brand : color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="Announcements"
        component={AnnouncementsScreen}
        options={{
          title: 'Duyurular',
          tabBarBadge: badge > 0 ? (badge > 9 ? '9+' : String(badge)) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.negative, color: '#fff', fontWeight: '700' },
        }}
      />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
    </Tabs.Navigator>
  );
}

function AppNavigator() {
  return (
    <AppStack.Navigator screenOptions={{ headerShown: false }}>
      <AppStack.Screen name="MainTabs" component={TabsNavigator} />
      <AppStack.Screen name="VisitDetail" component={VisitDetailScreen} options={{ animation: 'slide_from_right' }} />
      <AppStack.Screen name="Customers" component={CustomersScreen} options={{ animation: 'slide_from_right' }} />
    </AppStack.Navigator>
  );
}

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={{ marginTop: 12, color: colors.textSecondary, fontWeight: '600' }}>Yükleniyor…</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {user ? (
          <RootStack.Screen name="App" component={AppNavigator} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
