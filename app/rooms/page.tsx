'use client';

import React, { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import { useRouter } from 'next/navigation';

interface GuestRecord {
  id: string;
  roomNumber: string;
  name: string;
  idNumber: string;
  status: 'Checked-In' | 'Checked-Out';
}

const TOTAL_ROOMS = ['101', '102', '103', '104', '201', '202', '203', '204'];

export default function RoomsPage() {
  const [records, setRecords] = useState<GuestRecord[]>([]);
  const router = useRouter();

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

  const activeOccupants = records.filter(r => r.status === 'Checked-In');
  const getRoomOccupant = (roomNo: string) => activeOccupants.find(r => r.roomNumber === roomNo);

  return (
    <div className="p-4 max-w-xl mx-auto bg-white rounded-xl shadow-md space-y-6 my-6">
      <div className="flex items-center justify-between border-b pb-3">
        <h2 className="text-xl font-bold text-gray-800">Yashoda Lodge</h2>
      </div>

      <Navigation />

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-gray-700">Real-Time Room Status</h3>
        <div className="grid grid-cols-2 gap-3">
          {TOTAL_ROOMS.map((room) => {
            const occupant = getRoomOccupant(room);
            const isOccupied = Boolean(occupant);
            return (
              <div key={room} className={`p-4 rounded-xl border flex flex-col justify-between ${isOccupied ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-lg text-gray-800">Room {room}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-bold ${isOccupied ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'}`}>
                    {isOccupied ? 'Occupied' : 'Vacant'}
                  </span>
                </div>
                {isOccupied && occupant ? (
                  <div className="mt-3 space-y-1 text-xs text-gray-700">
                    <p><span className="font-semibold">Guest:</span> {occupant.name}</p>
                    <p><span className="font-semibold">ID:</span> {occupant.idNumber}</p>
                    <button
                      onClick={() => handleCheckout(occupant.id)}
                      className="mt-2 w-full bg-red-600 hover:bg-red-700 text-white py-1 rounded font-bold transition"
                    >
                      Checkout Guest
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => router.push('/checkin')}
                    className="mt-4 w-full bg-teal-700 hover:bg-teal-800 text-white py-1.5 rounded text-xs font-bold transition"
                  >
                    + Check-In Guest
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
