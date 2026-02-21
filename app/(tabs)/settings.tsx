import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Switch, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useData } from '@/lib/data-context';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { settings, updateAppSettings } = useData();
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
          <Text style={styles.sectionTitle}>SMS Flow</Text>
          <View style={styles.card}>
            <View style={styles.flowStep}>
              <View style={[styles.flowStepNumber, { backgroundColor: Colors.accent }]}>
                <Text style={styles.flowStepNumberText}>1</Text>
              </View>
              <View style={styles.flowStepContent}>
                <Text style={styles.flowStepTitle}>Initial SMS</Text>
                <Text style={styles.flowStepDesc}>Missed call greeting with service menu</Text>
              </View>
            </View>
            <View style={styles.flowDivider} />
            <View style={styles.flowStep}>
              <View style={[styles.flowStepNumber, { backgroundColor: Colors.warning }]}>
                <Text style={styles.flowStepNumberText}>2</Text>
              </View>
              <View style={styles.flowStepContent}>
                <Text style={styles.flowStepTitle}>Service Selection</Text>
                <Text style={styles.flowStepDesc}>Customer picks their service need</Text>
              </View>
            </View>
            <View style={styles.flowDivider} />
            <View style={styles.flowStep}>
              <View style={[styles.flowStepNumber, { backgroundColor: Colors.primaryLight }]}>
                <Text style={styles.flowStepNumberText}>3</Text>
              </View>
              <View style={styles.flowStepContent}>
                <Text style={styles.flowStepTitle}>Job Details</Text>
                <Text style={styles.flowStepDesc}>Collect address and preferred time</Text>
              </View>
            </View>
            <View style={styles.flowDivider} />
            <View style={styles.flowStep}>
              <View style={[styles.flowStepNumber, { backgroundColor: Colors.success }]}>
                <Text style={styles.flowStepNumberText}>4</Text>
              </View>
              <View style={styles.flowStepContent}>
                <Text style={styles.flowStepTitle}>Booking Confirmed</Text>
                <Text style={styles.flowStepDesc}>Job auto-created in your Jobs tab</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Services Offered</Text>
          <View style={styles.card}>
            {[
              { num: '1', service: 'Power point install / repair' },
              { num: '2', service: 'Ceiling fan install' },
              { num: '3', service: 'Lights not working' },
              { num: '4', service: 'Switchboard issue' },
              { num: '5', service: 'Power outage / urgent fault' },
              { num: '6', service: 'Smoke alarm install' },
              { num: '7', service: 'Other (customer describes)' },
            ].map((item, idx) => (
              <View key={item.num}>
                {idx > 0 && <View style={styles.serviceDivider} />}
                <View style={styles.serviceRow}>
                  <View style={styles.serviceNum}>
                    <Text style={styles.serviceNumText}>{item.num}</Text>
                  </View>
                  <Text style={styles.serviceText}>{item.service}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Twilio Connection</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: settings.twilioAccountSid ? '#E8F8ED' : '#FFEEEE' }]}>
                  <Ionicons
                    name={settings.twilioAccountSid ? 'checkmark-circle' : 'alert-circle-outline'}
                    size={18}
                    color={settings.twilioAccountSid ? Colors.success : Colors.danger}
                  />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingLabel}>SMS Status</Text>
                  <Text style={styles.settingValue}>
                    {settings.twilioAccountSid ? 'Connected' : 'Not configured'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Twilio Webhook</Text>
          <View style={styles.card}>
            <View style={styles.webhookInfo}>
              <Ionicons name="information-circle-outline" size={18} color={Colors.primaryLight} />
              <Text style={styles.webhookText}>
                Set your Twilio incoming SMS webhook URL to:{'\n'}
                <Text style={styles.webhookUrl}>[your-app-url]/api/twilio/webhook</Text>
              </Text>
            </View>
          </View>
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
  flowStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flowStepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowStepNumberText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: Colors.white,
  },
  flowStepContent: {
    flex: 1,
    gap: 1,
  },
  flowStepTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  flowStepDesc: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  flowDivider: {
    width: 2,
    height: 16,
    backgroundColor: Colors.borderLight,
    marginLeft: 13,
    marginVertical: 2,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  serviceNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceNumText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  serviceText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
    flex: 1,
  },
  serviceDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 4,
  },
  webhookInfo: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  webhookText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  webhookUrl: {
    fontFamily: 'Inter_600SemiBold',
    color: Colors.accent,
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
