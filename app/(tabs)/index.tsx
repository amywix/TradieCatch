import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Platform, Alert, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { useData } from '@/lib/data-context';
import { formatTimeAgo, formatTime, getInitials, getAvatarColor } from '@/lib/helpers';
import { MissedCall } from '@/lib/storage';

function CallItem({ item, onSendSms, onBookJob, onDelete }: {
  item: MissedCall;
  onSendSms: (call: MissedCall) => void;
  onBookJob: (call: MissedCall) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.callCard}>
      <View style={styles.callRow}>
        <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.callerName) }]}>
          <Text style={styles.avatarText}>{getInitials(item.callerName)}</Text>
        </View>
        <View style={styles.callInfo}>
          <View style={styles.callHeader}>
            <Text style={styles.callerName} numberOfLines={1}>{item.callerName}</Text>
            <Text style={styles.callTime}>{formatTimeAgo(item.timestamp)}</Text>
          </View>
          <Text style={styles.phoneNumber}>{item.phoneNumber}</Text>
          <View style={styles.callMeta}>
            <View style={styles.callTimeDetail}>
              <Ionicons name="call-outline" size={12} color={Colors.danger} />
              <Text style={styles.callTimeText}>Missed at {formatTime(item.timestamp)}</Text>
            </View>
            {item.replied && (
              <View style={styles.repliedBadge}>
                <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
                <Text style={styles.repliedText}>Replied</Text>
              </View>
            )}
            {item.jobBooked && (
              <View style={styles.bookedBadge}>
                <Ionicons name="construct" size={12} color={Colors.accent} />
                <Text style={styles.bookedText}>Job booked</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.callActions}>
        {!item.replied && (
          <Pressable
            style={styles.actionBtn}
            onPress={() => onSendSms(item)}
            hitSlop={8}
          >
            <Ionicons name="chatbubble-outline" size={18} color={Colors.accent} />
            <Text style={styles.actionText}>Send SMS</Text>
          </Pressable>
        )}
        {!item.jobBooked && (
          <Pressable
            style={styles.actionBtn}
            onPress={() => onBookJob(item)}
            hitSlop={8}
          >
            <Ionicons name="calendar-outline" size={18} color={Colors.primaryLight} />
            <Text style={[styles.actionText, { color: Colors.primaryLight }]}>Book Job</Text>
          </Pressable>
        )}
        <Pressable
          style={styles.actionBtnDanger}
          onPress={() => onDelete(item.id)}
          hitSlop={8}
        >
          <Feather name="trash-2" size={16} color={Colors.textTertiary} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

export default function CallsScreen() {
  const insets = useSafeAreaInsets();
  const { missedCalls, removeCall, refreshAll, isLoading } = useData();
  const [refreshing, setRefreshing] = useState(false);

  const unrepliedCount = missedCalls.filter(c => !c.replied).length;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  }, [refreshAll]);

  const handleSendSms = useCallback((call: MissedCall) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/send-sms', params: { callId: call.id, callerName: call.callerName, phoneNumber: call.phoneNumber } });
  }, []);

  const handleBookJob = useCallback((call: MissedCall) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/book-job', params: { callId: call.id, callerName: call.callerName, phoneNumber: call.phoneNumber } });
  }, []);

  const handleDelete = useCallback((id: string) => {
    Alert.alert('Delete Call', 'Remove this missed call?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await removeCall(id);
        },
      },
    ]);
  }, [removeCall]);

  const handleAddCall = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/add-call');
  }, []);

  const renderItem = useCallback(({ item }: { item: MissedCall }) => (
    <CallItem
      item={item}
      onSendSms={handleSendSms}
      onBookJob={handleBookJob}
      onDelete={handleDelete}
    />
  ), [handleSendSms, handleBookJob, handleDelete]);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 12 }]}>
        <View>
          <Text style={styles.headerTitle}>Missed Calls</Text>
          {unrepliedCount > 0 && (
            <Text style={styles.headerSubtitle}>{unrepliedCount} unreplied</Text>
          )}
        </View>
        <Pressable onPress={handleAddCall} style={styles.addBtn} hitSlop={8}>
          <Ionicons name="add" size={28} color={Colors.accent} />
        </Pressable>
      </View>

      <FlatList
        data={missedCalls}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: (Platform.OS === 'web' ? webBottomInset : 0) + 100 },
        ]}
        scrollEnabled={!!missedCalls.length}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyState}>
              <Ionicons name="call-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>No missed calls</Text>
              <Text style={styles.emptyText}>Tap + to log a missed call manually</Text>
            </View>
          ) : null
        }
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
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
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.danger,
    marginTop: 2,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  callCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  callRow: {
    flexDirection: 'row',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: Colors.white,
  },
  callInfo: {
    flex: 1,
    gap: 4,
  },
  callHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  callerName: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  callTime: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
  },
  phoneNumber: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  callMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  callTimeDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  callTimeText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
  },
  repliedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  repliedText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.success,
  },
  bookedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  bookedText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.accent,
  },
  callActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: Colors.surfaceSecondary,
  },
  actionText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.accent,
  },
  actionBtnDanger: {
    marginLeft: 'auto',
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
});
