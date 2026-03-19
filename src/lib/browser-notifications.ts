interface BrowserNotifyJob {
  id: string;
  title: string;
  companyNameCached: string;
  matchLevel: string;
}

const STORAGE_KEY = 'radar_notified_job_ids';

function getNotifiedIds(): Set<string> {
  if (typeof window === 'undefined') {
    return new Set();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return new Set();
    }

    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveNotifiedIds(ids: Set<string>) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export async function notifyNewApplyNowJobs(jobs: BrowserNotifyJob[]) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  const notified = getNotifiedIds();

  for (const job of jobs) {
    if (job.matchLevel !== 'APPLY_NOW' || notified.has(job.id)) {
      continue;
    }

    new Notification('New Apply Now Opportunity', {
      body: `${job.title} at ${job.companyNameCached}`
    });

    notified.add(job.id);
  }

  saveNotifiedIds(notified);
}
