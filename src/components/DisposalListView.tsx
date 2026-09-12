import React, { useState, useMemo } from 'react';
import { RecordItem } from '../types';
import {
  Trash2,
  RotateCcw,
  Search,
  Calendar,
  AlertCircle,
  ArchiveRestore,
  ShieldAlert,
} from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

interface DisposalListViewProps {
  records: RecordItem[];
  onRestoreRecords: (recordIds: string[]) => void;
  onPermanentDeleteRecords: (recordIds: string[]) => void;
}

export const DisposalListView: React.FC<DisposalListViewProps> = ({
  records,
  onRestoreRecords,
  onPermanentDeleteRecords,
}) => {
  // 폐기 처리된 기록물만 필터링
  const disposedRecords = useMemo(() => {
    return records.filter((r) => r.is_disposed);
  }, [records]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 인앱 확인 모달 상태
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

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return disposedRecords;
    const q = searchTerm.toLowerCase();
    return disposedRecords.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.record_id.toLowerCase().includes(q) ||
        r.box_no.toLowerCase().includes(q) ||
        (r.disposal_date || '').includes(q)
    );
  }, [disposedRecords, searchTerm]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredRecords.map((r) => r.record_id)));
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

  // 복원 처리
  const handleRestoreSelected = () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const targetIds = Array.from(selectedIds);

    setConfirmModal({
      isOpen: true,
      title: '기록물 복원 확인',
      message: `선택한 ${count}건의 기록물을 원상태로 복원하시겠습니까?`,
      detail: '복원 시 해당 보존기간 관리 화면, 총괄 현황 집계 및 상자 라벨에 다시 정상 반영됩니다.',
      confirmText: '기록물 복원',
      confirmVariant: 'primary',
      onConfirm: () => {
        onRestoreRecords(targetIds);
        setSelectedIds(new Set());
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleRestoreSingle = (record: RecordItem) => {
    setConfirmModal({
      isOpen: true,
      title: '기록물 복원 확인',
      message: `기록물 "${record.title}"을(를) [${record.retention_period}] 관리 대장으로 복원하시겠습니까?`,
      detail: '복원 시 해당 보존기간 탭 및 상자 라벨에 즉시 다시 포함됩니다.',
      confirmText: '복원하기',
      confirmVariant: 'primary',
      onConfirm: () => {
        onRestoreRecords([record.record_id]);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // 영구 삭제 (보존목록에서도 완전 제거)
  const handlePermanentDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const targetIds = Array.from(selectedIds);

    setConfirmModal({
      isOpen: true,
      title: '폐기 기록물 영구 삭제',
      message: `⚠️ 주의: 선택한 ${count}건의 폐기 기록물을 시스템에서 완전히 영구 삭제하시겠습니까?`,
      detail: '영구 삭제 시 복구할 수 없습니다.',
      confirmText: '영구 삭제',
      confirmVariant: 'danger',
      onConfirm: () => {
        onPermanentDeleteRecords(targetIds);
        setSelectedIds(new Set());
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-rose-600" />
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              폐기확정목록 (보존기록물 폐기 이력 및 보존 스냅샷 대장)
            </h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
              폐기확정 {disposedRecords.length}건
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            공공기록물 관리 규정에 따라 폐기 처리된 기록물의 폐기 당시 상태(스냅샷)를 안전하게 영구 보존하며, 필요시 언제든 원상태로 복원할 수 있습니다.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.size > 0 && (
            <>
              <button
                id="btn-restore-selected"
                onClick={handleRestoreSelected}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <ArchiveRestore className="w-4 h-4" />
                선택 항목 원상 복원 ({selectedIds.size})
              </button>
              <button
                id="btn-permanent-delete"
                onClick={handlePermanentDeleteSelected}
                className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-rose-700 border border-rose-300 rounded text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                영구 삭제 ({selectedIds.size})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Legal & Audit Information Banner */}
      <div className="bg-slate-50 border border-slate-300 rounded-lg p-4 text-xs text-slate-700 space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <ShieldAlert className="w-4 h-4 text-rose-600" />
          폐기 기록물 관리 원칙 안내
        </div>
        <p className="leading-relaxed text-slate-600 pl-6">
          1. 폐기된 기록물은 일반 보존 대장 및 라벨, 통계 현황에서 <strong>즉시 제외</strong>되어 업무 혼선을 방지합니다.<br />
          2. 단, 법적 감사와 이력 증빙을 위하여 관리번호(record_id), 생산년도, 보존기간, 상자번호, 폐기일자 정보는 본 목록에 영구 보존됩니다.<br />
          3. <strong>[복원하기]</strong>를 누르면 원본 상태로 복귀되어 해당 보존기간 화면에 다시 나타납니다.
        </p>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs flex items-center justify-between gap-3 text-xs">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="폐기 기록물 제목, 관리번호, 상자번호, 폐기일자 검색..."
            className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-blue-600"
          />
        </div>
        <div className="text-slate-500 font-medium">
          총 {filteredRecords.length}건 표시 중
        </div>
      </div>

      {/* Disposed Records Table */}
      <div className="bg-white border border-slate-300 rounded-lg shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 divide-x divide-slate-300">
                <th className="p-2.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredRecords.length > 0 &&
                      selectedIds.size === filteredRecords.length
                    }
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-slate-400 text-rose-600 focus:ring-rose-500"
                  />
                </th>
                <th className="p-2.5 w-12 text-center">순번</th>
                <th className="p-2.5 w-32 text-center">기록물 고유번호</th>
                <th className="p-2.5 w-16 text-center">유형</th>
                <th className="p-2.5 w-20 text-center">생산년도</th>
                <th className="p-2.5 w-20 text-center">종료년도</th>
                <th className="p-2.5 w-20 text-center">보존기간</th>
                <th className="p-2.5 min-w-[280px]">기록물철제목</th>
                <th className="p-2.5 w-20 text-center">상자번호</th>
                <th className="p-2.5 w-20 text-center">서가번호</th>
                <th className="p-2.5 w-28 text-center bg-rose-50/50">폐기일자</th>
                <th className="p-2.5 w-20 text-center">복원</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400 text-sm">
                    {searchTerm
                      ? '검색어와 일치하는 폐기 기록물이 없습니다.'
                      : '현재 폐기 처리된 기록물이 없습니다. (정상 관리 중)'}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record, idx) => {
                  const isSelected = selectedIds.has(record.record_id);

                  return (
                    <tr
                      key={record.record_id}
                      className={`divide-x divide-slate-200 hover:bg-rose-50/30 transition-colors ${
                        isSelected ? 'bg-rose-50/70' : idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                      }`}
                    >
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(record.record_id)}
                          className="rounded border-slate-400 text-rose-600 focus:ring-rose-500"
                        />
                      </td>

                      <td className="p-2 text-center text-slate-500 font-medium">{idx + 1}</td>

                      <td className="p-2 text-center font-mono font-bold text-slate-800 text-xs">
                        <div className="text-slate-900 line-through opacity-85">{record.record_no || record.record_id}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{record.record_id}</div>
                      </td>

                      <td className="p-2 text-center">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {record.record_type}
                        </span>
                      </td>

                      <td className="p-2 text-center font-medium text-slate-700">
                        {record.start_year}년
                      </td>

                      <td className="p-2 text-center font-medium text-slate-700">
                        {record.end_year}년
                      </td>

                      <td className="p-2 text-center font-bold text-slate-800">
                        {record.retention_period}
                      </td>

                      <td className="p-2">
                        <span className="font-semibold text-slate-900 leading-snug line-through opacity-85">
                          {record.title}
                        </span>
                      </td>

                      <td className="p-2 text-center font-mono font-bold text-slate-700">
                        {record.box_no}
                      </td>

                      <td className="p-2 text-center font-mono text-slate-600">
                        {record.shelf_no}
                      </td>

                      <td className="p-2 text-center font-mono text-rose-700 font-bold bg-rose-50/30 text-[11px]">
                        {record.disposal_date || '-'}
                      </td>

                      <td className="p-2 text-center">
                        <button
                          onClick={() => handleRestoreSingle(record)}
                          className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          title="기록물 원상태로 복원"
                        >
                          <RotateCcw className="w-3 h-3" />
                          복원
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        detail={confirmModal.detail}
        confirmText={confirmModal.confirmText}
        confirmVariant={confirmModal.confirmVariant}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
