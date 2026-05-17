import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useAuth } from '../AuthContext';
import { colors } from '../theme';

import LoginScreen from '../screens/LoginScreen';
import QRScanScreen from '../screens/QRScanScreen';
import DashboardScreen from '../screens/DashboardScreen';
import MyPlanScreen from '../screens/MyPlanScreen';
import VisitDetailScreen from '../screens/VisitDetailScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import CustomersScreen from '../screens/CustomersScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AIAssistantScreen from '../screens/AIAssistantScreen';
import TasksScreen from '../screens/TasksScreen';
import PerformanceScreen from '../screens/PerformanceScreen';
import TabIcon from './TabIcon';

const RootStack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();
const AppStack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="QRScan" component={QRScanScreen} options={{ presentation: 'modal' }} />
    </AuthStack.Navigator>
  );
}

function TabsNavigator() {
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
        tabBarIcon: ({ color }) => {
          const map = {
            Home: 'home',
            Plan: 'route',
            Customers: 'users',
            Tasks: 'tasks',
            Performance: 'trophy',
          };
          return <TabIcon name={map[route.name]} color={color} size={22} />;
        },
      })}
    >
      <Tabs.Screen name="Home" component={DashboardScreen} options={{ title: 'Ana Sayfa' }} />
      <Tabs.Screen name="Plan" component={MyPlanScreen} options={{ title: 'Planım' }} />
      <Tabs.Screen name="Customers" component={CustomersScreen} options={{ title: 'Müşteriler' }} />
      <Tabs.Screen name="Tasks" component={TasksScreen} options={{ title: 'Görevler' }} />
      <Tabs.Screen name="Performance" component={PerformanceScreen} options={{ title: 'Performans' }} />
    </Tabs.Navigator>
  );
}

function AppNavigator() {
  return (
    <AppStack.Navigator screenOptions={{ headerShown: false }}>
      <AppStack.Screen name="MainTabs" component={TabsNavigator} />
      <AppStack.Screen name="VisitDetail" component={VisitDetailScreen} options={{ animation: 'slide_from_right' }} />

      {/* Eskiden tab'taydı, artık header butonlarından açılan stack ekranları */}
      <AppStack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'slide_from_right', presentation: 'card' }} />
      <AppStack.Screen name="AIAssistant" component={AIAssistantScreen} options={{ animation: 'slide_from_right', presentation: 'card' }} />
      <AppStack.Screen name="Profile" component={ProfileScreen} options={{ animation: 'slide_from_right', presentation: 'card' }} />
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
