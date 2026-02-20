import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

export interface MissedCall {
  id: string;
  callerName: string;
  phoneNumber: string;
  timestamp: number;
  replied: boolean;
  repliedAt?: number;
  templateUsed?: string;
  jobBooked: boolean;
  jobId?: string;
}

export interface Job {
  id: string;
  callerName: string;
  phoneNumber: string;
  jobType: string;
  date: string;
  time: string;
  address: string;
  notes: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: number;
  missedCallId?: string;
}

export interface SmsTemplate {
  id: string;
  name: string;
  message: string;
  isDefault: boolean;
}

export interface Settings {
  businessName: string;
  autoReplyEnabled: boolean;
  defaultTemplateId: string;
}

const KEYS = {
  MISSED_CALLS: 'tradie_missed_calls',
  JOBS: 'tradie_jobs',
  TEMPLATES: 'tradie_templates',
  SETTINGS: 'tradie_settings',
};

const DEFAULT_TEMPLATES: SmsTemplate[] = [
  {
    id: 'tpl_1',
    name: 'On a job',
    message: "Hey! Sorry I missed your call - I'm on a job right now. I'll call you back as soon as I can.",
    isDefault: true,
  },
  {
    id: 'tpl_2',
    name: 'After hours',
    message: "Thanks for calling! I'm done for the day but I'll get back to you first thing tomorrow morning.",
    isDefault: false,
  },
  {
    id: 'tpl_3',
    name: 'Busy week',
    message: "Hi! I missed your call. I'm flat out this week but can chat during my lunch break. I'll give you a ring then.",
    isDefault: false,
  },
];

const DEFAULT_SETTINGS: Settings = {
  businessName: '',
  autoReplyEnabled: true,
  defaultTemplateId: 'tpl_1',
};

export async function getMissedCalls(): Promise<MissedCall[]> {
  const data = await AsyncStorage.getItem(KEYS.MISSED_CALLS);
  if (!data) return [];
  return JSON.parse(data);
}

export async function addMissedCall(call: Omit<MissedCall, 'id' | 'replied' | 'jobBooked'>): Promise<MissedCall> {
  const calls = await getMissedCalls();
  const newCall: MissedCall = {
    ...call,
    id: Crypto.randomUUID(),
    replied: false,
    jobBooked: false,
  };
  calls.unshift(newCall);
  await AsyncStorage.setItem(KEYS.MISSED_CALLS, JSON.stringify(calls));
  return newCall;
}

export async function updateMissedCall(id: string, updates: Partial<MissedCall>): Promise<void> {
  const calls = await getMissedCalls();
  const index = calls.findIndex(c => c.id === id);
  if (index !== -1) {
    calls[index] = { ...calls[index], ...updates };
    await AsyncStorage.setItem(KEYS.MISSED_CALLS, JSON.stringify(calls));
  }
}

export async function deleteMissedCall(id: string): Promise<void> {
  const calls = await getMissedCalls();
  const filtered = calls.filter(c => c.id !== id);
  await AsyncStorage.setItem(KEYS.MISSED_CALLS, JSON.stringify(filtered));
}

export async function getJobs(): Promise<Job[]> {
  const data = await AsyncStorage.getItem(KEYS.JOBS);
  if (!data) return [];
  return JSON.parse(data);
}

export async function addJob(job: Omit<Job, 'id' | 'createdAt'>): Promise<Job> {
  const jobs = await getJobs();
  const newJob: Job = {
    ...job,
    id: Crypto.randomUUID(),
    createdAt: Date.now(),
  };
  jobs.unshift(newJob);
  await AsyncStorage.setItem(KEYS.JOBS, JSON.stringify(jobs));
  return newJob;
}

export async function updateJob(id: string, updates: Partial<Job>): Promise<void> {
  const jobs = await getJobs();
  const index = jobs.findIndex(j => j.id === id);
  if (index !== -1) {
    jobs[index] = { ...jobs[index], ...updates };
    await AsyncStorage.setItem(KEYS.JOBS, JSON.stringify(jobs));
  }
}

export async function deleteJob(id: string): Promise<void> {
  const jobs = await getJobs();
  const filtered = jobs.filter(j => j.id !== id);
  await AsyncStorage.setItem(KEYS.JOBS, JSON.stringify(filtered));
}

