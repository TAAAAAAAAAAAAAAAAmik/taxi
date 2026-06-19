import { useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Headphones, Send } from 'lucide-react-native';
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
import { SupportMessage, useAppState } from '../state/AppState';

type Props = NativeStackScreenProps<RootStackParamList, 'SupportChat'>;

const categories = ['Поездка', 'Оплата', 'Профиль', 'Безопасность', 'Документы'];
const quickMessages = [
  'Текущая поездка',
  'Стоимость и чек',
  'Проблема с участником',
];

export function SupportChatScreen({ navigation, route }: Props) {
  const { firstName, role } = route.params;
  const [category, setCategory] = useState(route.params.category ?? categories[0]);
  const [message, setMessage] = useState('');
  const { sendSupportMessage, supportThreads } = useAppState();

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
            <ArrowLeft color="#008D49" size={20} strokeWidth={2.4} />
            <Text style={styles.backButtonText}>Назад</Text>
          </Pressable>
          <Text style={styles.roleText}>{roleCopy[role].title}</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Headphones color="#008D49" size={30} strokeWidth={2.4} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.title}>Чат поддержки</Text>
            <Text style={styles.subtitle}>
              Поможем с поездкой, оплатой или профилем.
            </Text>
            <Text style={styles.metaLine}>{firstName?.trim() || 'Пользователь'}</Text>
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.compactSection}>
            <Text style={styles.sectionTitle}>Категория</Text>
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
          </View>

          <View style={styles.compactSection}>
            <Text style={styles.sectionTitle}>Быстро</Text>
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
              placeholderTextColor="#557669"
              style={styles.input}
              value={message}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => send()}
              style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}
            >
              <Send color="#12382C" size={18} strokeWidth={2.4} />
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
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: '#008D49',
    fontSize: 14,
    fontWeight: '900',
  },
  categoryButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 11,
  },
  categoryButtonActive: {
    backgroundColor: '#008D49',
    borderColor: '#008D49',
  },
  categoryButtonText: {
    color: '#12382C',
    fontSize: 13,
    fontWeight: '900',
  },
  categoryButtonTextActive: {
    color: '#F4FAF6',
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chatPanel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
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
  compactSection: {
    gap: 8,
  },
  hero: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  heroCopy: {
    flex: 1,
    gap: 7,
    minWidth: 0,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: '#E8F3EF',
    borderRadius: 8,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#557669',
    borderRadius: 8,
    borderWidth: 1,
    color: '#12382C',
    flex: 1,
    fontSize: 15,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  messageAuthor: {
    color: '#557669',
    fontSize: 11,
    fontWeight: '900',
  },
  messageAuthorUser: {
    color: '#E8F3EF',
  },
  messageBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F3EF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    maxWidth: '92%',
    padding: 11,
  },
  messageBubbleSupport: {
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
  },
  messageBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#008D49',
    borderColor: '#008D49',
  },
  messages: {
    gap: 9,
  },
  messageText: {
    color: '#12382C',
    fontSize: 13,
    lineHeight: 19,
  },
  messageTextUser: {
    color: '#F4FAF6',
  },
  metaLine: {
    color: '#008D49',
    fontSize: 13,
    fontWeight: '900',
  },
  page: {
    backgroundColor: '#F4FAF6',
    gap: 16,
    minHeight: '100%',
    padding: 16,
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 14,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.95 }],
  },
  quickButton: {
    backgroundColor: '#E8F3EF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  quickButtonText: {
    color: '#12382C',
    fontSize: 13,
    fontWeight: '900',
  },
  quickList: {
    gap: 8,
  },
  roleText: {
    color: '#008D49',
    fontSize: 14,
    fontWeight: '900',
  },
  safeArea: {
    backgroundColor: '#F4FAF6',
    flex: 1,
  },
  sectionTitle: {
    color: '#12382C',
    fontSize: 15,
    fontWeight: '900',
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#008D49',
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  subtitle: {
    color: '#557669',
    fontSize: 15,
    lineHeight: 22,
  },
  title: {
    color: '#12382C',
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 32,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
});
