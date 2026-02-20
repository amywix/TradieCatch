import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, Linking, Alert, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useData } from '@/lib/data-context';

export default function SendSmsScreen() {
  const insets = useSafeAreaInsets();
  const { callId, callerName, phoneNumber } = useLocalSearchParams<{
    callId: string;
    callerName: string;
    phoneNumber: string;
  }>();
  const { templates, settings, markCallReplied } = useData();
  const [selectedId, setSelectedId] = useState<string>(settings.defaultTemplateId);
  const [sending, setSending] = useState(false);

  const selectedTemplate = templates.find(t => t.id === selectedId);

  const handleSend = useCallback(async () => {
    if (!selectedTemplate || !callId) return;
    setSending(true);

    const cleanPhone = (phoneNumber || '').replace(/\s/g, '');
    const message = encodeURIComponent(
      settings.businessName
        ? `${selectedTemplate.message}\n\n- ${settings.businessName}`
        : selectedTemplate.message
    );

    try {
      const smsUrl = Platform.OS === 'ios'
        ? `sms:${cleanPhone}&body=${message}`
        : `sms:${cleanPhone}?body=${message}`;

      const canOpen = await Linking.canOpenURL(smsUrl);
      if (canOpen) {
        await Linking.openURL(smsUrl);
      } else {
        Alert.alert('SMS', `Message ready to send to ${phoneNumber}:\n\n${selectedTemplate.message}`);
      }

      await markCallReplied(callId, selectedTemplate.name);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert('SMS', `Message ready to send to ${phoneNumber}:\n\n${selectedTemplate.message}`);
      await markCallReplied(callId, selectedTemplate.name);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    }
  }, [selectedTemplate, callId, phoneNumber, settings.businessName, markCallReplied]);

  const webTopInset = Platform.OS === 'web' ? 20 : 0;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Send SMS</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.recipientCard}>
          <Ionicons name="person-outline" size={20} color={Colors.textSecondary} />
          <View>
            <Text style={styles.recipientName}>{callerName}</Text>
            <Text style={styles.recipientPhone}>{phoneNumber}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Choose a template</Text>

        {templates.map((template) => (
          <Pressable
            key={template.id}
            style={[
              styles.templateOption,
              selectedId === template.id && styles.templateOptionSelected,
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setSelectedId(template.id);
            }}
          >
            <View style={styles.templateOptionHeader}>
              <Text style={[
                styles.templateOptionName,
                selectedId === template.id && styles.templateOptionNameSelected,
              ]}>
                {template.name}
              </Text>
              <View style={[
                styles.radio,
                selectedId === template.id && styles.radioSelected,
              ]}>
                {selectedId === template.id && <View style={styles.radioDot} />}
              </View>
            </View>
            <Text style={[
              styles.templateOptionMessage,
              selectedId === template.id && styles.templateOptionMessageSelected,
            ]}>
              {template.message}
            </Text>
          </Pressable>
        ))}

        {selectedTemplate && (
          <View style={styles.previewCard}>
            <Text style={styles.previewLabel}>Preview</Text>
            <View style={styles.previewBubble}>
              <Text style={styles.previewText}>
                {settings.businessName
                  ? `${selectedTemplate.message}\n\n- ${settings.businessName}`
                  : selectedTemplate.message}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: (Platform.OS === 'web' ? 20 : insets.bottom) + 12 }]}>
        <Pressable
          style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={sending || !selectedTemplate}
        >
          <Ionicons name="send" size={20} color={Colors.white} />
          <Text style={styles.sendBtnText}>
            {sending ? 'Sending...' : 'Send SMS'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 120,
  },
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
  },
  recipientName: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  recipientPhone: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    paddingLeft: 4,
  },
  templateOption: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 6,
  },
  templateOptionSelected: {
    borderColor: Colors.accent,
    backgroundColor: '#FFF8F4',
  },
  templateOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  templateOptionName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  templateOptionNameSelected: {
    color: Colors.accent,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: Colors.accent,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.accent,
  },
  templateOptionMessage: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  templateOptionMessageSelected: {
    color: Colors.text,
  },
  previewCard: {
    gap: 8,
    marginTop: 8,
  },
  previewLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingLeft: 4,
  },
  previewBubble: {
    backgroundColor: '#DCF8C6',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 14,
    maxWidth: '85%',
  },
  previewText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#1B2838',
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
  sendBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: Colors.white,
  },
});
