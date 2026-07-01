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
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Назад"
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <ArrowLeft color="#12382C" size={22} strokeWidth={2.3} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Поддержка</Text>
            <Text numberOfLines={1} style={styles.subtitle}>Поможем с поездкой и оплатой</Text>
          </View>
          <View style={styles.headerIcon}>
            <Headphones color="#008D49" size={22} strokeWidth={2.3} />
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

const LINE = 'rgba(11, 47, 37, 0.10)';

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: LINE,
    borderRadius: 14,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  categoryButton: {
    backgroundColor: '#F7FBF8',
    borderColor: LINE,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 15,
  },
  categoryButtonActive: {
    backgroundColor: '#008D49',
    borderColor: '#008D49',
  },
  categoryButtonText: {
    color: '#12382C',
    fontSize: 13,
    fontWeight: '600',
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
    borderColor: LINE,
    borderRadius: 18,
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
    gap: 9,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 2,
    paddingTop: 2,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerIcon: {
    alignItems: 'center',
    backgroundColor: '#F7FBF8',
    borderColor: 'rgba(0, 141, 73, 0.2)',
    borderRadius: 14,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  input: {
    backgroundColor: '#F7FBF8',
    borderColor: LINE,
    borderRadius: 14,
    borderWidth: 1,
    color: '#12382C',
    flex: 1,
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  messageAuthor: {
    color: '#6E8579',
    fontSize: 11,
    fontWeight: '700',
  },
  messageAuthorUser: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  messageBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F7F3',
    borderColor: LINE,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    maxWidth: '88%',
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  messageBubbleSupport: {
    backgroundColor: '#FFFFFF',
    borderColor: LINE,
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
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextUser: {
    color: '#F4FAF6',
  },
  page: {
    backgroundColor: '#EEF4F0',
    gap: 16,
    minHeight: '100%',
    padding: 16,
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderColor: LINE,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  quickButton: {
    alignItems: 'center',
    backgroundColor: '#F7FBF8',
    borderColor: LINE,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  quickButtonText: {
    color: '#12382C',
    fontSize: 13.5,
    fontWeight: '600',
  },
  quickList: {
    gap: 8,
  },
  safeArea: {
    backgroundColor: '#EEF4F0',
    flex: 1,
  },
  sectionTitle: {
    color: '#12382C',
    fontSize: 14,
    fontWeight: '700',
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#008D49',
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  subtitle: {
    color: '#6E8579',
    fontSize: 13,
    marginTop: 2,
  },
  title: {
    color: '#12382C',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});
