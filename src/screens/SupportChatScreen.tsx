import { useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  FileText,
  Headphones,
  Route,
  Send,
  ShieldCheck,
  User,
  Wallet,
  type LucideProps,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
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
const categoryIcon: Record<string, ComponentType<LucideProps>> = {
  Безопасность: ShieldCheck,
  Документы: FileText,
  Оплата: Wallet,
  Поездка: Route,
  Профиль: User,
};
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
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroTop}>
            <Pressable
              accessibilityLabel="Назад"
              accessibilityRole="button"
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <ArrowLeft color="#EAF6EF" size={21} strokeWidth={2.3} />
            </Pressable>
            <View style={styles.heroOnline}>
              <View style={styles.heroDot} />
              <Text style={styles.heroOnlineText}>На связи</Text>
            </View>
          </View>
          <View style={styles.heroMain}>
            <View style={styles.heroIcon}>
              <Headphones color="#5CE6A0" size={24} strokeWidth={2.3} />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Поддержка</Text>
              <Text numberOfLines={1} style={styles.subtitle}>Обычно отвечаем за ~5 минут</Text>
            </View>
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.compactSection}>
            <Text style={styles.sectionTitle}>Категория</Text>
            <View style={styles.categoryRow}>
              {categories.map((item) => {
                const active = item === category;
                const Icon = categoryIcon[item] ?? Route;

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    key={item}
                    onPress={() => setCategory(item)}
                    style={({ pressed }) => [
                      styles.categoryButton,
                      active && styles.categoryButtonActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Icon color={active ? '#F4FAF6' : '#008D49'} size={15} strokeWidth={2.3} />
                    <Text
                      style={[
                        styles.categoryButtonText,
                        active && styles.categoryButtonTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
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

  if (isUser) {
    return (
      <View style={[styles.messageBubble, styles.messageBubbleUser]}>
        <Text style={[styles.messageAuthor, styles.messageAuthorUser]}>Вы</Text>
        <Text style={[styles.messageText, styles.messageTextUser]}>{message.text}</Text>
      </View>
    );
  }

  return (
    <View style={styles.supportRow}>
      <View style={styles.supportAvatar}>
        <Headphones color="#5CE6A0" size={15} strokeWidth={2.3} />
      </View>
      <View style={[styles.messageBubble, isSupport && styles.messageBubbleSupport]}>
        <Text style={styles.messageAuthor}>{isSupport ? 'Поддержка' : 'Система'}</Text>
        <Text style={styles.messageText}>{message.text}</Text>
      </View>
    </View>
  );
}

const LINE = 'rgba(11, 47, 37, 0.10)';

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(92, 230, 160, 0.22)',
    borderRadius: 13,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  categoryButton: {
    alignItems: 'center',
    backgroundColor: '#F7FBF8',
    borderColor: LINE,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 38,
    paddingHorizontal: 14,
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
  hero: {
    backgroundColor: '#0A1411',
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    marginHorizontal: -16,
    marginTop: -16,
    overflow: 'hidden',
    paddingBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 22,
    position: 'relative',
  },
  heroGlow: {
    backgroundColor: 'rgba(92, 230, 160, 0.10)',
    borderRadius: 90,
    height: 180,
    position: 'absolute',
    right: -40,
    top: -30,
    width: 180,
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'relative',
    zIndex: 1,
  },
  heroOnline: {
    alignItems: 'center',
    backgroundColor: 'rgba(92, 230, 160, 0.12)',
    borderColor: 'rgba(92, 230, 160, 0.30)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroDot: {
    backgroundColor: '#B7F46A',
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  heroOnlineText: {
    color: '#5CE6A0',
    fontSize: 12.5,
    fontWeight: '600',
  },
  heroMain: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    marginTop: 18,
    position: 'relative',
    zIndex: 1,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(92, 230, 160, 0.12)',
    borderColor: 'rgba(92, 230, 160, 0.22)',
    borderRadius: 16,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
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
    flexShrink: 1,
    gap: 4,
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
    maxWidth: '86%',
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
    color: '#93BAA8',
    fontSize: 13,
    marginTop: 3,
  },
  supportAvatar: {
    alignItems: 'center',
    backgroundColor: '#0A1411',
    borderRadius: 11,
    height: 30,
    justifyContent: 'center',
    marginTop: 2,
    width: 30,
  },
  supportRow: {
    alignItems: 'flex-end',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    maxWidth: '92%',
  },
  title: {
    color: '#F2FBF6',
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});
