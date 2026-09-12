import React, { useState, useMemo } from 'react';
import { RecordItem, DepartmentMeta, BoxGroup, RetentionPeriod } from '../types';
import { groupRecordsByBox } from '../utils/recordUtils';
import {
  Tag,
  Printer,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';
import {
  DEFAULT_HWP_TEMPLATE,
  generatePrintableHwpHtml,
  RETENTION_COLOR_MAP,
} from '../utils/hwpLabelUtils';
import { LabelPrintModal } from './LabelPrintModal';

interface LabelsViewProps {
  records: RecordItem[];
  meta: DepartmentMeta;
}

export const LabelsView: React.FC<LabelsViewProps> = ({ records, meta }) => {
  // 상자별 그룹화 (활성 기록물만, 상자번호 공백 제외)
  const boxGroups = useMemo(() => groupRecordsByBox(records), [records]);

  // 상자번호가 공백이어서 라벨출력에서 제외된 활성 기록물 건수
  const unassignedBoxCount = useMemo(() => {
    return records.filter(
      (r) => r.is_completed && !r.is_disposed && !r.is_transferred && (!r.box_no || r.box_no.trim() === '')
    ).length;
  }, [records]);

  const [selectedBoxNos, setSelectedBoxNos] = useState<Set<string>>(new Set());
  const [expandedBoxNos, setExpandedBoxNos] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [printModalBoxes, setPrintModalBoxes] = useState<BoxGroup[] | null>(null);

  // 검색 필터링
  const filteredBoxes = useMemo(() => {
    if (!searchTerm.trim()) return boxGroups;
    const q = searchTerm.toLowerCase();
    return boxGroups.filter(
      (b) =>
        b.box_no.toLowerCase().includes(q) ||
        b.shelf_no.toLowerCase().includes(q) ||
        b.records.some((r) => r.title.toLowerCase().includes(q))
    );
  }, [boxGroups, searchTerm]);

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedBoxNos(new Set(filteredBoxes.map((b) => b.box_no)));
    } else {
      setSelectedBoxNos(new Set());
    }
  };

  const handleToggleSelectBox = (boxNo: string) => {
    const next = new Set(selectedBoxNos);
    if (next.has(boxNo)) next.delete(boxNo);
    else next.add(boxNo);
    setSelectedBoxNos(next);
  };

  const handleToggleExpand = (boxNo: string) => {
    const next = new Set(expandedBoxNos);
    if (next.has(boxNo)) next.delete(boxNo);
    else next.add(boxNo);
    setExpandedBoxNos(next);
  };

  // 인쇄 미리보기 및 직접 출력 모달 열기 (Tauri v2 / WebView2 팝업 차단 완벽 해결)
  const handlePrintLabels = (targetBoxes: BoxGroup[]) => {
    if (targetBoxes.length === 0) {
      alert('인쇄할 상자를 선택해주세요.');
      return;
    }
    setPrintModalBoxes(targetBoxes);
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-24 relative">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              보존기록물 상자 표지 라벨출력 및 서가 배치 관리
            </h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
              총 {boxGroups.length}개 상자
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            기록물의 <strong className="text-slate-800">상자번호(box_no)</strong>를 기준으로 자동 취합되며, 행정안전부 및 교육청 표준 HWP 상자표지 규격(A4 2매 서식)으로 인쇄됩니다.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="btn-print-selected-boxes"
            onClick={() => {
              const targets = boxGroups.filter((b) => selectedBoxNos.has(b.box_no));
              handlePrintLabels(targets);
            }}
            disabled={selectedBoxNos.size === 0}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold inline-flex items-center gap-1.5 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
          >
            <Printer className="w-4 h-4" />
            선택 상자 라벨 인쇄 ({selectedBoxNos.size})
          </button>

          <button
            id="btn-print-all-boxes"
            onClick={() => handlePrintLabels(boxGroups)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
          >
            <Printer className="w-4 h-4" />
            전체 상자 라벨 일괄 인쇄
          </button>
        </div>
      </div>

      {/* Notice for unassigned box numbers */}
      {unassignedBoxCount > 0 && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-bold text-[11px]">
              안내
            </span>
            <span>
              상자번호가 공백인 기록물 <strong>{unassignedBoxCount}건</strong>은 라벨출력 대상에서 제외되어 있습니다. (보존기록물 목록에서 해당 기록물의 상자번호를 입력하면 라벨출력에 자동 반영됩니다.)
            </span>
          </div>
        </div>
      )}

      {/* Sticky Search and Selection Control Bar (스크롤 내려도 상단에 고정) */}
      <div className="sticky top-14 z-20 bg-white/95 backdrop-blur-md border border-slate-300 rounded-lg p-3 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="상자번호, 서가위치, 수록 기록물 검색..."
            className="w-full border border-slate-300 rounded px-2.5 py-1 text-xs focus:outline-blue-600 bg-white"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <label className="flex items-center gap-1.5 cursor-pointer select-none font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={filteredBoxes.length > 0 && selectedBoxNos.size === filteredBoxes.length}
              onChange={(e) => handleToggleSelectAll(e.target.checked)}
              className="rounded border-slate-400 text-indigo-600 focus:ring-indigo-500"
            />
            전체 상자 선택 ({selectedBoxNos.size}/{filteredBoxes.length})
          </label>

          {/* 스크롤 시에도 바로 누를 수 있는 상단 고정 인쇄 버튼 */}
          <button
            onClick={() => {
              const targets = boxGroups.filter((b) => selectedBoxNos.has(b.box_no));
              handlePrintLabels(targets);
            }}
            disabled={selectedBoxNos.size === 0}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold inline-flex items-center gap-1 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>선택 상자 인쇄 ({selectedBoxNos.size})</span>
          </button>
        </div>
      </div>

      {/* Floating Bottom Action Bar (스크롤바를 내려도 화면 하단에 항상 머무는 인쇄 바) */}
      {selectedBoxNos.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 text-white backdrop-blur-md px-5 py-3 rounded-full shadow-2xl border border-slate-700 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse"></span>
            <span>선택된 상자 <strong className="text-indigo-300 font-black text-sm">{selectedBoxNos.size}</strong>개</span>
          </div>

          <div className="h-4 w-px bg-slate-700"></div>

          <button
            type="button"
            id="floating-btn-print-selected"
            onClick={() => {
              const targets = boxGroups.filter((b) => selectedBoxNos.has(b.box_no));
              handlePrintLabels(targets);
            }}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-xs font-bold inline-flex items-center gap-1.5 shadow-md cursor-pointer transition-all hover:scale-105 active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>선택 상자 라벨 인쇄</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedBoxNos(new Set())}
            className="text-xs text-slate-400 hover:text-white px-2 py-1 transition-colors cursor-pointer"
          >
            선택 해제
          </button>
        </div>
      )}

      {/* Box Cards Grid */}
      {filteredBoxes.length === 0 ? (
        <div className="bg-white border border-slate-300 rounded-lg p-12 text-center text-slate-500 space-y-2">
          <Tag className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-700 text-sm">출력할 상자가 없습니다.</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {boxGroups.length === 0
              ? '상자번호가 부여된 활성 기록물이 없습니다. 기록물 등록/목록에서 상자번호를 입력하시면 자동으로 상자 라벨출력 대상에 포함됩니다.'
              : '검색어와 일치하는 상자가 없습니다. 검색어를 확인해주세요.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredBoxes.map((box) => {
          const isSelected = selectedBoxNos.has(box.box_no);
          const isExpanded = expandedBoxNos.has(box.box_no);

          return (
            <div
              key={box.box_no}
              className={`bg-white rounded-lg border-2 transition-all shadow-xs overflow-hidden ${
                isSelected ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-slate-300'
              }`}
            >
              {/* Box Card Header */}
              <div className="bg-slate-50 p-3.5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleSelectBox(box.box_no)}
                    className="rounded border-slate-400 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-extrabold text-indigo-950">
                        상자번호: {box.box_no}
                      </span>
                      <span className="bg-indigo-100 text-indigo-800 font-bold text-[11px] px-2 py-0.5 rounded border border-indigo-200">
                        서가: {box.shelf_no}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      생산년도: <strong className="text-slate-700">{box.year_range}</strong> · 수록 기록물: <strong className="text-blue-700">{box.record_count}권</strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handlePrintLabels([box])}
                    className="p-1.5 text-indigo-700 hover:bg-indigo-100 rounded border border-indigo-200 cursor-pointer"
                    title="이 상자 라벨만 즉시 인쇄"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggleExpand(box.box_no)}
                    className="p-1.5 text-slate-500 hover:bg-slate-200 rounded cursor-pointer"
                    title={isExpanded ? '수록 목록 접기' : '수록 목록 펼치기'}
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Box Info Summary Body */}
              <div className="p-3.5 text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-600 bg-slate-50/70 p-2 rounded border border-slate-200">
                  <span className="font-semibold text-slate-700">포함된 보존기간:</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {box.retention_periods.map((p) => (
                      <span
                        key={p}
                        className="px-2 py-0.5 rounded text-[11px] font-bold bg-white text-blue-900 border border-slate-300"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>

                {/* HWP Miniature Label Mockup (전북특별자치도교육청 A4 2x2 표준 서식 미리보기) */}
                {(() => {
                  let mainPeriod: RetentionPeriod = '5년';
                  if (box.retention_periods.length > 0) {
                    mainPeriod = box.retention_periods[0];
                  } else {
                    for (const p of ['영구', '준영구', '30년', '10년', '5년', '3년', '1년'] as RetentionPeriod[]) {
                      if (box.box_no.startsWith(p)) {
                        mainPeriod = p;
                        break;
                      }
                    }
                  }
                  const color = RETENTION_COLOR_MAP[mainPeriod] || { bg: '#475569', text: '#fff' };

                  return (
                    <div className="border-2 border-slate-950 rounded-xs overflow-hidden bg-white shadow-xs font-sans text-xs flex flex-col">
                      {/* 상단: 보존기간 배너 (우측 정렬) */}
                      <div
                        style={{ backgroundColor: color.bg, color: color.text }}
                        className="text-right pr-4 py-1.5 font-black text-lg tracking-wider border-b-2 border-slate-950"
                      >
                        {mainPeriod}
                      </div>

                      {/* 본문 정보 표 (상자번호, 생산연도, 관리부서, 업무명 4단 구성) */}
                      <div className="flex-1 bg-white">
                        <table className="w-full border-collapse text-xs border-b border-slate-950">
                          <tbody>
                            <tr className="border-b border-slate-950">
                              <th className="w-[30%] py-1.5 text-center font-normal text-slate-700 tracking-wider border-r border-slate-950 text-[11px]">
                                상 자 번 호
                              </th>
                              <td className="py-1.5 px-2 text-center font-black text-slate-950 text-sm">
                                {box.box_no}
                              </td>
                            </tr>
                            <tr className="border-b border-slate-950">
                              <th className="py-1.5 text-center font-normal text-slate-700 tracking-wider border-r border-slate-950 text-[11px]">
                                생 산 연 도
                              </th>
                              <td className="py-1.5 px-2 text-center font-bold text-slate-900 text-xs">
                                {box.year_range}
                              </td>
                            </tr>
                            <tr className="border-b border-slate-950">
                              <th className="py-1.5 text-center font-normal text-slate-700 tracking-wider border-r border-slate-950 text-[11px]">
                                관 리 부 서
                              </th>
                              <td className="py-1.5 px-2 text-center font-bold text-slate-900 text-xs">
                                {meta.department || meta.school_name || '전북초등학교'}
                              </td>
                            </tr>
                            <tr>
                              <th className="py-2 text-center font-normal text-slate-700 tracking-widest border-r border-slate-950 text-[11px] align-middle">
                                업 무 명
                              </th>
                              <td className="p-2 align-top">
                                <div className="space-y-1 max-h-56 overflow-y-auto pr-0.5">
                                  {box.records.map((rec) => (
                                    <div
                                      key={rec.record_id}
                                      className="text-[11px] font-bold text-slate-900 truncate flex items-center gap-1.5"
                                      title={rec.title}
                                    >
                                      <span className="text-[8px] text-slate-900 select-none">■</span>
                                      <span className="truncate">{rec.title}</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* 하단: 기관명 (그림 없이 텍스트만 중앙 배치) */}
                      <div className="bg-white text-slate-900 py-1.5 px-2 text-center font-bold text-xs tracking-wider border-t border-slate-950">
                        {meta.institution || meta.school_name || '전북특별자치도교육청'}
                      </div>
                    </div>
                  );
                })()}

                {/* 만약 상자가 펼쳐진 경우 (isExpanded), 수록 기록물 전체 상세 목록 표 출력 */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-slate-800 text-xs">
                        상자 수록 기록물 상세 대장 ({box.records.length}권 전권 등재)
                      </span>
                      <button
                        onClick={() => handleToggleExpand(box.box_no)}
                        className="text-slate-500 hover:text-slate-700 text-[11px] cursor-pointer"
                      >
                        상세 접기
                      </button>
                    </div>
                    <div className="max-h-56 overflow-y-auto border border-slate-200 rounded text-[11px] bg-white">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-100 text-slate-700 sticky top-0 border-b border-slate-200 text-[10px]">
                          <tr>
                            <th className="py-1 px-2 font-semibold">연번</th>
                            <th className="py-1 px-2 font-semibold">등록번호</th>
                            <th className="py-1 px-2 font-semibold">기록물철 제목</th>
                            <th className="py-1 px-2 font-semibold text-center">보존기간</th>
                            <th className="py-1 px-2 font-semibold text-center">생산연도</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {box.records.map((r, idx) => (
                            <tr key={r.record_id} className="hover:bg-slate-50">
                              <td className="py-1 px-2 text-slate-500">{idx + 1}</td>
                              <td className="py-1 px-2 font-mono text-slate-700">{r.reg_no || '-'}</td>
                              <td className="py-1 px-2 font-medium text-slate-900">{r.title}</td>
                              <td className="py-1 px-2 text-center text-slate-700">{r.retention_period}</td>
                              <td className="py-1 px-2 text-center text-slate-600">{r.prod_year}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* 라벨 인쇄 미리보기 및 직접 출력 모달 (Tauri v2 / WebView2 인쇄 완벽 지원) */}
      <LabelPrintModal
        isOpen={!!printModalBoxes}
        onClose={() => setPrintModalBoxes(null)}
        boxes={printModalBoxes || []}
        meta={meta}
      />
    </div>
  );
};
