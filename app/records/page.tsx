'use client';

import React, { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';

interface GuestRecord {
  id: string;
  roomNumber: string;
  name: string;
  idType: string;
  idNumber: string;
  purpose: string;
  checkInDate: string;
  status: 'Checked-In' | 'Checked-Out';
}

export default function RecordsPage() {
  const [records, setRecords] = useState<GuestRecord[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('yashoda_guest_records');
    if (saved) {
      try {
        setRecords(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleCheckout = (recordId: string) => {
    const updated = records.map(r => r.id === recordId ? { ...r, status: 'Checked-Out' as const } : r);
    setRecords(updated);
    localStorage.setItem('yashoda_guest_records', JSON.stringify(updated));
  };

  return (
    <div className="p-4 max-w-xl mx-auto bg-white rounded-xl shadow-md space-y-6 my-6">
      <div className="flex items-center justify-between border-b pb-3">
        <h2 className="text-xl font-bold text-gray-800">Yashoda Lodge</h2>
      </div>

      <Navigation />

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-gray-700">Check-In Log & History</h3>
        {records.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No check-in records found yet.</p>
        ) : (
          <div className="space-y-3">
            {records.map((rec) => (
              <div key={rec.id} className="p-3 border rounded-lg bg-slate-50 space-y-1 text-xs">
                <div className="flex justify-between font-bold text-gray-800">
                  <span>Room {rec.roomNumber} - {rec.name}</span>
                  <span className={rec.status === 'Checked-In' ? 'text-green-700' : 'text-slate-500'}>{rec.status}</span>
                </div>
                <p><span className="font-semibold">{rec.idType}:</span> {rec.idNumber}</p>
                <p><span className="font-semibold">Check-In Time:</span> {rec.checkInDate}</p>
                <p><span className="font-semibold">Purpose:</span> {rec.purpose}</p>
                {rec.status === 'Checked-In' && (
                  <button onClick={() => handleCheckout(rec.id)} className="mt-2 bg-red-600 text-white px-3 py-1 rounded font-bold">
                    Checkout
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
