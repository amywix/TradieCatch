import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useData } from '@/lib/data-context';

export default function EditTemplateScreen() {
  const insets = useSafeAreaInsets();
  const { templateId } = useLocalSearchParams<{ templateId?: string }>();
  const { templates, addNewTemplate, updateExistingTemplate } = useData();

  const existingTemplate = templateId ? templates.find(t => t.id === templateId) : null;
  const isEditing = !!existingTemplate;

  const [name, setName] = useState(existingTemplate?.name || '');
  const [message, setMessage] = useState(existingTemplate?.message || '');
  const [saving, setSaving] = useState(false);

  const isValid = name.trim().length > 0 && message.trim().length > 0;

  const handleSave = useCallback(async () => {
    if (!isValid) return;
    setSaving(true);

    try {
      if (isEditing && templateId) {
        await updateExistingTemplate(templateId, {
          name: name.trim(),
          message: message.trim(),
        });
      } else {
        await addNewTemplate({
          name: name.trim(),
          message: message.trim(),
          isDefault: false,
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save template. Please try again.');
      setSaving(false);
    }
  }, [isValid, isEditing, templateId, name, message, updateExistingTemplate, addNewTemplate]);

  const webTopInset = Platform.OS === 'web' ? 20 : 0;
  const charCount = message.length;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Template' : 'New Template'}</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Template Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. On a job, After hours"
            placeholderTextColor={Colors.textTertiary}
            autoFocus={!isEditing}
          />
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.fieldLabel}>Message</Text>
            <Text style={[styles.charCount, charCount > 160 && styles.charCountWarn]}>
              {charCount}/160
            </Text>
          </View>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={message}
            onChangeText={setMessage}
            placeholder="Type your auto-reply message..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
          {charCount > 160 && (
            <Text style={styles.charWarnText}>
              Messages over 160 characters may be split into multiple SMS
            </Text>
          )}
        </View>

        <View style={styles.tipsCard}>
          <Ionicons name="bulb-outline" size={18} color={Colors.warning} />
          <View style={styles.tipsContent}>
            <Text style={styles.tipsTitle}>Tips for great auto-replies</Text>
            <Text style={styles.tipsText}>
              Keep it short and friendly. Let them know you'll call back. Add your business name in Settings for a professional touch.
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: (Platform.OS === 'web' ? 20 : insets.bottom) + 12 }]}>
        <Pressable
          style={[styles.saveBtn, (!isValid || saving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!isValid || saving}
        >
          <Ionicons name="checkmark-circle" size={22} color={Colors.white} />
          <Text style={styles.saveBtnText}>
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Template'}
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
    padding: 20,
    gap: 20,
  },
  fieldGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
    paddingLeft: 4,
  },
  charCount: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textTertiary,
  },
  charCountWarn: {
    color: Colors.warning,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputMultiline: {
    minHeight: 120,
    paddingTop: 16,
  },
  charWarnText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.warning,
    paddingLeft: 4,
  },
  tipsCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFF8E0',
    borderRadius: 14,
    padding: 16,
    alignItems: 'flex-start',
  },
  tipsContent: {
    flex: 1,
    gap: 4,
  },
  tipsTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  tipsText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    lineHeight: 18,
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
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: Colors.white,
  },
});
