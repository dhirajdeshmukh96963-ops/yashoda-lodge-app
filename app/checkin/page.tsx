'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import Navigation from '@/components/Navigation';

interface GuestRecord {
  id: string;
  roomNumber: string;
  name: string;
  idType: string;
  idNumber: string;
  dob: string;
  address: string;
  purpose: string;
  checkInDate: string;
  status: 'Checked-In' | 'Checked-Out';
}

const TOTAL_ROOMS = ['101', '102', '103', '104', '201', '202', '203', '204'];

async function downscaleAndRotate(src: string, rotationDeg = 0, max = 1400): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

      let width = img.width;
      let height = img.height;

      if (rotationDeg === 90 || rotationDeg === 270) {
        canvas.width = height;
        canvas.height = width;
      } else {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotationDeg * Math.PI) / 180);
      ctx.drawImage(img, -width / 2, -height / 2);
      ctx.restore();

      const scale = Math.min(1, max / Math.max(canvas.width, canvas.height));
      const targetW = Math.round(canvas.width * scale);
      const targetH = Math.round(canvas.height * scale);

      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = targetW;
      finalCanvas.height = targetH;
      const fCtx = finalCanvas.getContext('2d', { willReadFrequently: true })!;
      fCtx.drawImage(canvas, 0, 0, targetW, targetH);

      const imgData = fCtx.getImageData(0, 0, targetW, targetH);
      const data = imgData.data;
      const contrast = 1.4;
      const intercept = 128 * (1 - contrast);

      for (let i = 0; i < data.length; i += 4) {
        let gray = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
        gray = gray * contrast + intercept;
        gray = gray < 0 ? 0 : gray > 255 ? 255 : gray;
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
      fCtx.putImageData(imgData, 0, 0);

      resolve(finalCanvas.toDataURL('image/jpeg', 0.90));
    };
  });
}

const readFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function CheckInPage() {
  const [records, setRecords] = useState<GuestRecord[]>([]);
  
  const [selectedRoom, setSelectedRoom] = useState<string>('101');
  const [idType, setIdType] = useState<string>('Aadhaar Card');
  const [name, setName] = useState<string>('');
  const [idNumber, setIdNumber] = useState<string>('');
  const [dob, setDob] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('Tourism / Leisure');

  const [frontPhoto, setFrontPhoto] = useState<string | null>(null);
  const [backPhoto, setBackPhoto] = useState<string | null>(null);
  const [scanningSide, setScanningSide] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<string>('Ready to scan');
  const [isOnline, setIsOnline] = useState<boolean>(true);

  const workerRef = useRef<any>(null);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    const saved = localStorage.getItem('yashoda_guest_records');
    if (saved) {
      try {
        setRecords(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved records', e);
      }
    }

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const saveRecordsToStorage = (updated: GuestRecord[]) => {
    setRecords(updated);
    localStorage.setItem('yashoda_guest_records', JSON.stringify(updated));
  };

  const getOrCreateWorker = async () => {
    if (workerRef.current) return workerRef.current;
    setOcrStatus('Loading Local OCR Engine...');
    try {
      const worker = await createWorker('eng', 1, { langPath: '/tessdata' });
      workerRef.current = worker;
      setOcrStatus('🟢 OCR Ready');
      return worker;
    } catch (error) {
      console.error('Failed to initialize local OCR worker:', error);
      setOcrStatus('❌ OCR Load Failed');
      throw error;
    }
  };

  const handleFrontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const processed = await downscaleAndRotate(await readFile(file), 0);
    setFrontPhoto(processed);
    e.target.value = '';
    await scanFrontCard(processed);
  };

  const handleRotateFront = async () => {
    if (!frontPhoto) return;
    const rotated = await downscaleAndRotate(frontPhoto, 90);
    setFrontPhoto(rotated);
    await scanFrontCard(rotated);
  };

  const handleBackUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const processed = await downscaleAndRotate(await readFile(file), 0);
    setBackPhoto(processed);
    e.target.value = '';
    await scanBackCard(processed);
  };

  const scanFrontCard = async (base64Image: string) => {
    setScanningSide('front');
    setOcrStatus('Scanning Front Card...');
    try {
      const worker = await getOrCreateWorker();
      const ret = await worker.recognize(base64Image);
      const text = ret.data.text || '';
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

      let detectedId = '';
      if (idType === 'PAN Card') {
        const m = text.match(/\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/);
        if (m) detectedId = m[0];
      } else {
        const m = text.match(/\b\d{4}\s\d{4}\s\d{4}\b/) || text.match(/\b\d{12}\b/);
        if (m) detectedId = typeof m === 'string' ? m : m[0];
      }

      let detectedDob = '';
      const dobIdx = lines.findIndex((l) => /DOB|Birth|YOB/i.test(l));
      if (dobIdx !== -1) {
        const dm = lines[dobIdx].match(/\b\d{2}[\/\-]\d{2}[\/\-]\d{4}\b/);
        if (dm) detectedDob = dm[0];
      }
      if (!detectedDob) {
        const gm = text.match(/\b\d{2}[\/\-]\d{2}[\/\-]\d{4}\b/);
        if (gm) detectedDob = gm[0];
      }

      let detectedName = '';
      if (dobIdx > 0) {
        for (let i = dobIdx - 1; i >= Math.max(0, dobIdx - 3); i--) {
          const c = lines[i];
          if (/^[A-Za-z\s]{3,30}\$/.test(c) && !/GOVERNMENT|INDIA|DOB|MALE|FEMALE|UIDAI/i.test(c)) {
            detectedName = c.trim();
            break;
          }
        }
      }
      if (!detectedName) {
        const clean = lines.filter((l) => /^[A-Za-z\s]{3,30}\$/.test(l) && !/GOVERNMENT|INDIA|UIDAI/i.test(l));
        if (clean.length > 0) detectedName = clean[0].trim();
      }

      if (detectedName) setName(detectedName);
      if (detectedId) setIdNumber(detectedId);
      if (detectedDob) setDob(detectedDob);
      setOcrStatus('🟢 Front Scanned (Edit fields if needed)');
    } catch (err) {
      console.error(err);
      setOcrStatus('❌ Front scan error');
    } finally {
      setScanningSide(null);
    }
  };

  const scanBackCard = async (base64Image: string) => {
    setScanningSide('back');
    setOcrStatus('Scanning Back Card...');
    try {
      const worker = await getOrCreateWorker();
      const ret = await worker.recognize(base64Image);
      const text = ret.data.text || '';
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

      let detectedAddr = '';
      const addrIdx = lines.findIndex((l) => /Address[:]?/i.test(l));
      if (addrIdx !== -1) {
        detectedAddr = lines.slice(addrIdx, addrIdx + 4).join(', ').replace(/Address[:]?/i, '').trim();
      } else {
        const pinIdx = lines.findIndex((l) => /\b\d{6}\b/.test(l));
        if (pinIdx !== -1) {
          detectedAddr = lines.slice(Math.max(0, pinIdx - 3), pinIdx + 1).join(', ');
        } else {
          detectedAddr = lines.join(', ');
        }
      }

      if (detectedAddr) setAddress(detectedAddr);
      setOcrStatus('🟢 Back Scanned (Edit fields if needed)');
    } catch (err) {
      console.error(err);
      setOcrStatus('❌ Back scan error');
    } finally {
      setScanningSide(null);
    }
  };

  const handleCheckInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !idNumber) {
      alert('Please provide at least Guest Name and ID Number.');
      return;
    }

    const newRecord: GuestRecord = {
      id: Date.now().toString(),
      roomNumber: selectedRoom,
      name,
      idType,
      idNumber,
      dob,
      address,
      purpose,
      checkInDate: new Date().toLocaleString(),
      status: 'Checked-In',
    };

    const updated = [newRecord, ...records.filter(r => r.roomNumber !== selectedRoom || r.status === 'Checked-Out')];
    saveRecordsToStorage(updated);
    alert(`Successfully checked in ${name} to Room ${selectedRoom}!`);
    
    setName('');
    setIdNumber('');
    setDob('');
    setAddress('');
    setFrontPhoto(null);
    setBackPhoto(null);
  };

  const activeOccupants = records.filter(r => r.status === 'Checked-In');
  const getRoomOccupant = (roomNo: string) => activeOccupants.find(r => r.roomNumber === roomNo);

  return (
    <div className="p-4 max-w-xl mx-auto bg-white rounded-xl shadow-md space-y-6 my-6">
      <div className="flex items-center justify-between border-b pb-3">
        <h2 className="text-xl font-bold text-gray-800">Yashoda Lodge</h2>
        <span className={`text-xs px-2 py-1 rounded font-bold ${isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {isOnline ? '🌐 Online' : '⚠️ Offline'}
        </span>
      </div>

      <Navigation />

      <div className="space-y-4">
        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border">
          <span className="text-xs font-semibold text-slate-700">{ocrStatus}</span>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700">Assign Room Number</label>
          <select
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            className="w-full mt-1 border border-gray-300 p-2 rounded-md bg-white font-bold text-teal-800"
          >
            {TOTAL_ROOMS.map((room) => {
              const occupant = getRoomOccupant(room);
              return (
                <option key={room} value={room}>
                  Room {room} {occupant ? `(Occupied: ${occupant.name})` : '🟢 Vacant'}
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700">Select ID Proof Type</label>
          <select
            value={idType}
            onChange={(e) => setIdType(e.target.value)}
            className="w-full mt-1 border border-gray-300 p-2 rounded-md bg-white font-medium"
          >
            <option value="Aadhaar Card">Aadhaar Card</option>
            <option value="PAN Card">PAN Card</option>
            <option value="Passport">Passport</option>
            <option value="Voter ID">Voter ID</option>
            <option value="Driving Licence">Driving Licence</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Front Side */}
          <div className="space-y-2">
            <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-teal-600 rounded-lg cursor-pointer bg-teal-50 hover:bg-teal-100">
              <span className="text-xs font-bold text-teal-800">🪪 Front Card</span>
              <span className="text-[10px] text-teal-600">(Name, ID, DOB)</span>
              <input type="file" accept="image/*" onChange={handleFrontUpload} className="hidden" />
            </label>
            {frontPhoto && (
              <div className="space-y-1">
                <div className="relative rounded border overflow-hidden aspect-[4/3] bg-black">
                  <img src={frontPhoto} className="size-full object-cover" alt="front preview" />
                  <button type="button" onClick={() => setFrontPhoto(null)} className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center">×</button>
                </div>
                <button type="button" onClick={handleRotateFront} className="w-full bg-amber-50 text-amber-800 border border-amber-200 rounded py-1 text-[11px] font-semibold">
                  🔄 Rotate 90°
                </button>
              </div>
            )}
          </div>

          {/* Back Side */}
          <div className="space-y-2">
            <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-indigo-600 rounded-lg cursor-pointer bg-indigo-50 hover:bg-indigo-100">
              <span className="text-xs font-bold text-indigo-800">🏠 Back Card</span>
              <span className="text-[10px] text-indigo-600">(Address)</span>
              <input type="file" accept="image/*" onChange={handleBackUpload} className="hidden" />
            </label>
            {backPhoto && (
              <div className="relative rounded border overflow-hidden aspect-[4/3] bg-black">
                <img src={backPhoto} className="size-full object-cover" alt="back preview" />
                <button type="button" onClick={() => setBackPhoto(null)} className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center">×</button>
              </div>
            )}
          </div>
        </div>

        {scanningSide && (
          <div className="p-3 bg-teal-50 text-teal-800 rounded-lg flex items-center gap-2 animate-pulse">
            <span>🤖</span> <p className="text-sm font-medium">Processing {scanningSide} card OCR...</p>
          </div>
        )}

        <form onSubmit={handleCheckInSubmit} className="space-y-4 pt-4 border-t">
          <div>
            <label className="block text-sm font-semibold text-gray-700">Guest Full Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Type or scan name" className="w-full mt-1 border border-gray-300 p-2 rounded-md font-medium" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">ID / National ID Number *</label>
            <input type="text" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} required placeholder="Type or scan ID number" className="w-full mt-1 border border-gray-300 p-2 rounded-md font-medium" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Date of Birth</label>
            <input type="text" value={dob} onChange={(e) => setDob(e.target.value)} placeholder="DD/MM/YYYY" className="w-full mt-1 border border-gray-300 p-2 rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Address</label>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full residential address" className="w-full mt-1 border border-gray-300 p-2 rounded-md" rows={2} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Purpose of Visit</label>
            <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="w-full mt-1 border border-gray-300 p-2 rounded-md bg-white">
              <option value="Tourism / Leisure">Tourism / Leisure</option>
              <option value="Business / Work">Business / Work</option>
              <option value="Pilgrimage">Pilgrimage</option>
              <option value="Family Visit">Family Visit</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <button type="submit" className="w-full bg-teal-700 hover:bg-teal-800 text-white p-2.5 rounded-md font-bold transition">
            Complete Check-In & Assign Room {selectedRoom}
          </button>
        </form>
      </div>
    </div>
  );
}
