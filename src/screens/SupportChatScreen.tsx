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
            <ArrowLeft color="#D4A853" size={20} strokeWidth={2.4} />
            <Text style={styles.backButtonText}>Назад</Text>
          </Pressable>
          <Text style={styles.roleText}>{roleCopy[role].title}</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Headphones color="#D4A853" size={30} strokeWidth={2.4} />
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
          <ShieldCheck color="#D4A853" size={20} strokeWidth={2.4} />
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
              placeholderTextColor="#A89F91"
              style={styles.input}
              value={message}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => send()}
              style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}
            >
              <Send color="#F5F0E8" size={18} strokeWidth={2.4} />
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
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: '#D4A853',
    fontSize: 14,
    fontWeight: '900',
  },
  categoryButton: {
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  categoryButtonActive: {
    backgroundColor: '#D4A853',
    borderColor: '#D4A853',
  },
  categoryButtonText: {
    color: '#F5F0E8',
    fontSize: 13,
    fontWeight: '900',
  },
  categoryButtonTextActive: {
    color: '#F5F0E8',
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chatPanel: {
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
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
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
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
    backgroundColor: '#37322E',
    borderRadius: 8,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  input: {
    backgroundColor: '#2C2926',
    borderColor: '#A89F91',
    borderRadius: 8,
    borderWidth: 1,
    color: '#F5F0E8',
    flex: 1,
    fontSize: 15,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  messageAuthor: {
    color: '#A89F91',
    fontSize: 11,
    fontWeight: '900',
  },
  messageAuthorUser: {
    color: '#37322E',
  },
  messageBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#37322E',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    maxWidth: '92%',
    padding: 11,
  },
  messageBubbleSupport: {
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
  },
  messageBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#D4A853',
    borderColor: '#D4A853',
  },
  messages: {
    gap: 9,
  },
  messageText: {
    color: '#F5F0E8',
    fontSize: 13,
    lineHeight: 19,
  },
  messageTextUser: {
    color: '#F5F0E8',
  },
  metaLine: {
    color: '#D4A853',
    fontSize: 13,
    fontWeight: '900',
  },
  page: {
    backgroundColor: '#1E1C1A',
    gap: 16,
    minHeight: '100%',
    padding: 16,
  },
  panel: {
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.95 }],
  },
  quickButton: {
    backgroundColor: '#37322E',
    borderColor: '#D4A853',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  quickButtonText: {
    color: '#F5F0E8',
    fontSize: 13,
    fontWeight: '900',
  },
  quickList: {
    gap: 8,
  },
  roleText: {
    color: '#D4A853',
    fontSize: 14,
    fontWeight: '900',
  },
  safeArea: {
    backgroundColor: '#1E1C1A',
    flex: 1,
  },
  sectionTitle: {
    color: '#F5F0E8',
    fontSize: 18,
    fontWeight: '900',
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#D4A853',
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  serverBox: {
    alignItems: 'flex-start',
    backgroundColor: '#2C2926',
    borderColor: '#D4A853',
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
    color: '#A89F91',
    fontSize: 13,
    lineHeight: 19,
  },
  serverTitle: {
    color: '#D4A853',
    fontSize: 15,
    fontWeight: '900',
  },
  subtitle: {
    color: '#A89F91',
    fontSize: 15,
    lineHeight: 22,
  },
  title: {
    color: '#F5F0E8',
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
