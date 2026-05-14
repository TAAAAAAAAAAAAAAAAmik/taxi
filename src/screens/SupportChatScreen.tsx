import { useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Headphones, Send, ShieldCheck } from 'lucide-react-native';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { roleCopy } from '../data/registration';
import { RootStackParamList } from '../navigation/types';
import { getMessageServerState } from '../services/messageServer';
import { SupportMessage, useAppState } from '../state/AppState';

type Props = NativeStackScreenProps<RootStackParamList, 'SupportChat'>;

const categories = ['Поездка', 'Оплата', 'Профиль', 'Безопасность', 'Документы'];
const quickMessages = [
  'Нужна помощь по текущей поездке',
  'Хочу уточнить стоимость и чек',
  'Проблема с водителем или клиентом',
];

export function SupportChatScreen({ navigation, route }: Props) {
  const { firstName, role } = route.params;
  const [category, setCategory] = useState(route.params.category ?? categories[0]);
  const [message, setMessage] = useState('');
  const { sendSupportMessage, supportThreads } = useAppState();
  const serverState = getMessageServerState();

  const thread = useMemo(
    () =>
      supportThreads.find(
        (item) => item.role === role && item.category.toLowerCase() === category.toLowerCase(),
      ),
    [category, role, supportThreads],
  );

  const messages = thread?.messages ?? [
    {
      author: 'system',
      createdAt: new Date().toISOString(),
      id: 'intro',
      text: 'Выберите категорию и напишите сообщение. История появится здесь.',
    } satisfies SupportMessage,
  ];

  const send = (text = message) => {
    const trimmed = text.trim();

    if (!trimmed) {
      return;
    }

    sendSupportMessage({
      category,
      role,
      text: trimmed,
      title: `${category}: ${firstName?.trim() || roleCopy[role].title}`,
    });
    setMessage('');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <ArrowLeft color="#146C5D" size={20} strokeWidth={2.4} />
            <Text style={styles.backButtonText}>Назад</Text>
          </Pressable>
          <Text style={styles.roleText}>{roleCopy[role].title}</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Headphones color="#146C5D" size={30} strokeWidth={2.4} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.title}>Чат поддержки</Text>
            <Text style={styles.subtitle}>
              Простой диалог внутри приложения: категория, быстрые сообщения и история ответа.
            </Text>
            <Text style={styles.metaLine}>{firstName?.trim() || 'Пользователь'}</Text>
          </View>
        </View>

        <View style={styles.serverBox}>
          <ShieldCheck color="#146C5D" size={20} strokeWidth={2.4} />
          <View style={styles.serverCopy}>
            <Text style={styles.serverTitle}>{serverState.label}</Text>
            <Text style={styles.serverText}>{serverState.description}</Text>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Категория обращения</Text>
          <View style={styles.categoryRow}>
            {categories.map((item) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: item === category }}
                key={item}
                onPress={() => setCategory(item)}
                style={({ pressed }) => [
                  styles.categoryButton,
                  item === category && styles.categoryButtonActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.categoryButtonText,
                    item === category && styles.categoryButtonTextActive,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Быстрые действия</Text>
          <View style={styles.quickList}>
            {quickMessages.map((item) => (
              <Pressable
                accessibilityRole="button"
                key={item}
                onPress={() => send(item)}
                style={({ pressed }) => [styles.quickButton, pressed && styles.pressed]}
              >
                <Text style={styles.quickButtonText}>{item}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.chatPanel}>
          <Text style={styles.sectionTitle}>Переписка</Text>
          <View style={styles.messages}>
            {messages.map((item) => (
              <MessageBubble key={item.id} message={item} />
            ))}
          </View>

          <View style={styles.composer}>
            <TextInput
              multiline
              onChangeText={setMessage}
              placeholder="Напишите поддержке..."
              placeholderTextColor="#8A8F98"
              style={styles.input}
              value={message}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => send()}
              style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}
            >
              <Send color="#FFFFFF" size={18} strokeWidth={2.4} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MessageBubble({ message }: { message: SupportMessage }) {
  const isUser = message.author === 'user';
  const isSupport = message.author === 'support';

  return (
    <View
      style={[
        styles.messageBubble,
        isUser && styles.messageBubbleUser,
        isSupport && styles.messageBubbleSupport,
      ]}
    >
      <Text style={[styles.messageAuthor, isUser && styles.messageAuthorUser]}>
        {isUser ? 'Вы' : isSupport ? 'Поддержка' : 'Система'}
      </Text>
      <Text style={[styles.messageText, isUser && styles.messageTextUser]}>{message.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: '#146C5D',
    fontSize: 14,
    fontWeight: '900',
  },
  categoryButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  categoryButtonActive: {
    backgroundColor: '#146C5D',
    borderColor: '#146C5D',
  },
  categoryButtonText: {
    color: '#20242A',
    fontSize: 13,
    fontWeight: '900',
  },
  categoryButtonTextActive: {
    color: '#FFFFFF',
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chatPanel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  composer: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 10,
  },
  hero: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 18,
  },
  heroCopy: {
    flex: 1,
    gap: 7,
    minWidth: 0,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: '#E9F4F1',
    borderRadius: 8,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    color: '#20242A',
    flex: 1,
    fontSize: 15,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  messageAuthor: {
    color: '#59616C',
    fontSize: 11,
    fontWeight: '900',
  },
  messageAuthorUser: {
    color: '#EAF6EA',
  },
  messageBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#F8FAF9',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    maxWidth: '92%',
    padding: 11,
  },
  messageBubbleSupport: {
    backgroundColor: '#EEF5F3',
    borderColor: '#C5DDD7',
  },
  messageBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#146C5D',
    borderColor: '#146C5D',
  },
  messages: {
    gap: 9,
  },
  messageText: {
    color: '#20242A',
    fontSize: 13,
    lineHeight: 19,
  },
  messageTextUser: {
    color: '#FFFFFF',
  },
  metaLine: {
    color: '#146C5D',
    fontSize: 13,
    fontWeight: '900',
  },
  page: {
    backgroundColor: '#F4F7F5',
    gap: 16,
    minHeight: '100%',
    padding: 16,
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  pressed: {
    opacity: 0.76,
  },
  quickButton: {
    backgroundColor: '#F8FAF9',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  quickButtonText: {
    color: '#20242A',
    fontSize: 13,
    fontWeight: '900',
  },
  quickList: {
    gap: 8,
  },
  roleText: {
    color: '#146C5D',
    fontSize: 14,
    fontWeight: '900',
  },
  safeArea: {
    backgroundColor: '#F4F7F5',
    flex: 1,
  },
  sectionTitle: {
    color: '#20242A',
    fontSize: 18,
    fontWeight: '900',
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#146C5D',
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  serverBox: {
    alignItems: 'flex-start',
    backgroundColor: '#EEF5F3',
    borderColor: '#C5DDD7',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  serverCopy: {
    flex: 1,
    gap: 4,
  },
  serverText: {
    color: '#59616C',
    fontSize: 13,
    lineHeight: 19,
  },
  serverTitle: {
    color: '#0B4C42',
    fontSize: 15,
    fontWeight: '900',
  },
  subtitle: {
    color: '#59616C',
    fontSize: 15,
    lineHeight: 22,
  },
  title: {
    color: '#20242A',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 36,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
});
