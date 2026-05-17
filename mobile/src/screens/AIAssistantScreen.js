import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, StatusBar, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import api from '../api';
import { useAuth } from '../AuthContext';
import { colors, radius, spacing, shadow, brandGradient, positiveGradient } from '../theme';
import { Card } from '../components/ui';

const QUICK_ACTIONS = [
  { key: 'summary', icon: '📊', title: 'Bu haftaki özetim', prompt: '__activity_summary__' },
  { key: 'tips', icon: '💡', title: 'Satış teknikleri', prompt: 'Saha satışta başarılı olmak için kullanabileceğim 5 etkili teknik söyle.' },
  { key: 'objections', icon: '🛡️', title: 'İtirazlara cevap', prompt: 'Müşterilerin "fiyat çok yüksek" itirazına nasıl cevap verebilirim? 3 örnek ver.' },
  { key: 'morning', icon: '☀️', title: 'Güne hazırlık', prompt: 'Saha satış temsilcisi olarak güne en verimli nasıl başlayabilirim? Kısa madde madde anlat.' },
];

export default function AIAssistantScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [aiStatus, setAiStatus] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  useFocusEffect(useCallback(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'bot',
          text:
            `Merhaba ${user?.full_name?.split(' ')[0] || ''} 👋\n\n` +
            `Ben senin saha satış asistanınım. Sana şunlarda yardımcı olabilirim:\n\n` +
            `• 📊 Aktivite özetin\n• 🎯 Toplantıya hazırlık\n• 💬 Satış teknikleri & itirazlara cevap\n\n` +
            `Bir şey sor ya da aşağıdaki hızlı seçeneklerden birini dene.`,
        },
      ]);
    }
    api.get('/ai/status').then(r => setAiStatus(r.data)).catch(() => {});
  }, [messages.length, user]));

  const send = async (text, customMessage) => {
    const msg = (text || input).trim();
    if (!msg && !customMessage) return;

    const userMsg = customMessage || {
      id: `u-${Date.now()}`,
      role: 'user',
      text: msg,
    };

    setMessages(m => [...m, userMsg]);
    setInput('');
    setSending(true);

    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      // Özel: aktivite özeti
      if (msg === '__activity_summary__' || customMessage?.intent === 'activity_summary') {
        const r = await api.get('/ai/activity-summary', { params: { days: 7 } });
        setMessages(m => [...m, {
          id: `b-${Date.now()}`,
          role: 'bot',
          text: r.data.summary,
          meta: r.data.stats,
          ai_enabled: r.data.ai_enabled,
        }]);
      } else {
        const r = await api.post('/ai/chat', { message: msg });
        setMessages(m => [...m, {
          id: `b-${Date.now()}`,
          role: 'bot',
          text: r.data.reply,
          ai_enabled: r.data.ai_enabled,
        }]);
      }
    } catch (e) {
      setMessages(m => [...m, {
        id: `b-${Date.now()}`,
        role: 'bot',
        text: `❌ Bir hata oluştu: ${e.response?.data?.detail || e.message}`,
        error: true,
      }]);
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  const onQuickAction = (action) => {
    if (action.prompt === '__activity_summary__') {
      send('__activity_summary__', {
        id: `u-${Date.now()}`,
        role: 'user',
        text: '📊 Bu haftaki aktivite özetimi göster',
        intent: 'activity_summary',
      });
    } else {
      send(action.prompt);
    }
  };

  const renderMessage = ({ item }) => {
    if (item.role === 'user') {
      return (
        <View style={[styles.bubbleRow, { justifyContent: 'flex-end' }]}>
          <View style={[styles.bubble, styles.userBubble]}>
            <Text style={styles.userBubbleText}>{item.text}</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={[styles.bubbleRow, { justifyContent: 'flex-start' }]}>
        <View style={styles.botAvatar}>
          <Text style={{ fontSize: 14 }}>🤖</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={[styles.bubble, styles.botBubble, item.error && { borderColor: colors.negative }]}>
            <Text style={styles.botBubbleText}>{item.text}</Text>
            {item.meta ? (
              <View style={styles.statsRow}>
                <View style={styles.statTile}>
                  <Text style={styles.statVal}>{Math.round(item.meta.total_sales || 0).toLocaleString('tr-TR')} ₺</Text>
                  <Text style={styles.statLabel}>Satış</Text>
                </View>
                <View style={styles.statTile}>
                  <Text style={styles.statVal}>{item.meta.visit_count || 0}</Text>
                  <Text style={styles.statLabel}>Ziyaret</Text>
                </View>
                <View style={styles.statTile}>
                  <Text style={styles.statVal}>{item.meta.customer_count || 0}</Text>
                  <Text style={styles.statLabel}>Müşteri</Text>
                </View>
              </View>
            ) : null}
          </View>
          {item.id === 'welcome' ? (
            <View style={styles.quickActionGrid}>
              {QUICK_ACTIONS.map(a => (
                <TouchableOpacity
                  key={a.key}
                  style={styles.quickAction}
                  onPress={() => onQuickAction(a)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.quickActionIcon}>{a.icon}</Text>
                  <Text style={styles.quickActionText}>{a.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          {item.ai_enabled === false ? (
            <Text style={styles.demoTag}>demo mod · AI yapılandırılmamış</Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={brandGradient} style={[styles.hero, { paddingTop: insets.top + 10 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.85}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <View style={[styles.botBig, { marginLeft: 8 }]}>
            <Text style={{ fontSize: 24 }}>🤖</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.heroTitle}>AI Asistan</Text>
            <Text style={styles.heroSub}>
              {aiStatus?.enabled
                ? `${aiStatus.provider} · ${aiStatus.model}`
                : 'Demo mod · ücretsiz AI bekleniyor'}
            </Text>
          </View>
          <View style={[styles.statusDot, { backgroundColor: aiStatus?.enabled ? colors.positive : colors.critical }]} />
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={{ padding: 14, paddingBottom: 12 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        {sending ? (
          <View style={[styles.bubbleRow, { paddingHorizontal: 14, paddingBottom: 4 }]}>
            <View style={styles.botAvatar}><Text style={{ fontSize: 14 }}>🤖</Text></View>
            <View style={[styles.bubble, styles.botBubble, { flexDirection: 'row', alignItems: 'center' }]}>
              <ActivityIndicator size="small" color={colors.brand} />
              <Text style={{ color: colors.textSecondary, marginLeft: 8, fontSize: 12, fontWeight: '600' }}>düşünüyor…</Text>
            </View>
          </View>
        ) : null}

        <View style={[styles.inputBar, { paddingBottom: insets.bottom || 10 }]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Bir şey sor… (örn. yeni müşteriye nasıl yaklaşırım?)"
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={500}
            onSubmitEditing={() => send()}
          />
          <TouchableOpacity
            onPress={() => send()}
            disabled={!input.trim() || sending}
            style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.4 }]}
            activeOpacity={0.85}
          >
            <LinearGradient colors={brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sendBtnGrad}>
              <Text style={styles.sendBtnText}>↑</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 14, paddingBottom: 14 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { color: '#fff', fontSize: 26, fontWeight: '700', marginTop: -4 },
  heroTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600', marginTop: 2 },
  botBig: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#fff' },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end' },
  botAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.brandLight,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 6, marginBottom: 4,
  },
  bubble: { maxWidth: '85%', borderRadius: 16, padding: 12, ...shadow.sm },
  userBubble: { backgroundColor: colors.brand, borderBottomRightRadius: 4 },
  userBubbleText: { color: '#fff', fontSize: 14, fontWeight: '500', lineHeight: 20 },
  botBubble: {
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  botBubbleText: { color: colors.text, fontSize: 14, lineHeight: 21, fontWeight: '500' },
  statsRow: {
    flexDirection: 'row', marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: colors.borderLight, gap: 8,
  },
  statTile: { flex: 1, alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.sm, padding: 8 },
  statVal: { fontSize: 13, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 9, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 2 },
  quickActionGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10,
  },
  quickAction: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: colors.brand,
    borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 8,
  },
  quickActionIcon: { fontSize: 14 },
  quickActionText: { color: colors.brand, fontWeight: '700', fontSize: 12 },
  demoTag: { fontSize: 10, color: colors.textTertiary, marginTop: 4, marginLeft: 4, fontWeight: '600', fontStyle: 'italic' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 10, paddingTop: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: colors.border, gap: 8,
  },
  input: {
    flex: 1, minHeight: 42, maxHeight: 120,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: colors.bg,
    borderRadius: radius.full,
    fontSize: 14, color: colors.text,
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, overflow: 'hidden' },
  sendBtnGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: -2 },
});
