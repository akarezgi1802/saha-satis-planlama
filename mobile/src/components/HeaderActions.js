/**
 * Reusable header sağ kısmı: 🔔 Bildirim + 🤖 AI ikon butonları.
 * Tüm ana ekranlarda (Dashboard, Plan, Customers, Tasks, Performance) kullanılır.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AppState } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';
import { colors } from '../theme';

const POLL_MS = 30000;
const LAST_SEEN_ANN_KEY = 'announcements_last_seen_id';
const LAST_SEEN_CAMP_KEY = 'campaigns_last_seen_id';

function useUnreadBadge() {
  const [count, setCount] = useState(0);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const [annR, campR] = await Promise.all([
          api.get('/announcements/'),
          api.get('/campaigns/', { params: { active_only: true } }).catch(() => ({ data: [] })),
        ]);
        const lastAnn = parseInt((await AsyncStorage.getItem(LAST_SEEN_ANN_KEY)) || '0', 10);
        const lastCamp = parseInt((await AsyncStorage.getItem(LAST_SEEN_CAMP_KEY)) || '0', 10);
        const total = (annR.data || []).filter(a => a.id > lastAnn).length
          + (campR.data || []).filter(c => c.id > lastCamp).length;
        if (mounted) setCount(total);
      } catch {}
    };
    check();
    const i = setInterval(() => appStateRef.current === 'active' && check(), POLL_MS);
    const sub = AppState.addEventListener('change', s => { appStateRef.current = s; if (s === 'active') check(); });
    return () => { mounted = false; clearInterval(i); sub.remove(); };
  }, []);

  return count;
}

export default function HeaderActions({ tint = '#fff', dimTint = 'rgba(255,255,255,0.18)' }) {
  const navigation = useNavigation();
  const unread = useUnreadBadge();

  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={() => navigation.navigate('AIAssistant')}
        style={[styles.btn, { backgroundColor: dimTint }]}
        activeOpacity={0.85}
      >
        <Text style={[styles.icon, { color: tint }]}>🤖</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate('Notifications')}
        style={[styles.btn, { backgroundColor: dimTint }]}
        activeOpacity={0.85}
      >
        <Text style={[styles.icon, { color: tint }]}>🔔</Text>
        {unread > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  btn: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  icon: { fontSize: 18 },
  badge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 18, height: 18, borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: colors.negative,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
