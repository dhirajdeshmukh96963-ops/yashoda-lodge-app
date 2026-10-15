'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  const tabs = [
    { href: '/checkin', label: 'Check-In Scanner' },
    { href: '/rooms', label: 'Rooms Status' },
    { href: '/records', label: 'Guest Register' },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-lg">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`py-2 text-xs font-bold text-center rounded-md transition ${
              isActive ? 'bg-teal-700 text-white' : 'text-slate-700 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
