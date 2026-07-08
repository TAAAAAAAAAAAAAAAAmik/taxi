import { useCallback, useEffect, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MessagesSquare, Send } from 'lucide-react-native';
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ScreenHero } from '../components/ScreenHero';
import { RootStackParamList } from '../navigation/types';
import {
  DriverChatMessage,
  fetchDriverChatMessages,
  sendDriverChatMessage,
} from '../services/apiClient';
import { useAppState } from '../state/AppState';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverChat'>;

// Общий чат водителей района: обсуждение смен, дорог и передача заказов.
export function DriverChatScreen({ navigation, route }: Props) {
  const { firstName, role } = route.params;
  const { currentUser, drivers } = useAppState();
  const [messages, setMessages] = useState<DriverChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const myDriverId = drivers.find((driver) => driver.userId === currentUser?.id)?.id;

  const load = useCallback(() => {
    fetchDriverChatMessages()
      .then((next) => {
        setMessages(next);
        setNotice('');
      })
      .catch(() => setNotice('Чат работает при подключенном backend.'));
  }, []);

  useEffect(() => {
    load();
    // Простое живое обновление: раз в 6 секунд (realtime-события дополняют snapshot).
    const timer = setInterval(load, 6000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [messages.length]);

  const send = async () => {
    const text = draft.trim();

    if (!text || busy) {
      return;
    }

    setBusy(true);

    try {
      const message = await sendDriverChatMessage(text);
      setMessages((current) => [...current, message]);
      setDraft('');
      setNotice('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не удалось отправить сообщение.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <ScreenHero
          Icon={MessagesSquare}
          bleed={0}
          onBack={() => navigation.goBack()}
          onMenu={() => navigation.navigate('Dashboard', { firstName, role })}
          subtitle="Смены, дороги и взаимовыручка — без клиентов"
          title="Чат водителей"
        />

        <ScrollView
          contentContainerStyle={styles.messages}
          ref={scrollRef}
          style={styles.messagesScroll}
        >
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {messages.length === 0 && !notice ? (
            <Text style={styles.empty}>Пока тишина. Напишите первым — вас увидят все водители.</Text>
          ) : null}
          {messages.map((message) => {
            const mine = message.driverId === myDriverId;

            return (
              <View key={message.id} style={[styles.messageRow, mine && styles.messageRowMine]}>
                {!mine ? (
                  <View style={styles.msgAvatar}>
                    {message.avatar ? (
                      <Image source={{ uri: message.avatar }} style={styles.msgAvatarImage} />
                    ) : (
                      <Text style={styles.msgAvatarText}>
                        {(message.driverName || '·').slice(0, 1).toUpperCase()}
                      </Text>
                    )}
                  </View>
                ) : null}
                <View style={[styles.bubble, mine && styles.bubbleMine]}>
                  {!mine ? (
                    <Text numberOfLines={1} style={styles.author}>{message.driverName}</Text>
                  ) : null}
                  <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{message.text}</Text>
                  <Text style={[styles.time, mine && styles.timeMine]}>
                    {new Date(message.createdAt).toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            multiline
            onChangeText={setDraft}
            placeholder="Сообщение водителям…"
            placeholderTextColor="#71877D"
            style={styles.input}
            value={draft}
          />
          <Pressable
            accessibilityLabel="Отправить"
            accessibilityRole="button"
            disabled={busy || !draft.trim()}
            onPress={send}
            style={({ pressed }) => [
              styles.sendButton,
              (busy || !draft.trim()) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Send color="#F4FAF6" size={19} strokeWidth={2.4} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  author: { color: '#008D49', fontSize: 11, fontWeight: '900' },
  bubble: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(11, 47, 37, 0.10)',
    borderRadius: 15,
    borderTopLeftRadius: 5,
    borderWidth: 1,
    gap: 3,
    maxWidth: '82%',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  bubbleMine: {
    backgroundColor: '#008D49',
    borderColor: '#008D49',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 5,
  },
  bubbleText: { color: '#12382C', fontSize: 14, lineHeight: 20 },
  bubbleTextMine: { color: '#F4FAF6' },
  composer: {
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(11, 47, 37, 0.10)',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 9,
    padding: 12,
  },
  disabled: { opacity: 0.55 },
  empty: { color: '#71877D', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  input: {
    backgroundColor: '#F7FBF8',
    borderColor: 'rgba(11, 47, 37, 0.10)',
    borderRadius: 14,
    borderWidth: 1,
    color: '#12382C',
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    maxHeight: 110,
    minHeight: 48,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  messageRow: { flexDirection: 'row', gap: 8 },
  messageRowMine: { justifyContent: 'flex-end' },
  messages: { gap: 10, padding: 14 },
  messagesScroll: { flex: 1 },
  msgAvatar: {
    alignItems: 'center',
    backgroundColor: '#E8F3EF',
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 34,
  },
  msgAvatarImage: { height: 34, width: 34 },
  msgAvatarText: { color: '#008D49', fontSize: 14, fontWeight: '900' },
  notice: { color: '#8A6D1D', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  page: { flex: 1 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.96 }] },
  safeArea: { backgroundColor: '#F3F7F2', flex: 1 },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#008D49',
    borderRadius: 13,
    height: 48,
    justifyContent: 'center',
    width: 52,
  },
  time: { alignSelf: 'flex-end', color: '#9DB2A7', fontSize: 10, fontWeight: '700' },
  timeMine: { color: 'rgba(244, 250, 246, 0.7)' },
});
