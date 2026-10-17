export interface GuestRecord {
  id: string;
  roomNumber: string;
  name: string;
  idType?: string;
  idNumber: string;
  dob?: string;
  address?: string;
  purpose?: string;
  checkInDate?: string;
  status: 'Checked-In' | 'Checked-Out';
}

const DB_NAME = 'yashoda-guest-db';
const STORE_NAME = 'guest-records';
const LEGACY_KEY = 'yashoda_guest_records';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

export async function loadGuestRecords(): Promise<GuestRecord[]> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const result = await requestToPromise<GuestRecord[] | undefined>(store.get('records'));

    if (result && Array.isArray(result)) {
      return result;
    }

    const legacy = typeof window !== 'undefined' ? window.localStorage.getItem(LEGACY_KEY) : null;
    if (!legacy) return [];

    try {
      const parsed = JSON.parse(legacy) as GuestRecord[];
      if (Array.isArray(parsed)) {
        await saveGuestRecords(parsed);
        return parsed;
      }
    } catch (error) {
      console.error('Failed to parse legacy guest records', error);
    }

    return [];
  } catch (error) {
    console.error('Failed to load guest records from IndexedDB', error);
    if (typeof window !== 'undefined') {
      try {
        const legacy = window.localStorage.getItem(LEGACY_KEY);
        if (!legacy) return [];
        return JSON.parse(legacy) as GuestRecord[];
      } catch {
        return [];
      }
    }
    return [];
  }
}

export async function saveGuestRecords(records: GuestRecord[]): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    await requestToPromise(store.put(records, 'records'));
  } catch (error) {
    console.error('Failed to save guest records to IndexedDB', error);
  }

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LEGACY_KEY, JSON.stringify(records));
    } catch (error) {
      console.error('Failed to save guest records to localStorage fallback', error);
    }
  }
}