export async function getTemplates(): Promise<SmsTemplate[]> {
  const data = await AsyncStorage.getItem(KEYS.TEMPLATES);
  if (!data) {
    await AsyncStorage.setItem(KEYS.TEMPLATES, JSON.stringify(DEFAULT_TEMPLATES));
    return DEFAULT_TEMPLATES;
  }
  return JSON.parse(data);
}

export async function addTemplate(template: Omit<SmsTemplate, 'id'>): Promise<SmsTemplate> {
  const templates = await getTemplates();
  const newTemplate: SmsTemplate = {
    ...template,
    id: Crypto.randomUUID(),
  };
  templates.push(newTemplate);
  await AsyncStorage.setItem(KEYS.TEMPLATES, JSON.stringify(templates));
  return newTemplate;
}

export async function updateTemplate(id: string, updates: Partial<SmsTemplate>): Promise<void> {
  const templates = await getTemplates();
  const index = templates.findIndex(t => t.id === id);
  if (index !== -1) {
    templates[index] = { ...templates[index], ...updates };
    await AsyncStorage.setItem(KEYS.TEMPLATES, JSON.stringify(templates));
  }
}

export async function deleteTemplate(id: string): Promise<void> {
  const templates = await getTemplates();
  const filtered = templates.filter(t => t.id !== id);
  await AsyncStorage.setItem(KEYS.TEMPLATES, JSON.stringify(filtered));
}

export async function setDefaultTemplate(id: string): Promise<void> {
  const templates = await getTemplates();
  const updated = templates.map(t => ({ ...t, isDefault: t.id === id }));
  await AsyncStorage.setItem(KEYS.TEMPLATES, JSON.stringify(updated));
}

export async function getSettings(): Promise<Settings> {
  const data = await AsyncStorage.getItem(KEYS.SETTINGS);
  if (!data) {
    await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    return DEFAULT_SETTINGS;
  }
  return JSON.parse(data);
}

export async function updateSettings(updates: Partial<Settings>): Promise<void> {
  const settings = await getSettings();
  const updated = { ...settings, ...updates };
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(updated));
}

export async function seedDemoData(): Promise<void> {
  const calls = await getMissedCalls();
  if (calls.length > 0) return;

  const now = Date.now();
  const demoCallsData: Omit<MissedCall, 'id'>[] = [
    {
      callerName: 'Sarah Mitchell',
      phoneNumber: '0412 345 678',
      timestamp: now - 1000 * 60 * 12,
      replied: false,
      jobBooked: false,
    },
    {
      callerName: 'Dave Thompson',
      phoneNumber: '0423 456 789',
      timestamp: now - 1000 * 60 * 45,
      replied: true,
      repliedAt: now - 1000 * 60 * 30,
      templateUsed: 'On a job',
      jobBooked: true,
      jobId: 'demo_job_1',
    },
    {
      callerName: 'Unknown Caller',
      phoneNumber: '0434 567 890',
      timestamp: now - 1000 * 60 * 60 * 3,
      replied: true,
      repliedAt: now - 1000 * 60 * 60 * 2.5,
      templateUsed: 'On a job',
      jobBooked: false,
    },
    {
      callerName: 'Jenny Park',
      phoneNumber: '0445 678 901',
      timestamp: now - 1000 * 60 * 60 * 24,
      replied: false,
      jobBooked: false,
    },
  ];

  const demoCalls: MissedCall[] = demoCallsData.map((c, i) => ({
    ...c,
    id: `demo_call_${i}`,
  }));

  const demoJobs: Job[] = [
    {
      id: 'demo_job_1',
      callerName: 'Dave Thompson',
      phoneNumber: '0423 456 789',
      jobType: 'Plumbing',
      date: '2026-02-23',
      time: '09:00',
      address: '42 Smith St, Richmond',
      notes: 'Leaking kitchen tap, needs replacement washer',
      status: 'confirmed',
      createdAt: now - 1000 * 60 * 25,
      missedCallId: 'demo_call_1',
    },
  ];

  await AsyncStorage.setItem(KEYS.MISSED_CALLS, JSON.stringify(demoCalls));
  await AsyncStorage.setItem(KEYS.JOBS, JSON.stringify(demoJobs));
}
