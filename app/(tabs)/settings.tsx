import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Switch, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useData } from '@/lib/data-context';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { settings, templates, updateAppSettings, makeDefaultTemplate, removeTemplate } = useData();
  const [businessName, setBusinessName] = useState(settings.businessName);
  const [editingName, setEditingName] = useState(false);

  const handleSaveBusinessName = useCallback(async () => {
    await updateAppSettings({ businessName: businessName.trim() });
    setEditingName(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [businessName, updateAppSettings]);

  const handleToggleAutoReply = useCallback(async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updateAppSettings({ autoReplyEnabled: value });
  }, [updateAppSettings]);

  const handleDeleteTemplate = useCallback((id: string, name: string) => {
    Alert.alert('Delete Template', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await removeTemplate(id);
        },
      },
    ]);
  }, [removeTemplate]);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 12 }]}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: (Platform.OS === 'web' ? webBottomInset : 0) + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: '#E8EEF8' }]}>
                  <Ionicons name="business-outline" size={18} color={Colors.primaryLight} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingLabel}>Business Name</Text>
                  {editingName ? (
                    <View style={styles.editRow}>
                      <TextInput
                        style={styles.editInput}
                        value={businessName}
                        onChangeText={setBusinessName}
                        placeholder="Enter your business name"
                        placeholderTextColor={Colors.textTertiary}
                        autoFocus
                        onSubmitEditing={handleSaveBusinessName}
                      />
                      <Pressable onPress={handleSaveBusinessName} hitSlop={8}>
                        <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable onPress={() => setEditingName(true)}>
                      <Text style={styles.settingValue}>
                        {settings.businessName || 'Tap to set'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
              {!editingName && (
                <Pressable onPress={() => setEditingName(true)} hitSlop={8}>
                  <Feather name="edit-2" size={16} color={Colors.textTertiary} />
                </Pressable>
              )}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Auto-Reply</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: '#E8F8ED' }]}>
                  <Ionicons name="chatbubbles-outline" size={18} color={Colors.success} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingLabel}>Auto-Reply SMS</Text>
                  <Text style={styles.settingDescription}>
                    Automatically send SMS when you miss a call
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.autoReplyEnabled}
                onValueChange={handleToggleAutoReply}
                trackColor={{ false: Colors.border, true: Colors.accent }}
                thumbColor={Colors.white}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>SMS Templates</Text>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/edit-template');
              }}
              hitSlop={8}
            >
              <Ionicons name="add-circle-outline" size={22} color={Colors.accent} />
            </Pressable>
          </View>

          {templates.map((template) => (
            <View key={template.id} style={styles.templateCard}>
              <View style={styles.templateHeader}>
                <View style={styles.templateNameRow}>
                  <Text style={styles.templateName}>{template.name}</Text>
                  {template.isDefault && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>Default</Text>
                    </View>
                  )}
                </View>
                <View style={styles.templateActions}>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push({ pathname: '/edit-template', params: { templateId: template.id } });
                    }}
                    hitSlop={8}
                  >
                    <Feather name="edit-2" size={16} color={Colors.textSecondary} />
                  </Pressable>
                  {!template.isDefault && (
                    <>
                      <Pressable
                        onPress={async () => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          await makeDefaultTemplate(template.id);
                        }}
                        hitSlop={8}
                      >
                        <Ionicons name="star-outline" size={18} color={Colors.warning} />
                      </Pressable>
                      <Pressable
                        onPress={() => handleDeleteTemplate(template.id, template.name)}
                        hitSlop={8}
                      >
                        <Feather name="trash-2" size={16} color={Colors.textTertiary} />
                      </Pressable>
                    </>
                  )}
                </View>
              </View>
              <Text style={styles.templateMessage} numberOfLines={3}>{template.message}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>TradieCatch</Text>
              <Text style={styles.aboutValue}>v1.0.0</Text>
            </View>
            <View style={styles.aboutDivider} />
            <Text style={styles.aboutDescription}>
              Never lose a customer from a missed call. Auto-reply with SMS and book jobs on the spot.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  scrollContent: {
    padding: 16,
    gap: 8,
  },
  section: {
    gap: 8,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingLeft: 4,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingContent: {
    flex: 1,
    gap: 2,
  },
  settingLabel: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  settingValue: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  settingDescription: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  editInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
    borderBottomWidth: 1,
    borderBottomColor: Colors.accent,
    paddingVertical: 4,
  },
  templateCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
    gap: 8,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  templateNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  templateName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  defaultBadge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: Colors.white,
  },
  templateActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  templateMessage: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aboutLabel: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  aboutValue: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
  },
  aboutDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 12,
  },
  aboutDescription: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
