// 회사지도(/company) — 회장 전용. 대시보드 로그인(qnbang_auth, middleware) 통과 뒤 2차 게이트(qnbang_company)를 한 번 더 검사.
// 서버 컴포넌트: 통과했으면 데이터를 서버에서 한 번에 모아(lib/companyMap.ts) 클라이언트 뷰(CompanyMap)로 내려준다.
import { cookies } from 'next/headers';
import CompanyLogin from './CompanyLogin';
import CompanyMap from './CompanyMap';
import { buildCompanyMap } from '@/lib/companyMap';

export default async function CompanyPage() {
  const jar = await cookies();
  const token = jar.get('qnbang_company')?.value;
  if (!token || !process.env.COMPANY_TOKEN || token !== process.env.COMPANY_TOKEN) {
    return <CompanyLogin />;
  }
  const data = await buildCompanyMap();
  return <CompanyMap data={data} />;
}
