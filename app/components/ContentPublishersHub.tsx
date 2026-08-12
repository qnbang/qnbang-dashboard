'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Publisher = {
  id: string;
  brand: string;
  channel: string;
  description: string;
  status: '운영 중' | '준비 중';
  href?: string;
};

const publishers: Publisher[] = [
  {
    id: 'automation-youth',
    brand: '자동화청년',
    channel: 'Threads 발행기',
    description: '콘텐츠를 검토하고 승인·예약하는 전용 발행기입니다.',
    status: '운영 중',
    href: '/threads/automation-youth',
  },
  {
    id: 'worklounge',
    brand: '워크라운지',
    channel: '멀티채널 발행기',
    description: '워크라운지 전용 원장과 발행 서버를 연결할 준비를 하고 있습니다.',
    status: '준비 중',
  },
];

export default function ContentPublishersHub() {
  const router = useRouter();
  const [notice, setNotice] = useState('');

  const openPublisher = (publisher: Publisher) => {
    if (publisher.href) {
      router.push(publisher.href);
      return;
    }
    setNotice(`${publisher.brand} 발행기는 아직 원장과 서버가 연결되지 않았습니다.`);
  };

  return (
    <section className="mx-auto max-w-5xl py-3">
      <div className="border-b border-slate-200 pb-7">
        <p className="text-sm font-medium text-indigo-600">콘텐츠</p>
        <h2 className="mt-2 text-3xl font-bold tracking-[-0.045em] text-slate-900">발행기</h2>
        <p className="mt-3 max-w-xl leading-7 text-slate-500">브랜드와 채널별 발행기를 분리해 둡니다. 발행 원장과 승인 내용은 각 전용 발행기 안에서만 확인합니다.</p>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        {publishers.map((publisher) => {
          const active = Boolean(publisher.href);
          return (
            <article key={publisher.id} className="flex min-h-64 flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">{publisher.channel}</p>
                  <h3 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-900">{publisher.brand}</h3>
                </div>
                <span className={active ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700' : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500'}>{publisher.status}</span>
              </div>
              <p className="mt-5 flex-1 leading-7 text-slate-600">{publisher.description}</p>
              <button onClick={() => openPublisher(publisher)} className={active ? 'mt-7 min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-700' : 'mt-7 min-h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50'}>
                {active ? '발행기 열기' : '연결 상태 보기'}
              </button>
            </article>
          );
        })}
      </div>

      {notice && <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-medium text-slate-600">{notice}</p>}
    </section>
  );
}
