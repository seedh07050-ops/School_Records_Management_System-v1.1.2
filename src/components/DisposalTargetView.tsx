import React, { useState, useMemo } from 'react';
import { RecordItem, DepartmentMeta, RetentionPeriod } from '../types';
import { calculateExpiryYear } from '../utils/recordUtils';
import { exportDisposalTargetsToExcel } from '../utils/excelUtils';
import {
  Calendar,
  Trash2,
  Clock,
  Search,
  Download,
  CheckCircle2,
  AlertTriangle,
  PauseCircle,
  RotateCcw,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

interface DisposalTargetViewProps {
  records: RecordItem[];
  meta: DepartmentMeta;
  onDisposeRecords: (recordIds: string[], reason?: string, customDate?: string) => void;
  onDeferRecords: (recordIds: string[]) => void;
  onUndeferRecords: (recordIds: string[]) => void;
}

const APPLICABLE_PERIODS: RetentionPeriod[] = ['10년', '5년', '3년', '1년'];

export const DisposalTargetView: React.FC<DisposalTargetViewProps> = ({
  records,
  meta,
  onDisposeRecords,
  onDeferRecords,
  onUndeferRecords,
}) => {
  const currentYear = new Date().getFullYear();
  const [baseYear, setBaseYear] = useState<number>(currentYear);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'target' | 'deferred'>('target');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 폐기 확정일자 입력 상태 (기본값: 오늘)
  const [actionDisposalDate, setActionDisposalDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const actionDisposalDateRef = React.useRef<string>(new Date().toISOString().split('T')[0]);
  const [isDisposingModal, setIsDisposingModal] = useState<boolean>(false);

  const handleDisposalDateChange = (val: string) => {
    setActionDisposalDate(val);
    actionDisposalDateRef.current = val;
  };

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    detail?: string;
    confirmText?: string;
    confirmVariant?: 'danger' | 'warning' | 'rose' | 'primary';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Base list of all completed, non-disposed, non-transferred 10/5/3/1 year records whose expiry year <= baseYear
  const candidateRecords = useMemo(() => {
    return records.filter((r) => {
      if (!r.is_completed || r.is_disposed || r.is_transferred) return false;
      if (!APPLICABLE_PERIODS.includes(r.retention_period)) return false;

      const expiryStr = calculateExpiryYear(r.end_year, r.retention_period);
      const expiry = parseInt(expiryStr, 10);
      if (isNaN(expiry)) return false;

      return expiry <= baseYear;
    });
  }, [records, baseYear]);

  // Target records (not deferred) vs Deferred records (all active deferred records across all periods)
  const targetRecords = useMemo(() => {
    return candidateRecords.filter((r) => !r.is_disposal_deferred);
  }, [candidateRecords]);

  // 보류 처리된 모든 기록물 (기준연도 제한 없이 등록된 모든 보류 건을 표시하여 누락 없이 보류 취소 가능)
  const deferredRecords = useMemo(() => {
    return records.filter(
      (r) =>
        r.is_completed &&
        !r.is_disposed &&
        !r.is_transferred &&
        r.is_disposal_deferred &&
        APPLICABLE_PERIODS.includes(r.retention_period)
    );
  }, [records]);

  // Action status message
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Filter based on active view mode, search term, and period filter
  const displayedRecords = useMemo(() => {
    const list = viewMode === 'target' ? targetRecords : deferredRecords;
    return list.filter((r) => {
      if (selectedPeriod !== 'ALL' && r.retention_period !== selectedPeriod) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchTitle = r.title.toLowerCase().includes(q);
        const matchBox = r.box_no.toLowerCase().includes(q);
        const matchShelf = r.shelf_no.toLowerCase().includes(q);
        const matchNo = (r.record_no || '').toLowerCase().includes(q);
        if (!matchTitle && !matchBox && !matchShelf && !matchNo) return false;
      }
      return true;
    });
  }, [viewMode, targetRecords, deferredRecords, selectedPeriod, searchTerm]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(displayedRecords.map((r) => r.record_id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Action: Dispose Selected (Moves to 폐기확정목록)
  const handleDisposeSelected = () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const ids = Array.from(selectedIds);
    const today = new Date().toISOString().split('T')[0];
    handleDisposalDateChange(today);
    setIsDisposingModal(true);

    setConfirmModal({
      isOpen: true,
      title: '폐기 확정 처리',
      message: `선택한 ${count}건의 기록물을 폐기 확정하시겠습니까?`,
      detail: '폐기 확정 시 [폐기확정목록]으로 이동되며, 기존 10년/5년/3년/1년 보존 탭 및 총괄 집계에서 제외됩니다.',
      confirmText: '폐기 확정',
      confirmVariant: 'danger',
      onConfirm: () => {
        const finalDate = actionDisposalDateRef.current || today;
        onDisposeRecords(ids, `${baseYear}년 기준 보존기간 만료에 따른 폐기`, finalDate);
        setSelectedIds(new Set());
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        setIsDisposingModal(false);
        setActionNotice(`선택한 ${count}건의 기록물이 폐기 확정(폐기일자: ${finalDate})되어 [폐기확정목록]으로 이동되었습니다.`);
      },
    });
  };

  // Action: Defer Selected (Removes from 폐기대상, stays in original tabs)
  const handleDeferSelected = () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const ids = Array.from(selectedIds);
    setIsDisposingModal(false);

    setConfirmModal({
      isOpen: true,
      title: '폐기 보류 처리',
      message: `선택한 ${count}건의 기록물을 폐기 보류하시겠습니까?`,
      detail: '보류 처리된 기록물은 폐기대상 목록에서만 제외되며, 원래의 보존기간 탭에는 그대로 안전하게 유지됩니다.',
      confirmText: '폐기 보류',
      confirmVariant: 'warning',
      onConfirm: () => {
        onDeferRecords(ids);
        setSelectedIds(new Set());
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Action: Undefer Selected (Return to 폐기대상)
  const handleUndeferSelected = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    onUndeferRecords(ids);
    setSelectedIds(new Set());
    setActionNotice(`선택한 ${ids.length}건의 기록물이 보류 취소되어 폐기대상 심사 목록으로 복귀되었습니다.`);
  };

  // Action: Single Dispose
  const handleDisposeSingle = (rec: RecordItem) => {
    const today = new Date().toISOString().split('T')[0];
    handleDisposalDateChange(today);
    setIsDisposingModal(true);

    setConfirmModal({
      isOpen: true,
      title: '기록물 폐기 확정',
      message: `[${rec.title}] 기록물을 폐기 확정하시겠습니까?`,
      detail: '폐기 확정 시 [폐기확정목록]으로 이동되며 기존 보존 목록에서 제외됩니다.',
      confirmText: '폐기 확정',
      confirmVariant: 'danger',
      onConfirm: () => {
        const finalDate = actionDisposalDateRef.current || today;
        onDisposeRecords([rec.record_id], `${baseYear}년 기준 보존기간 만료`, finalDate);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        setIsDisposingModal(false);
        setActionNotice(`[${rec.title}] 기록물이 폐기 확정(폐기일자: ${finalDate})되어 [폐기확정목록]으로 이동되었습니다.`);
      },
    });
  };

  // Action: Single Defer
  const handleDeferSingle = (rec: RecordItem) => {
    onDeferRecords([rec.record_id]);
    setActionNotice(`[${rec.title}] 기록물이 폐기 보류 처리되었습니다. (원래 탭 보존 유지)`);
  };

  // Action: Single Undefer
  const handleUndeferSingle = (rec: RecordItem) => {
    onUndeferRecords([rec.record_id]);
    setActionNotice(`[${rec.title}] 기록물이 보류 취소되어 다시 폐기대상 목록으로 복귀되었습니다.`);
  };

  // Action: Excel Download
  const handleExportExcel = async () => {
    try {
      await exportDisposalTargetsToExcel(displayedRecords, baseYear, meta);
    } catch (err) {
      alert('엑셀 파일 생성 중 오류가 발생했습니다: ' + String(err));
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-rose-600" />
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              보존기간 만료 기록물 폐기대상 심사 및 관리
            </h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              만료 도달 {candidateRecords.length}건
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            설정한 기준연도 이전에 보존기간(10년, 5년, 3년, 1년)이 만료된 기록물을 조회합니다.
            선택하여 <strong className="text-rose-600">[폐기]</strong>하면 폐기확정목록으로 이동하며,
            <strong className="text-amber-600">[보류]</strong>하면 폐기대상에서 제외되고 원래 탭에 그대로 보존됩니다.
          </p>
        </div>

        {/* Base Year Selector & Excel Export */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center bg-slate-100 border border-slate-300 rounded-lg p-1 text-xs">
            <span className="px-2 font-bold text-slate-700 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              기준연도:
            </span>
            <button
              type="button"
              onClick={() => setBaseYear((prev) => prev - 1)}
              className="p-1 hover:bg-white rounded text-slate-600 transition-colors cursor-pointer"
              title="이전 연도"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="number"
              min={1980}
              max={2099}
              value={baseYear}
              onChange={(e) => setBaseYear(parseInt(e.target.value, 10) || currentYear)}
              className="w-16 text-center font-black text-sm text-blue-900 bg-white border border-slate-300 rounded py-0.5 px-1 focus:outline-blue-600"
            />
            <button
              type="button"
              onClick={() => setBaseYear((prev) => prev + 1)}
              className="p-1 hover:bg-white rounded text-slate-600 transition-colors cursor-pointer"
              title="다음 연도"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setBaseYear(currentYear)}
              className="ml-1 px-2 py-1 bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-[11px] font-semibold cursor-pointer"
            >
              올해
            </button>
          </div>

          <button
            type="button"
            id="btn-export-disposal-targets"
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            title="현재 목록 엑셀 파일로 다운로드"
          >
            <Download className="w-4 h-4" />
            폐기대상 Excel 다운로드
          </button>
        </div>
      </div>

      {/* Action Notice Alert */}
      {actionNotice && (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-blue-600 hover:text-blue-800 text-xs font-bold cursor-pointer"
          >
            닫기
          </button>
        </div>
      )}

      {/* Mode Tabs (폐기대상 vs 폐기보류) & Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => {
            setViewMode('target');
            setSelectedIds(new Set());
          }}
          className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
            viewMode === 'target'
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/20'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">폐기 심사 대상</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white">
              {targetRecords.length}건
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {baseYear}년 이전 만료 도달 (미보류)
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setViewMode('deferred');
            setSelectedIds(new Set());
          }}
          className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
            viewMode === 'deferred'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">폐기 보류 목록 (보류 취소 가능)</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-500 text-white">
              {deferredRecords.length}건
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            보류 취소 시 다시 폐기대상으로 복귀
          </p>
        </button>

        <div className="p-3.5 rounded-lg border border-slate-200 bg-white text-left">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">적용 보존기간 규격</span>
            <span className="text-xs font-bold text-slate-800">10년 · 5년 · 3년 · 1년</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            ※ 영구 및 준영구 기록물은 법령상 폐기 불가
          </p>
        </div>
      </div>

      {/* Deferred Reminder Banner in Target Mode */}
      {viewMode === 'target' && deferredRecords.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200 text-amber-900 px-4 py-2.5 rounded-lg text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <PauseCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              현재 폐기 보류 처리된 기록물이 총 <strong>{deferredRecords.length}건</strong> 있습니다.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setViewMode('deferred');
              setSelectedIds(new Set());
            }}
            className="text-amber-800 hover:text-amber-950 font-bold underline cursor-pointer text-xs"
          >
            보류 목록 보기 및 보류 취소하기 →
          </button>
        </div>
      )}

      {/* Filter and Action Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search and Period Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="제목, 상자번호, 서가위치 검색..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-blue-600"
            />
          </div>

          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="text-xs border border-slate-300 rounded px-2 py-1.5 bg-white font-medium text-slate-700 focus:outline-blue-600"
            >
              <option value="ALL">보존기간 전체</option>
              <option value="10년">10년</option>
              <option value="5년">5년</option>
              <option value="3년">3년</option>
              <option value="1년">1년</option>
            </select>
          </div>
        </div>

        {/* Batch Action Buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          {viewMode === 'target' ? (
            <>
              <button
                type="button"
                id="btn-dispose-selected"
                onClick={handleDisposeSelected}
                disabled={selectedIds.size === 0}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                선택 항목 폐기 확정 ({selectedIds.size})
              </button>

              <button
                type="button"
                id="btn-defer-selected"
                onClick={handleDeferSelected}
                disabled={selectedIds.size === 0}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <PauseCircle className="w-3.5 h-3.5" />
                선택 항목 보류 ({selectedIds.size})
              </button>
            </>
          ) : (
            <button
              type="button"
              id="btn-undefer-selected"
              onClick={handleUndeferSelected}
              disabled={selectedIds.size === 0}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              선택 항목 보류 취소 (다시 폐기대상으로) ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-semibold">
                <th className="p-2.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      displayedRecords.length > 0 &&
                      selectedIds.size === displayedRecords.length
                    }
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-slate-400 text-rose-600 focus:ring-rose-500"
                  />
                </th>
                <th className="p-2.5 w-12 text-center">연번</th>
                <th className="p-2.5 w-24 text-center">고유번호</th>
                <th className="p-2.5 w-16 text-center">구분</th>
                <th className="p-2.5 w-20 text-center">생산연도</th>
                <th className="p-2.5 w-20 text-center">종료연도</th>
                <th className="p-2.5 min-w-[260px]">기록물철제목</th>
                <th className="p-2.5 w-20 text-center">보존기간</th>
                <th className="p-2.5 w-20 text-center">만료연도</th>
                <th className="p-2.5 w-24 text-center">상자번호</th>
                <th className="p-2.5 w-20 text-center">서가번호</th>
                <th className="p-2.5 w-28 text-center">처리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {displayedRecords.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-10 text-center text-slate-500 bg-slate-50/50">
                    <p className="font-bold text-slate-700 text-sm mb-1">
                      {viewMode === 'target'
                        ? `${baseYear}년 기준 폐기대상 기록물이 없습니다.`
                        : '현재 보류된 기록물이 없습니다.'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {viewMode === 'target'
                        ? '기준연도를 변경하거나 검색 조건을 확인해보세요.'
                        : '폐기대상 목록에서 필요 시 [보류] 버튼을 누르면 이 목록으로 이동합니다.'}
                    </p>
                  </td>
                </tr>
              ) : (
                displayedRecords.map((row, idx) => {
                  const isSelected = selectedIds.has(row.record_id);
                  const expiryYear = calculateExpiryYear(row.end_year, row.retention_period);

                  return (
                    <tr
                      key={row.record_id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected
                          ? 'bg-rose-50/40'
                          : idx % 2 === 1
                          ? 'bg-slate-50/30'
                          : 'bg-white'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(row.record_id)}
                          className="rounded border-slate-400 text-rose-600 focus:ring-rose-500"
                        />
                      </td>

                      {/* Sequence */}
                      <td className="p-2.5 text-center text-slate-500 font-medium">
                        {idx + 1}
                      </td>

                      {/* Record No */}
                      <td className="p-2.5 text-center font-mono font-bold text-slate-700 text-[11px]">
                        {row.record_no || row.record_id}
                      </td>

                      {/* Type */}
                      <td className="p-2.5 text-center text-slate-600">
                        {row.record_type || '일반'}
                      </td>

                      {/* Start Year */}
                      <td className="p-2.5 text-center text-slate-700 font-medium">
                        {row.start_year}년
                      </td>

                      {/* End Year */}
                      <td className="p-2.5 text-center text-slate-700 font-medium">
                        {row.end_year}년
                      </td>

                      {/* Title */}
                      <td className="p-2.5 font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{row.title}</span>
                          {row.is_disposal_deferred && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                              보류중
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Retention Period */}
                      <td className="p-2.5 text-center">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                          {row.retention_period}
                        </span>
                      </td>

                      {/* Expiry Year */}
                      <td className="p-2.5 text-center font-bold text-rose-700 bg-rose-50/50">
                        {expiryYear}년
                      </td>

                      {/* Box No */}
                      <td className="p-2.5 text-center font-medium text-slate-800">
                        {row.box_no || '-'}
                      </td>

                      {/* Shelf No */}
                      <td className="p-2.5 text-center font-medium text-slate-700">
                        {row.shelf_no || '-'}
                      </td>

                      {/* Row Action */}
                      <td className="p-2 text-center">
                        {viewMode === 'target' ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDisposeSingle(row)}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-[11px] font-bold cursor-pointer transition-colors"
                              title="폐기 확정"
                            >
                              폐기
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeferSingle(row)}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded text-[11px] font-bold cursor-pointer transition-colors"
                              title="폐기 보류"
                            >
                              보류
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUndeferSingle(row)}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[11px] font-bold cursor-pointer transition-colors"
                            title="보류 취소 후 폐기대상 심사 목록으로 복귀"
                          >
                            보류 취소
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info banner */}
        <div className="p-3 bg-slate-50 border-t border-slate-300 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">
              표시 중: {displayedRecords.length}건
            </span>
            <span>(선택: {selectedIds.size}건)</span>
          </div>
          <div className="text-[11px] text-slate-500">
            ※ [보류] 처리 시 본 화면에서만 숨겨지며 해당 보존기간 탭(10년, 5년, 3년, 1년)에는 그대로 남아있습니다.
          </div>
        </div>
      </div>

      {/* In-app Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        detail={confirmModal.detail}
        confirmText={confirmModal.confirmText}
        confirmVariant={confirmModal.confirmVariant}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          setIsDisposingModal(false);
        }}
      >
        {isDisposingModal && (
          <div className="mt-3.5 p-3.5 bg-rose-50/70 border border-rose-200 rounded-lg text-xs space-y-2">
            <label className="block text-xs font-bold text-rose-950 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-rose-600" />
              폐기 확정일자 지정 (기본값: 오늘)
            </label>
            <input
              type="date"
              value={actionDisposalDate}
              onChange={(e) => handleDisposalDateChange(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-rose-300 rounded text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-2xs"
            />
            <p className="text-[11px] text-rose-700 leading-relaxed">
              💡 기본값은 오늘 날짜({new Date().toISOString().split('T')[0]})이며, 기록물평가심의회 의결일이나 폐기 결재 시행일자에 맞춰 변경할 수 있습니다.
            </p>
          </div>
        )}
      </ConfirmModal>
    </div>
  );
};
