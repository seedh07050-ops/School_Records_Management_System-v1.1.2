import React, { useState } from 'react';
import { RecordItem, DepartmentMeta, RetentionPeriod, MenuKey } from '../types';
import {
  Building2,
  Calendar,
  FileSpreadsheet,
  ArrowUpRight,
  Printer,
  PlusCircle,
  Clock,
  ShieldCheck,
  Edit2,
  Check,
} from 'lucide-react';
import { exportRecordsToExcel } from '../utils/excelUtils';

interface CoverSummaryViewProps {
  records: RecordItem[];
  meta: DepartmentMeta;
  onUpdateMeta: (newMeta: DepartmentMeta) => void;
  onSelectMenu: (menu: MenuKey) => void;
  onOpenLabelModal: () => void;
}

export const CoverSummaryView: React.FC<CoverSummaryViewProps> = ({
  records,
  meta,
  onUpdateMeta,
  onSelectMenu,
  onOpenLabelModal,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [dept, setDept] = useState(meta.department);
  const [baseDate, setBaseDate] = useState(meta.base_date);
  const [school, setSchool] = useState(meta.institution || meta.school_name || '전북특별자치도교육청');

  // props meta가 변경될 때 로컬 편집 상태 동기화
  React.useEffect(() => {
    setDept(meta.department);
    setBaseDate(meta.base_date);
    setSchool(meta.institution || meta.school_name || '전북특별자치도교육청');
  }, [meta.department, meta.base_date, meta.school_name, meta.institution]);

  // 활성 기록물만 대상 (입력완료 & 미폐기 & 미이관)
  const activeRecords = records.filter((r) => r.is_completed && !r.is_disposed && !r.is_transferred);
  const disposedCount = records.filter((r) => r.is_disposed).length;
  const transferredCount = records.filter((r) => r.is_transferred && !r.is_disposed).length;
  const pendingInputCount = records.filter((r) => !r.is_completed && !r.is_disposed && !r.is_transferred).length;

  const countByPeriod = (period: RetentionPeriod): number => {
    return activeRecords.filter((r) => r.retention_period === period).length;
  };

  const periodStats: { period: RetentionPeriod; menuKey: MenuKey; color: string }[] = [
    { period: '영구', menuKey: 'retention_permanent', color: 'border-red-600 text-red-700 bg-red-50/70' },
    { period: '준영구', menuKey: 'retention_semi_permanent', color: 'border-emerald-600 text-emerald-700 bg-emerald-50/70' },
    { period: '30년', menuKey: 'retention_30', color: 'border-orange-600 text-orange-700 bg-orange-50/70' },
    { period: '10년', menuKey: 'retention_10', color: 'border-amber-600 text-amber-800 bg-amber-50/70' },
    { period: '5년', menuKey: 'retention_5', color: 'border-pink-500 text-pink-700 bg-pink-50/70' },
    { period: '3년', menuKey: 'retention_3', color: 'border-lime-500 text-lime-800 bg-lime-50/70' },
    { period: '1년', menuKey: 'retention_1', color: 'border-yellow-500 text-yellow-800 bg-yellow-50/70' },
  ];

  const totalCount = activeRecords.length;

  const handleSaveMeta = () => {
    const institutionName = school.trim() || '전북특별자치도교육청';
    onUpdateMeta({
      ...meta,
      department: dept.trim() || '전북초등학교',
      base_date: baseDate.trim() || new Date().toISOString().split('T')[0],
      school_name: institutionName,
      institution: institutionName,
    });
    setIsEditing(false);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Official Korean Government / School Archives Excel-Style Document Cover */}
      <div className="bg-white border-2 border-slate-700 rounded-lg shadow-sm overflow-hidden">
        {/* Document Header Title */}
        <div className="border-b-2 border-slate-700 bg-slate-100/80 px-8 py-6 text-center relative">
          <div className="inline-block border-b-2 border-slate-800 pb-1 px-4">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-widest font-serif">
              문 서 고   보 존 기 록 대 장
            </h2>
          </div>
        </div>

        {/* Administrative Metadata Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border-b border-slate-400 bg-white text-sm">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700">
              <Building2 className="w-4 h-4 text-slate-500" />
              <span className="font-bold">기 관 명 :</span>
              {isEditing ? (
                <input
                  type="text"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  className="border border-blue-400 px-2 py-0.5 rounded text-xs font-semibold focus:outline-blue-600"
                />
              ) : (
                <span className="font-semibold text-slate-900">{meta.institution || meta.school_name || '전북특별자치도교육청'}</span>
              )}
            </div>

            <div className="flex items-center gap-2 text-slate-700">
              <span className="font-bold">처 리 과 :</span>
              {isEditing ? (
                <input
                  type="text"
                  value={dept}
                  onChange={(e) => setDept(e.target.value)}
                  className="border border-blue-400 px-2 py-0.5 rounded text-xs font-semibold focus:outline-blue-600 w-24"
                />
              ) : (
                <span className="font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {meta.department}
                </span>
              )}
            </div>
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span className="font-bold">기 준 일 자 :</span>
              {isEditing ? (
                <input
                  type="date"
                  value={baseDate}
                  onChange={(e) => setBaseDate(e.target.value)}
                  className="border border-blue-400 px-2 py-0.5 rounded text-xs font-semibold focus:outline-blue-600"
                />
              ) : (
                <span className="font-bold text-slate-900">{meta.base_date}</span>
              )}
            </div>

            <div>
              {isEditing ? (
                <button
                  id="cover-btn-save-meta"
                  onClick={handleSaveMeta}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  저장
                </button>
              ) : (
                <button
                  id="cover-btn-edit-meta"
                  onClick={() => setIsEditing(true)}
                  className="px-2.5 py-1 text-xs text-slate-600 hover:text-blue-700 border border-slate-300 rounded hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
                >
                  <Edit2 className="w-3 h-3" />
                  정보 수정
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Official Summary Table (기존 엑셀 서식 100% 매칭) */}
        <div className="p-6 bg-slate-50/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              [ 보존기간별 기록물 총괄 현황 집계표 ]
            </h3>
            <span className="text-xs text-slate-500">
              * 보유 기록물 데이터 기반 자동 산출 (단위: 권/철)
            </span>
          </div>

          {/* Desktop Table View */}
          <div className="overflow-x-auto border-2 border-slate-800 rounded bg-white shadow-xs">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white text-xs font-bold divide-x divide-slate-700">
                  <th className="py-2.5 px-3">구 분</th>
                  <th className="py-2.5 px-3 bg-blue-900">계 (총계)</th>
                  <th className="py-2.5 px-3">영구</th>
                  <th className="py-2.5 px-3">준영구</th>
                  <th className="py-2.5 px-3">30년</th>
                  <th className="py-2.5 px-3">10년</th>
                  <th className="py-2.5 px-3">5년</th>
                  <th className="py-2.5 px-3">3년</th>
                  <th className="py-2.5 px-3">1년</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300 font-bold text-sm">
                <tr className="divide-x divide-slate-200 hover:bg-blue-50/20">
                  <td className="py-3.5 px-3 bg-slate-100/80 text-xs font-semibold text-slate-700">
                    기록물 수량
                  </td>
                  <td className="py-3.5 px-3 text-lg font-extrabold text-blue-900 bg-blue-50/50">
                    {totalCount}
                  </td>
                  <td className="py-3.5 px-3 text-red-700">{countByPeriod('영구')}</td>
                  <td className="py-3.5 px-3 text-orange-700">{countByPeriod('준영구')}</td>
                  <td className="py-3.5 px-3 text-amber-800">{countByPeriod('30년')}</td>
                  <td className="py-3.5 px-3 text-emerald-800">{countByPeriod('10년')}</td>
                  <td className="py-3.5 px-3 text-sky-800">{countByPeriod('5년')}</td>
                  <td className="py-3.5 px-3 text-indigo-800">{countByPeriod('3년')}</td>
                  <td className="py-3.5 px-3 text-slate-700">{countByPeriod('1년')}</td>
                </tr>
                <tr className="divide-x divide-slate-200 text-xs bg-slate-50 text-slate-500 font-normal">
                  <td className="py-2 px-3">비율 (%)</td>
                  <td className="py-2 px-3 font-semibold text-blue-900">100%</td>
                  {periodStats.map(({ period }) => {
                    const count = countByPeriod(period);
                    const pct = totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) : '0.0';
                    return (
                      <td key={period} className="py-2 px-3">
                        {pct}%
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Table Footnotes */}
          <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-500 gap-2 border-t pt-3">
            <div className="space-y-0.5">
              <p>• 폐기 처리된 기록물({disposedCount}건) 및 기록관 이관 기록물({transferredCount}건)은 본 현황 숫자에 포함되지 않으며 각 전용 목록에 안전하게 보존됩니다.</p>
              <p>• 입력 중인 임시 기록물({pendingInputCount}건)은 [입력완료] 처리 시 본 총괄 대장에 실시간 반영됩니다.</p>
            </div>
            <button
              id="cover-btn-download-excel"
              onClick={() => exportRecordsToExcel(records, meta)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold inline-flex items-center gap-1 cursor-pointer flex-shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              대장 Excel (.xlsx) 즉시 다운로드
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Quick-Jump Navigation Cards for Each Retention Period */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-600" />
            보존기간별 세부 대장 바로가기
          </h3>
          <span className="text-xs text-slate-500">카드를 클릭하면 해당 보존기간 화면으로 이동합니다.</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {periodStats.map(({ period, menuKey, color }) => {
            const count = countByPeriod(period);
            return (
              <button
                key={period}
                id={`card-jump-${period}`}
                onClick={() => onSelectMenu(menuKey)}
                className={`p-3.5 rounded-lg border text-left transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer flex flex-col justify-between ${color}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold">{period}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
                </div>
                <div>
                  <div className="text-xl font-black">{count}</div>
                  <div className="text-[10px] opacity-75">권/철</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Workflow Quick Action Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Action 1: New Input */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs hover:border-blue-400 transition-colors">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900">신규 기록물 입력</h4>
              <p className="text-xs text-slate-500">유사 과제카드 자동 추천 및 일괄 등록</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 mb-3 leading-relaxed">
            엑셀처럼 표 형태로 여러 행을 한 번에 입력하고, 유사 과제카드 추천을 통해 적정 보존기간을 쉽게 확정하세요.
          </p>
          <button
            id="cover-action-go-input"
            onClick={() => onSelectMenu('input')}
            className="w-full py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 cursor-pointer"
          >
            기록물 입력 화면으로 이동 →
          </button>
        </div>

        {/* Action 2: Box Labels */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs hover:border-blue-400 transition-colors">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900">상자 표지 라벨지 출력</h4>
              <p className="text-xs text-slate-500">상자번호별 자동 취합 및 HWP 규격 서식</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 mb-3 leading-relaxed">
            상자번호별로 기록물이 자동 그룹화되어 규격화된 보존용기 표지 라벨을 A4 2분할 규격으로 즉시 인쇄합니다.
          </p>
          <button
            id="cover-action-go-labels"
            onClick={() => onSelectMenu('labels')}
            className="w-full py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 cursor-pointer"
          >
            라벨 관리 및 인쇄 화면으로 이동 →
          </button>
        </div>

        {/* Action 3: Task Cards */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs hover:border-blue-400 transition-colors">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900">과제카드 및 기준 관리</h4>
              <p className="text-xs text-slate-500">학교 업무 과제카드</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 mb-3 leading-relaxed">
            과제카드별 표준 보존기간을 직접 등록/수정하여 유사 과제카드 추천의 정확도를 실시간으로 향상시키세요.
          </p>
          <button
            id="cover-action-go-taskcards"
            onClick={() => onSelectMenu('task_cards')}
            className="w-full py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 cursor-pointer"
          >
            과제카드 기준 관리로 이동 →
          </button>
        </div>
      </div>

      {/* 우측 하단 제작자 표기 (요구사항 4) */}
      <div className="flex justify-end pt-3 pb-1 text-[11px] text-slate-400 font-medium">
        제작: 전북특별자치도교육청 오봉초등학교 서동혁
      </div>
    </div>
  );
};
