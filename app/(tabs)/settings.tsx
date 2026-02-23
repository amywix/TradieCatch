import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Switch, Platform,
  Alert,
} from 'react-native';
import * as ExpoClipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useData } from '@/lib/data-context';
import { useSubscription } from '@/lib/subscription-context';
import { useAuth } from '@/lib/auth-context';
import { apiRequest } from '@/lib/query-client';
import { router } from 'expo-router';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { settings, updateAppSettings, updateServices } = useData();
  const { isPro } = useSubscription();
  const { user, logout } = useAuth();
  const [businessName, setBusinessName] = useState(settings.businessName);
  const [editingName, setEditingName] = useState(false);
  const [editingServiceIdx, setEditingServiceIdx] = useState<number | null>(null);
  const [editingServiceText, setEditingServiceText] = useState('');
  const [addingService, setAddingService] = useState(false);
  const [newServiceText, setNewServiceText] = useState('');
  const [webhookCopied, setWebhookCopied] = useState<'sms' | 'voice' | false>(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [voiceWebhookUrl, setVoiceWebhookUrl] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest('GET', '/api/config');
        const data = await res.json();
        if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
        if (data.voiceWebhookUrl) setVoiceWebhookUrl(data.voiceWebhookUrl);
      } catch (e) {}
    })();
  }, []);

  const services = settings.services || [];

  const handleSaveBusinessName = useCallback(async () => {
    await updateAppSettings({ businessName: businessName.trim() });
    setEditingName(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [businessName, updateAppSettings]);

  const handleToggleAutoReply = useCallback(async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updateAppSettings({ autoReplyEnabled: value });
  }, [updateAppSettings]);

  const handleToggleBookingCalendar = useCallback(async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updateAppSettings({ bookingCalendarEnabled: value });
  }, [updateAppSettings]);

  const bookingSlots = settings.bookingSlots || ["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"];
  const [editingSlotIdx, setEditingSlotIdx] = useState<number | null>(null);
  const [editingSlotText, setEditingSlotText] = useState('');
  const [addingSlot, setAddingSlot] = useState(false);
  const [newSlotText, setNewSlotText] = useState('');

  const handleSaveSlotEdit = useCallback(async () => {
    if (editingSlotIdx === null) return;
    const trimmed = editingSlotText.trim();
    if (!trimmed) return;
    const updated = [...bookingSlots];
    updated[editingSlotIdx] = trimmed;
    await updateAppSettings({ bookingSlots: updated });
    setEditingSlotIdx(null);
    setEditingSlotText('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [editingSlotIdx, editingSlotText, bookingSlots, updateAppSettings]);

  const handleAddSlot = useCallback(async () => {
    const trimmed = newSlotText.trim();
    if (!trimmed) return;
    const updated = [...bookingSlots, trimmed];
    await updateAppSettings({ bookingSlots: updated });
    setNewSlotText('');
    setAddingSlot(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [newSlotText, bookingSlots, updateAppSettings]);

  const handleDeleteSlot = useCallback(async (idx: number) => {
    if (bookingSlots.length <= 1) {
      Alert.alert("Can't Remove", "You need at least one time slot.");
      return;
    }
    const updated = bookingSlots.filter((_: string, i: number) => i !== idx);
    await updateAppSettings({ bookingSlots: updated });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [bookingSlots, updateAppSettings]);

  const handleEditService = useCallback((idx: number) => {
    setEditingServiceIdx(idx);
    setEditingServiceText(services[idx]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [services]);

  const handleSaveServiceEdit = useCallback(async () => {
    if (editingServiceIdx === null) return;
    const trimmed = editingServiceText.trim();
    if (!trimmed) return;
    const updated = [...services];
    updated[editingServiceIdx] = trimmed;
    await updateServices(updated);
    setEditingServiceIdx(null);
    setEditingServiceText('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [editingServiceIdx, editingServiceText, services, updateServices]);

  const handleDeleteService = useCallback(async (idx: number) => {
    if (services.length <= 1) {
      Alert.alert("Can't Remove", "You need at least one service.");
      return;
    }
    Alert.alert(
      'Remove Service',
      `Remove "${services[idx]}" from your services?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const updated = services.filter((_, i) => i !== idx);
            await updateServices(updated);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  }, [services, updateServices]);

  const handleAddService = useCallback(async () => {
    const trimmed = newServiceText.trim();
    if (!trimmed) return;
    const updated = [...services, trimmed];
    await updateServices(updated);
    setNewServiceText('');
    setAddingService(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [newServiceText, services, updateServices]);

  const handleMoveService = useCallback(async (idx: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= services.length) return;
    const updated = [...services];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    await updateServices(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [services, updateServices]);

  const displayWebhookUrl = webhookUrl || '[your-app-url]/api/twilio/webhook';
  const displayVoiceWebhookUrl = voiceWebhookUrl || '[your-app-url]/api/twilio/voice';

  const handleCopyUrl = useCallback(async (url: string, type: 'sms' | 'voice') => {
    if (!url || url.startsWith('[')) {
      Alert.alert('Not Available Yet', 'The webhook URL will appear once your app is published and live.');
      return;
    }
    await ExpoClipboard.setStringAsync(url);
    setWebhookCopied(type);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setWebhookCopied(false), 2000);
  }, []);

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
          <Text style={styles.sectionTitle}>Subscription</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: isPro ? '#E8F8ED' : '#FFF0E8' }]}>
                  <Ionicons
                    name={isPro ? 'shield-checkmark' : 'flash'}
                    size={18}
                    color={isPro ? Colors.success : Colors.accent}
                  />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingLabel}>{isPro ? 'TradieCatch Pro' : 'No Active Subscription'}</Text>
                  <Text style={styles.settingDescription}>
                    {isPro ? 'Your subscription is active' : 'Subscribe to continue using TradieCatch'}
                  </Text>
                </View>
              </View>
              {!isPro && (
                <Pressable
                  style={styles.upgradeBtn}
                  onPress={() => router.push('/paywall')}
                >
                  <Text style={styles.upgradeBtnText}>Upgrade</Text>
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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Services Offered</Text>
            <Pressable
              style={styles.addButton}
              onPress={() => { setAddingService(true); setNewServiceText(''); }}
              hitSlop={8}
            >
              <Ionicons name="add-circle" size={22} color={Colors.accent} />
            </Pressable>
          </View>
          <Text style={styles.sectionHint}>
            These are the services shown to customers when they reply to your SMS. Tap to edit, swipe to remove.
          </Text>
          <View style={styles.card}>
            {services.map((service, idx) => (
              <View key={`service-${idx}`}>
                {idx > 0 && <View style={styles.serviceDivider} />}
                {editingServiceIdx === idx ? (
                  <View style={styles.serviceEditRow}>
                    <View style={styles.serviceNum}>
                      <Text style={styles.serviceNumText}>{idx + 1}</Text>
                    </View>
                    <TextInput
                      style={styles.serviceEditInput}
                      value={editingServiceText}
                      onChangeText={setEditingServiceText}
                      autoFocus
                      onSubmitEditing={handleSaveServiceEdit}
                      placeholder="Service name"
                      placeholderTextColor={Colors.textTertiary}
                    />
                    <Pressable onPress={handleSaveServiceEdit} hitSlop={8}>
                      <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
                    </Pressable>
                    <Pressable onPress={() => { setEditingServiceIdx(null); setEditingServiceText(''); }} hitSlop={8}>
                      <Ionicons name="close-circle" size={22} color={Colors.textTertiary} />
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.serviceRow}>
                    <View style={styles.serviceNum}>
                      <Text style={styles.serviceNumText}>{idx + 1}</Text>
                    </View>
                    <Pressable style={styles.serviceTextWrap} onPress={() => handleEditService(idx)}>
                      <Text style={styles.serviceText}>{service}</Text>
                    </Pressable>
                    <View style={styles.serviceActions}>
                      {idx > 0 && (
                        <Pressable onPress={() => handleMoveService(idx, 'up')} hitSlop={6}>
                          <Ionicons name="chevron-up" size={18} color={Colors.textTertiary} />
                        </Pressable>
                      )}
                      {idx < services.length - 1 && (
                        <Pressable onPress={() => handleMoveService(idx, 'down')} hitSlop={6}>
                          <Ionicons name="chevron-down" size={18} color={Colors.textTertiary} />
                        </Pressable>
                      )}
                      <Pressable onPress={() => handleEditService(idx)} hitSlop={6}>
                        <Feather name="edit-2" size={14} color={Colors.textTertiary} />
                      </Pressable>
                      <Pressable onPress={() => handleDeleteService(idx)} hitSlop={6}>
                        <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            ))}

            {addingService && (
              <>
                <View style={styles.serviceDivider} />
                <View style={styles.serviceEditRow}>
                  <View style={[styles.serviceNum, { backgroundColor: Colors.accent + '20' }]}>
                    <Ionicons name="add" size={14} color={Colors.accent} />
                  </View>
                  <TextInput
                    style={styles.serviceEditInput}
                    value={newServiceText}
                    onChangeText={setNewServiceText}
                    autoFocus
                    onSubmitEditing={handleAddService}
                    placeholder="New service name"
                    placeholderTextColor={Colors.textTertiary}
                  />
                  <Pressable onPress={handleAddService} hitSlop={8}>
                    <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
                  </Pressable>
                  <Pressable onPress={() => { setAddingService(false); setNewServiceText(''); }} hitSlop={8}>
                    <Ionicons name="close-circle" size={22} color={Colors.textTertiary} />
                  </Pressable>
                </View>
              </>
            )}
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
          <Text style={styles.sectionTitle}>Webhook Setup Guide</Text>
          <View style={styles.card}>
            <View style={styles.webhookIntro}>
              <Ionicons name="information-circle" size={20} color={Colors.primaryLight} />
              <Text style={styles.webhookIntroText}>
                To auto-log missed calls and send SMS replies, you need to set up two webhooks in your Twilio account. Follow these steps:
              </Text>
            </View>

            <View style={styles.webhookStepsDivider} />

            <View style={styles.webhookStep}>
              <View style={[styles.webhookStepNum, { backgroundColor: Colors.accent }]}>
                <Text style={styles.webhookStepNumText}>1</Text>
              </View>
              <View style={styles.webhookStepContent}>
                <Text style={styles.webhookStepTitle}>Log into Twilio</Text>
                <Text style={styles.webhookStepDesc}>
                  Go to twilio.com and sign in to your account. If you don't have one, create a free account.
                </Text>
              </View>
            </View>

            <View style={styles.webhookStepConnector} />

            <View style={styles.webhookStep}>
              <View style={[styles.webhookStepNum, { backgroundColor: Colors.accent }]}>
                <Text style={styles.webhookStepNumText}>2</Text>
              </View>
              <View style={styles.webhookStepContent}>
                <Text style={styles.webhookStepTitle}>Go to Phone Numbers</Text>
                <Text style={styles.webhookStepDesc}>
                  In the left menu, click "Phone Numbers" {'\u2192'} "Manage" {'\u2192'} "Active Numbers". Click on the phone number you want to use.
                </Text>
              </View>
            </View>

            <View style={styles.webhookStepConnector} />

            <View style={styles.webhookStep}>
              <View style={[styles.webhookStepNum, { backgroundColor: Colors.accent }]}>
                <Text style={styles.webhookStepNumText}>3</Text>
              </View>
              <View style={styles.webhookStepContent}>
                <Text style={styles.webhookStepTitle}>Set Up Voice (Incoming Calls)</Text>
                <Text style={styles.webhookStepDesc}>
                  In the "Voice" section, under "A call comes in", set the dropdown to "Webhook". Paste the Voice URL below. Set method to "HTTP POST".
                </Text>
              </View>
            </View>

            <View style={styles.webhookStepConnector} />

            <View style={styles.webhookStep}>
              <View style={[styles.webhookStepNum, { backgroundColor: Colors.accent }]}>
                <Text style={styles.webhookStepNumText}>4</Text>
              </View>
              <View style={styles.webhookStepContent}>
                <Text style={styles.webhookStepTitle}>Set Up Messaging (SMS Replies)</Text>
                <Text style={styles.webhookStepDesc}>
                  In the "Messaging" section, under "A message comes in", set the dropdown to "Webhook". Paste the SMS URL below. Set method to "HTTP POST".
                </Text>
              </View>
            </View>

            <View style={styles.webhookStepConnector} />

            <View style={styles.webhookStep}>
              <View style={[styles.webhookStepNum, { backgroundColor: Colors.success }]}>
                <Ionicons name="checkmark" size={14} color={Colors.white} />
              </View>
              <View style={styles.webhookStepContent}>
                <Text style={styles.webhookStepTitle}>Save</Text>
                <Text style={styles.webhookStepDesc}>
                  Click "Save" at the bottom of the page. That's it! Incoming calls will be logged as missed calls, and SMS replies will be handled automatically.
                </Text>
              </View>
            </View>

            <View style={styles.webhookStepsDivider} />

            <Text style={styles.webhookUrlLabel}>
              <Ionicons name="call-outline" size={14} color={Colors.text} />
              {'  '}Voice Webhook (incoming calls):
            </Text>
            <Pressable style={styles.webhookUrlBox} onPress={() => handleCopyUrl(voiceWebhookUrl, 'voice')}>
              <Text style={styles.webhookUrlText} numberOfLines={2}>
                {displayVoiceWebhookUrl}
              </Text>
              <View style={styles.copyButton}>
                <Ionicons
                  name={webhookCopied === 'voice' ? 'checkmark' : 'copy-outline'}
                  size={16}
                  color={webhookCopied === 'voice' ? Colors.success : Colors.accent}
                />
                <Text style={[styles.copyButtonText, webhookCopied === 'voice' && { color: Colors.success }]}>
                  {webhookCopied === 'voice' ? 'Copied!' : 'Copy'}
                </Text>
              </View>
            </Pressable>

            <View style={{ height: 12 }} />

            <Text style={styles.webhookUrlLabel}>
              <Ionicons name="chatbubble-outline" size={14} color={Colors.text} />
              {'  '}SMS Webhook (incoming text replies):
            </Text>
            <Pressable style={styles.webhookUrlBox} onPress={() => handleCopyUrl(webhookUrl, 'sms')}>
              <Text style={styles.webhookUrlText} numberOfLines={2}>
                {displayWebhookUrl}
              </Text>
              <View style={styles.copyButton}>
                <Ionicons
                  name={webhookCopied === 'sms' ? 'checkmark' : 'copy-outline'}
                  size={16}
                  color={webhookCopied === 'sms' ? Colors.success : Colors.accent}
                />
                <Text style={[styles.copyButtonText, webhookCopied === 'sms' && { color: Colors.success }]}>
                  {webhookCopied === 'sms' ? 'Copied!' : 'Copy'}
                </Text>
              </View>
            </Pressable>

            <View style={styles.webhookNote}>
              <Ionicons name="bulb-outline" size={16} color={Colors.warning} />
              <Text style={styles.webhookNoteText}>
                Make sure your app is published first. These webhook URLs only work once your app is live and accessible from the internet.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Booking Calendar</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: '#EDE8F8' }]}>
                  <Ionicons name="calendar-outline" size={18} color="#7C5CBF" />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingLabel}>Self-Service Booking</Text>
                  <Text style={styles.settingDescription}>
                    Let customers pick a date and time slot via SMS
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.bookingCalendarEnabled}
                onValueChange={handleToggleBookingCalendar}
                trackColor={{ false: Colors.border, true: Colors.accent }}
                thumbColor={Colors.white}
              />
            </View>
          </View>
          {settings.bookingCalendarEnabled && (
            <>
              <View style={[styles.sectionHeader, { marginTop: 8 }]}>
                <Text style={[styles.sectionHint, { fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary }]}>Time Slots</Text>
                <Pressable
                  style={styles.addButton}
                  onPress={() => { setAddingSlot(true); setNewSlotText(''); }}
                  hitSlop={8}
                >
                  <Ionicons name="add-circle" size={22} color={Colors.accent} />
                </Pressable>
              </View>
              <Text style={styles.sectionHint}>
                These time slots are offered to customers when they book via SMS.
              </Text>
              <View style={styles.card}>
                {bookingSlots.map((slot: string, idx: number) => (
                  <View key={`slot-${idx}`}>
                    {idx > 0 && <View style={styles.serviceDivider} />}
                    {editingSlotIdx === idx ? (
                      <View style={styles.serviceEditRow}>
                        <View style={styles.serviceNum}>
                          <Text style={styles.serviceNumText}>{idx + 1}</Text>
                        </View>
                        <TextInput
                          style={styles.serviceEditInput}
                          value={editingSlotText}
                          onChangeText={setEditingSlotText}
                          autoFocus
                          onSubmitEditing={handleSaveSlotEdit}
                          placeholder="e.g. 9:00 AM"
                          placeholderTextColor={Colors.textTertiary}
                        />
                        <Pressable onPress={handleSaveSlotEdit} hitSlop={8}>
                          <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
                        </Pressable>
                        <Pressable onPress={() => { setEditingSlotIdx(null); setEditingSlotText(''); }} hitSlop={8}>
                          <Ionicons name="close-circle" size={22} color={Colors.textTertiary} />
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.serviceRow}>
                        <View style={styles.serviceNum}>
                          <Text style={styles.serviceNumText}>{idx + 1}</Text>
                        </View>
                        <Pressable style={styles.serviceTextWrap} onPress={() => { setEditingSlotIdx(idx); setEditingSlotText(slot); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                          <Text style={styles.serviceText}>{slot}</Text>
                        </Pressable>
                        <View style={styles.serviceActions}>
                          <Pressable onPress={() => { setEditingSlotIdx(idx); setEditingSlotText(slot); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} hitSlop={6}>
                            <Feather name="edit-2" size={14} color={Colors.textTertiary} />
                          </Pressable>
                          <Pressable onPress={() => handleDeleteSlot(idx)} hitSlop={6}>
                            <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                          </Pressable>
                        </View>
                      </View>
                    )}
                  </View>
                ))}
                {addingSlot && (
                  <>
                    <View style={styles.serviceDivider} />
                    <View style={styles.serviceEditRow}>
                      <View style={[styles.serviceNum, { backgroundColor: Colors.accent + '20' }]}>
                        <Ionicons name="add" size={14} color={Colors.accent} />
                      </View>
                      <TextInput
                        style={styles.serviceEditInput}
                        value={newSlotText}
                        onChangeText={setNewSlotText}
                        autoFocus
                        onSubmitEditing={handleAddSlot}
                        placeholder="e.g. 5:00 PM"
                        placeholderTextColor={Colors.textTertiary}
                      />
                      <Pressable onPress={handleAddSlot} hitSlop={8}>
                        <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
                      </Pressable>
                      <Pressable onPress={() => { setAddingSlot(false); setNewSlotText(''); }} hitSlop={8}>
                        <Ionicons name="close-circle" size={22} color={Colors.textTertiary} />
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Call Diversion Setup</Text>
          <View style={styles.card}>
            <View style={styles.webhookIntro}>
              <Ionicons name="call-outline" size={20} color={Colors.primaryLight} />
              <Text style={styles.webhookIntroText}>
                Set up call forwarding on your mobile so unanswered calls go to your Twilio number. This triggers the auto-SMS flow.
              </Text>
            </View>

            <View style={styles.webhookStepsDivider} />

            <Text style={[styles.webhookStepTitle, { marginBottom: 8 }]}>iPhone</Text>
            <View style={styles.diversionStep}>
              <Text style={styles.diversionStepText}>1. Open your Phone app and go to <Text style={styles.diversionBold}>Settings {'>'} Phone {'>'} Call Forwarding</Text></Text>
            </View>
            <View style={styles.diversionStep}>
              <Text style={styles.diversionStepText}>2. Or dial from your phone:</Text>
            </View>
            <View style={styles.diversionCodeBox}>
              <Text style={styles.diversionCode}>**61*{settings.twilioPhoneNumber || '[your Twilio number]'}#</Text>
              <Text style={styles.diversionCodeLabel}>Forward when unanswered</Text>
            </View>
            <View style={styles.diversionCodeBox}>
              <Text style={styles.diversionCode}>**62*{settings.twilioPhoneNumber || '[your Twilio number]'}#</Text>
              <Text style={styles.diversionCodeLabel}>Forward when unreachable</Text>
            </View>
            <View style={styles.diversionCodeBox}>
              <Text style={styles.diversionCode}>**67*{settings.twilioPhoneNumber || '[your Twilio number]'}#</Text>
              <Text style={styles.diversionCodeLabel}>Forward when busy</Text>
            </View>

            <View style={styles.webhookStepsDivider} />

            <Text style={[styles.webhookStepTitle, { marginBottom: 8 }]}>Android</Text>
            <View style={styles.diversionStep}>
              <Text style={styles.diversionStepText}>1. Open the <Text style={styles.diversionBold}>Phone app {'>'} Settings {'>'} Calls {'>'} Call forwarding</Text></Text>
            </View>
            <View style={styles.diversionStep}>
              <Text style={styles.diversionStepText}>2. Set "Forward when unanswered", "Forward when busy", and "Forward when unreachable" to your Twilio number:</Text>
            </View>
            <View style={styles.diversionCodeBox}>
              <Text style={styles.diversionCode}>{settings.twilioPhoneNumber || '[your Twilio number]'}</Text>
            </View>

            <View style={styles.webhookStepsDivider} />

            <View style={styles.webhookNote}>
              <Ionicons name="bulb-outline" size={16} color={Colors.warning} />
              <Text style={styles.webhookNoteText}>
                To undo call diversion, dial ##61#, ##62#, ##67# on iPhone, or turn off forwarding in Android settings. Codes may vary by carrier.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: '#E8F0FE' }]}>
                  <Ionicons name="person-outline" size={18} color={Colors.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingLabel}>{user?.username || 'User'}</Text>
                  <Text style={styles.settingDescription}>{user?.email || ''}</Text>
                </View>
              </View>
            </View>
            <View style={styles.aboutDivider} />
            <Pressable
              style={styles.logoutRow}
              onPress={() => {
                Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                      await logout();
                    },
                  },
                ]);
              }}
              testID="logout-btn"
            >
              <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
              <Text style={styles.logoutText}>Sign Out</Text>
            </Pressable>
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingLeft: 4,
  },
  sectionHint: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
    paddingLeft: 4,
    lineHeight: 18,
  },
  addButton: {
    padding: 2,
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
    paddingVertical: 6,
  },
  serviceEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  serviceTextWrap: {
    flex: 1,
  },
  serviceText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
  },
  serviceEditInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
    borderBottomWidth: 1,
    borderBottomColor: Colors.accent,
    paddingVertical: 4,
  },
  serviceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serviceDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 4,
  },
  webhookIntro: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  webhookIntroText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  webhookStepsDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 14,
  },
  webhookStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  webhookStepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  webhookStepNumText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: Colors.white,
  },
  webhookStepContent: {
    flex: 1,
    gap: 2,
  },
  webhookStepTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  webhookStepDesc: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  webhookStepConnector: {
    width: 2,
    height: 12,
    backgroundColor: Colors.borderLight,
    marginLeft: 11,
    marginVertical: 3,
  },
  webhookUrlLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginBottom: 6,
  },
  webhookUrlBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  webhookUrlText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.accent,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  copyButtonText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.accent,
  },
  webhookNote: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    marginTop: 12,
    backgroundColor: '#FFF8E8',
    padding: 10,
    borderRadius: 8,
  },
  webhookNoteText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  upgradeBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  upgradeBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.white,
  },
  diversionStep: {
    paddingLeft: 4,
    marginBottom: 6,
  },
  diversionStepText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  diversionBold: {
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  diversionCodeBox: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    marginLeft: 4,
  },
  diversionCode: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.accent,
    letterSpacing: 0.3,
  },
  diversionCodeLabel: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
    marginTop: 3,
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
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  logoutText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.danger,
  },
});
