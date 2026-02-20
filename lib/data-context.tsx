import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import {
  MissedCall, Job, SmsTemplate, Settings,
  getMissedCalls, addMissedCall, updateMissedCall, deleteMissedCall,
  getJobs, addJob, updateJob, deleteJob,
  getTemplates, addTemplate, updateTemplate, deleteTemplate, setDefaultTemplate,
  getSettings, updateSettings,
  seedDemoData,
} from './storage';

interface DataContextValue {
  missedCalls: MissedCall[];
  jobs: Job[];
  templates: SmsTemplate[];
  settings: Settings;
  isLoading: boolean;
  refreshAll: () => Promise<void>;
  addNewCall: (call: Omit<MissedCall, 'id' | 'replied' | 'jobBooked'>) => Promise<MissedCall>;
  markCallReplied: (id: string, templateName: string) => Promise<void>;
  removeCall: (id: string) => Promise<void>;
  addNewJob: (job: Omit<Job, 'id' | 'createdAt'>) => Promise<Job>;
  updateExistingJob: (id: string, updates: Partial<Job>) => Promise<void>;
  removeJob: (id: string) => Promise<void>;
  addNewTemplate: (template: Omit<SmsTemplate, 'id'>) => Promise<SmsTemplate>;
  updateExistingTemplate: (id: string, updates: Partial<SmsTemplate>) => Promise<void>;
  removeTemplate: (id: string) => Promise<void>;
  makeDefaultTemplate: (id: string) => Promise<void>;
  updateAppSettings: (updates: Partial<Settings>) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

const DEFAULT_SETTINGS: Settings = {
  businessName: '',
  autoReplyEnabled: true,
  defaultTemplateId: 'tpl_1',
};

export function DataProvider({ children }: { children: ReactNode }) {
  const [missedCalls, setMissedCalls] = useState<MissedCall[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAll = useCallback(async () => {
    const [c, j, t, s] = await Promise.all([
      getMissedCalls(),
      getJobs(),
      getTemplates(),
      getSettings(),
    ]);
    setMissedCalls(c);
    setJobs(j);
    setTemplates(t);
    setSettings(s);
  }, []);

  useEffect(() => {
    (async () => {
      await seedDemoData();
      await refreshAll();
      setIsLoading(false);
    })();
  }, [refreshAll]);

  const addNewCall = useCallback(async (call: Omit<MissedCall, 'id' | 'replied' | 'jobBooked'>) => {
    const newCall = await addMissedCall(call);
    setMissedCalls(prev => [newCall, ...prev]);
    return newCall;
  }, []);

  const markCallReplied = useCallback(async (id: string, templateName: string) => {
    await updateMissedCall(id, { replied: true, repliedAt: Date.now(), templateUsed: templateName });
    setMissedCalls(prev => prev.map(c => c.id === id ? { ...c, replied: true, repliedAt: Date.now(), templateUsed: templateName } : c));
  }, []);

  const removeCall = useCallback(async (id: string) => {
    await deleteMissedCall(id);
    setMissedCalls(prev => prev.filter(c => c.id !== id));
  }, []);

  const addNewJob = useCallback(async (job: Omit<Job, 'id' | 'createdAt'>) => {
    const newJob = await addJob(job);
    setJobs(prev => [newJob, ...prev]);
    if (job.missedCallId) {
      await updateMissedCall(job.missedCallId, { jobBooked: true, jobId: newJob.id });
      setMissedCalls(prev => prev.map(c => c.id === job.missedCallId ? { ...c, jobBooked: true, jobId: newJob.id } : c));
    }
    return newJob;
  }, []);

  const updateExistingJob = useCallback(async (id: string, updates: Partial<Job>) => {
    await updateJob(id, updates);
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...updates } : j));
  }, []);

  const removeJob = useCallback(async (id: string) => {
    await deleteJob(id);
    setJobs(prev => prev.filter(j => j.id !== id));
  }, []);

  const addNewTemplate = useCallback(async (template: Omit<SmsTemplate, 'id'>) => {
    const newTemplate = await addTemplate(template);
    setTemplates(prev => [...prev, newTemplate]);
    return newTemplate;
  }, []);

  const updateExistingTemplate = useCallback(async (id: string, updates: Partial<SmsTemplate>) => {
    await updateTemplate(id, updates);
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const removeTemplate = useCallback(async (id: string) => {
    await deleteTemplate(id);
    setTemplates(prev => prev.filter(t => t.id !== id));
  }, []);

  const makeDefaultTemplate = useCallback(async (id: string) => {
    await setDefaultTemplate(id);
    setTemplates(prev => prev.map(t => ({ ...t, isDefault: t.id === id })));
    await updateSettings({ defaultTemplateId: id });
    setSettings(prev => ({ ...prev, defaultTemplateId: id }));
  }, []);

  const updateAppSettings = useCallback(async (updates: Partial<Settings>) => {
    await updateSettings(updates);
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const value = useMemo(() => ({
    missedCalls, jobs, templates, settings, isLoading,
    refreshAll, addNewCall, markCallReplied, removeCall,
    addNewJob, updateExistingJob, removeJob,
    addNewTemplate, updateExistingTemplate, removeTemplate, makeDefaultTemplate,
    updateAppSettings,
  }), [missedCalls, jobs, templates, settings, isLoading, refreshAll, addNewCall, markCallReplied, removeCall, addNewJob, updateExistingJob, removeJob, addNewTemplate, updateExistingTemplate, removeTemplate, makeDefaultTemplate, updateAppSettings]);

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
