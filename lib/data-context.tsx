import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { apiRequest } from './query-client';
import { useAuth } from './auth-context';

export interface MissedCall {
  id: string;
  callerName: string;
  phoneNumber: string;
  timestamp: string;
  replied: boolean;
  repliedAt: string | null;
  jobBooked: boolean;
  conversationState: string;
  selectedService: string | null;
  selectedSubOption: string | null;
  selectedTime: string | null;
  jobAddress: string | null;
  isUrgent: boolean;
  callerEmail: string | null;
  conversationLog: Array<{ role: string; message: string; timestamp: string }>;
  voicemailData?: string | null;
  voicemailDurationSeconds?: string | null;
  voicemailMimeType?: string | null;
  recordingSid?: string | null;
}

export interface Job {
  id: string;
  callerName: string;
  phoneNumber: string;
  jobType: string;
  date: string | null;
  time: string | null;
  address: string | null;
  notes: string | null;
  email: string | null;
  status: string;
  createdAt: string;
  missedCallId: string | null;
  isUrgent: boolean;
}

export interface AppSettings {
  id: string;
  businessName: string;
  autoReplyEnabled: boolean;
  onboardingComplete: boolean;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
  missedCallVoiceMessage?: string;
  voiceRecordingData?: string | null;
  voiceRecordingMimeType?: string | null;
  services: string[];
  bookingCalendarEnabled: boolean;
  bookingSlots: string[];
  bookingDates: string[];
  bookingProvider?: 'manual' | 'calendly' | 'google';
  calendlyLink?: string;
  googleCalendarLink?: string;
  conversationMessages?: Record<string, string>;
  baseAddress?: string;
  baseLat?: number | null;
  baseLng?: number | null;
  serviceRadiusKm?: number;
}

interface DataContextValue {
  missedCalls: MissedCall[];
  jobs: Job[];
  settings: AppSettings;
  isLoading: boolean;
  refreshAll: () => Promise<void>;
  refreshCalls: () => Promise<void>;
  refreshJobs: () => Promise<void>;
  addNewCall: (callerName: string, phoneNumber: string) => Promise<MissedCall>;
  removeCall: (id: string) => Promise<void>;
  sendAutoSms: (callId: string) => Promise<MissedCall>;
  getCall: (id: string) => Promise<MissedCall>;
  addNewJob: (job: any) => Promise<Job>;
  updateExistingJob: (id: string, updates: any) => Promise<void>;
  removeJob: (id: string) => Promise<void>;
  updateAppSettings: (updates: Partial<AppSettings>) => Promise<void>;
  updateServices: (services: string[]) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

const DEFAULT_SERVICES = [
  "Power point install / repair",
  "Ceiling fan install",
  "Lights not working",
  "Switchboard issue",
  "Power outage / urgent fault",
  "Smoke alarm install",
  "Other",
];

const DEFAULT_BOOKING_SLOTS = [
  "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM",
];

const DEFAULT_SETTINGS: AppSettings = {
  id: 'default',
  businessName: '',
  autoReplyEnabled: true,
  onboardingComplete: false,
  twilioAccountSid: '',
  twilioAuthToken: '',
  twilioPhoneNumber: '',
  services: DEFAULT_SERVICES,
  bookingCalendarEnabled: false,
  bookingSlots: DEFAULT_BOOKING_SLOTS,
  bookingDates: [],
  bookingProvider: 'manual',
  calendlyLink: '',
  googleCalendarLink: '',
  baseAddress: '',
  baseLat: null,
  baseLng: null,
  serviceRadiusKm: 30,
};

export function DataProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const authRef = useRef(isAuthenticated);
  authRef.current = isAuthenticated;
  const [missedCalls, setMissedCalls] = useState<MissedCall[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  const refreshCalls = useCallback(async () => {
    if (!authRef.current) return;
    try {
      const res = await apiRequest('GET', '/api/missed-calls');
      const data = await res.json();
      setMissedCalls(data);
    } catch (err) {
      console.error('Failed to fetch calls:', err);
    }
  }, []);

  const refreshJobs = useCallback(async () => {
    if (!authRef.current) return;
    try {
      const res = await apiRequest('GET', '/api/jobs');
      const data = await res.json();
      setJobs(data);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    if (!authRef.current) return;
    try {
      const res = await apiRequest('GET', '/api/settings');
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshCalls(), refreshJobs(), refreshSettings()]);
  }, [refreshCalls, refreshJobs, refreshSettings]);

  useEffect(() => {
    if (!isAuthenticated) {
      setMissedCalls([]);
      setJobs([]);
      setSettings(DEFAULT_SETTINGS);
      setIsLoading(false);
      return;
    }
    (async () => {
      setIsLoading(true);
      await refreshAll();
      setIsLoading(false);
    })();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      refreshCalls();
      refreshJobs();
    }, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated, refreshCalls, refreshJobs]);

  const addNewCall = useCallback(async (callerName: string, phoneNumber: string) => {
    const res = await apiRequest('POST', '/api/missed-calls', { callerName, phoneNumber });
    const call = await res.json();
    setMissedCalls(prev => [call, ...prev]);
    return call;
  }, []);

  const removeCall = useCallback(async (id: string) => {
    await apiRequest('DELETE', `/api/missed-calls/${id}`);
    setMissedCalls(prev => prev.filter(c => c.id !== id));
  }, []);

  const sendAutoSms = useCallback(async (callId: string) => {
    const res = await apiRequest('POST', `/api/missed-calls/${callId}/send-sms`);
    const updatedCall = await res.json();
    setMissedCalls(prev => prev.map(c => c.id === callId ? updatedCall : c));
    return updatedCall;
  }, []);

  const getCall = useCallback(async (id: string) => {
    const res = await apiRequest('GET', `/api/missed-calls/${id}`);
    return await res.json();
  }, []);

  const addNewJob = useCallback(async (job: any) => {
    const res = await apiRequest('POST', '/api/jobs', job);
    const newJob = await res.json();
    setJobs(prev => [newJob, ...prev]);
    if (job.missedCallId) {
      setMissedCalls(prev => prev.map(c => c.id === job.missedCallId ? { ...c, jobBooked: true } : c));
    }
    return newJob;
  }, []);

  const updateExistingJob = useCallback(async (id: string, updates: any) => {
    const res = await apiRequest('PATCH', `/api/jobs/${id}`, updates);
    const updated = await res.json();
    setJobs(prev => prev.map(j => j.id === id ? updated : j));
  }, []);

  const removeJob = useCallback(async (id: string) => {
    await apiRequest('DELETE', `/api/jobs/${id}`);
    setJobs(prev => prev.filter(j => j.id !== id));
  }, []);

  const updateAppSettings = useCallback(async (updates: Partial<AppSettings>) => {
    const res = await apiRequest('PATCH', '/api/settings', updates);
    const updated = await res.json();
    setSettings(updated);
  }, []);

  const updateServices = useCallback(async (services: string[]) => {
    const res = await apiRequest('PUT', '/api/services', { services });
    const updated = await res.json();
    setSettings(prev => ({ ...prev, services: updated }));
  }, []);

  const value = useMemo(() => ({
    missedCalls, jobs, settings, isLoading,
    refreshAll, refreshCalls, refreshJobs,
    addNewCall, removeCall, sendAutoSms, getCall,
    addNewJob, updateExistingJob, removeJob,
    updateAppSettings, updateServices,
  }), [missedCalls, jobs, settings, isLoading, refreshAll, refreshCalls, refreshJobs, addNewCall, removeCall, sendAutoSms, getCall, addNewJob, updateExistingJob, removeJob, updateAppSettings, updateServices]);

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
