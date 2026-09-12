import React, { useState, useMemo } from 'react';
import { RecordItem, DepartmentMeta } from '../types';
import {
  SendHorizontal,
  RotateCcw,
  Search,
  Building2,
  FileSpreadsheet,
  Trash2,
} from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import { exportTransferRecordsToExcel } from '../utils/excelUtils';

interface TransferListViewProps {
  records: RecordItem[];
  meta: DepartmentMeta;
  onCancelTransferRecords: (recordIds: string[]) => void;
  onPermanentDeleteRecords?: (recordIds: string[]) => void;
}

export const TransferListView: React.FC<TransferListViewProps> = ({
  records,
  meta,
  onCancelTransferRecords,
  onPermanentDeleteRecords,
}) => {
  // 기록관 이관 처리된 기록물 필터링 (미폐기 & 이관완료)
  const transferredRecords = useMemo(() => {
    return records.filter((r) => r.is_transferred && !r.is_disposed);
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
    if (!searchTerm.trim()) return transferredRecords;
    const q = searchTerm.toLowerCase();
    return transferredRecords.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.record_id.toLowerCase().includes(q) ||
        (r.record_no || '').toLowerCase().includes(q) ||
        r.box_no.toLowerCase().includes(q) ||
        r.shelf_no.toLowerCase().includes(q) ||
        (r.transfer_date || '').includes(q) ||
        (r.transfer_destination || '').toLowerCase().includes(q)
    );
  }, [transferredRecords, searchTerm]);

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

  // 선택 항목 이관 취소 (원상 복원)
  const handleCancelTransferSelected = () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const targetIds = Array.from(selectedIds);

    setConfirmModal({
      isOpen: true,
      title: '기록관 이관 취소 (원상 복원)',
      message: `선택한 ${count}건의 기록물에 대한 이관 처리를 취소하시겠습니까?`,
      detail: '이관 취소 시 해당 보존기간 관리 대장, 총괄 현황 집계 및 상자 라벨에 즉시 다시 정상 반영됩니다.',
      confirmText: '이관 취소(복원)',
      confirmVariant: 'primary',
      onConfirm: () => {
        onCancelTransferRecords(targetIds);
        setSelectedIds(new Set());
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // 단일 항목 이관 취소
  const handleCancelTransferSingle = (record: RecordItem) => {
    setConfirmModal({
      isOpen: true,
      title: '기록관 이관 취소 (원상 복원)',
      message: `기록물 "${record.title}"의 이관 처리를 취소하시겠습니까?`,
      detail: `이관 취소 시 [${record.retention_period}] 관리 대장 및 상자 라벨로 원상 복구됩니다.`,
      confirmText: '이관 취소(복원)',
      confirmVariant: 'primary',
      onConfirm: () => {
        onCancelTransferRecords([record.record_id]);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // 영구 삭제 (관리자용)
  const handlePermanentDeleteSelected = () => {
    if (selectedIds.size === 0 || !onPermanentDeleteRecords) return;
    const count = selectedIds.size;
    const targetIds = Array.from(selectedIds);

    setConfirmModal({
      isOpen: true,
      title: '이관 기록물 영구 삭제',
      message: `⚠️ 주의: 선택한 ${count}건의 기록물을 시스템에서 완전히 영구 삭제하시겠습니까?`,
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

  // 엑셀 내보내기
  const handleExportExcel = () => {
    exportTransferRecordsToExcel(transferredRecords, meta);
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <SendHorizontal className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              이관목록 (교육청 기록관 이관 기록물 관리 및 이력 대장)
            </h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
              이관완료 {transferredRecords.length}건
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            학교에서 교육청 기록관 등으로 이관된 기록물의 이력 및 상세 정보를 안전하게 관리하며, 필요 시 언제든 이관을 취소하여 원상태(보존 대장)로 복구할 수 있습니다.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="btn-export-transfer-excel"
            onClick={handleExportExcel}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold inline-flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
            title="이관 기록물 목록을 엑셀 파일로 다운로드합니다"
          >
            <FileSpreadsheet className="w-4 h-4" />
            이관목록 Excel 다운로드
          </button>

          {selectedIds.size > 0 && (
            <>
              <button
                id="btn-cancel-transfer-selected"
                onClick={handleCancelTransferSelected}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold inline-flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
                title="선택한 기록물의 이관을 취소하고 원래 보존대장으로 복원합니다"
              >
                <RotateCcw className="w-4 h-4" />
                선택 항목 이관 취소 ({selectedIds.size})
              </button>
              {onPermanentDeleteRecords && (
                <button
                  id="btn-permanent-delete-transfer"
                  onClick={handlePermanentDeleteSelected}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-red-50 text-red-700 border border-red-300 rounded text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  영구 삭제 ({selectedIds.size})
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Legal & Administrative Information Banner */}
      <div className="bg-slate-50 border border-slate-300 rounded-lg p-4 text-xs text-slate-700 space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <Building2 className="w-4 h-4 text-blue-600" />
          기록관 이관 기록물 관리 원칙 안내
        </div>
        <p className="leading-relaxed text-slate-600 pl-6">
          1. 교육청 기록관 등으로 이관 처리된 기록물은 학교 자체 보존 대장 및 라벨, 통계 현황에서 <strong>즉시 제외</strong>되어 관리 혼선을 방지합니다.<br />
          2. 인계·인수 증빙 및 감사 이력 관리를 위해 등록번호, 생산년도, 보존기간, 상자번호, 이관일자, 이관처 정보가 영구 관리됩니다.<br />
          3. <strong>[이관 취소]</strong>를 누르면 즉시 원상태로 복귀되어 원래 보존기간(영구/준영구/30년/10년/5년/3년/1년) 대장에 다시 정상 표시됩니다.
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
            placeholder="이관 기록물 제목, 관리번호, 고유번호, 상자번호, 이관일자, 이관처 검색..."
            className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-blue-600"
          />
        </div>
        <div className="text-slate-500 font-medium">
          총 {filteredRecords.length}건 표시 중
        </div>
      </div>

      {/* Transferred Records Table */}
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
                    className="rounded border-slate-400 text-blue-600 focus:ring-blue-500"
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
                <th className="p-2.5 w-28 text-center bg-blue-50/50">이관일자</th>
                <th className="p-2.5 w-36 text-center bg-blue-50/50">이관처</th>
                <th className="p-2.5 w-24 text-center">이관 취소</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400 text-sm">
                    {searchTerm
                      ? '검색어와 일치하는 이관 기록물이 없습니다.'
                      : '현재 기록관으로 이관된 기록물이 없습니다. (각 보존기간 탭에서 기록물을 선택하여 [기록관 이관]을 실행할 수 있습니다.)'}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record, idx) => {
                  const isSelected = selectedIds.has(record.record_id);

                  return (
                    <tr
                      key={record.record_id}
                      className={`divide-x divide-slate-200 hover:bg-blue-50/30 transition-colors ${
                        isSelected ? 'bg-blue-50/70' : idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                      }`}
                    >
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(record.record_id)}
                          className="rounded border-slate-400 text-blue-600 focus:ring-blue-500"
                        />
                      </td>

                      <td className="p-2 text-center text-slate-500 font-medium">{idx + 1}</td>

                      <td className="p-2 text-center font-mono font-bold text-slate-800 text-xs">
                        <div className="text-slate-900">{record.record_no || record.record_id}</div>
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
                        <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {record.retention_period}
                        </span>
                      </td>

                      <td className="p-2">
                        <span className="font-semibold text-slate-900 leading-snug">
                          {record.title}
                        </span>
                      </td>

                      <td className="p-2 text-center font-mono font-bold text-slate-700">
                        {record.box_no || '-'}
                      </td>

                      <td className="p-2 text-center font-mono text-slate-600">
                        {record.shelf_no || '-'}
                      </td>

                      <td className="p-2 text-center font-mono text-blue-700 font-bold bg-blue-50/30 text-[11px]">
                        {record.transfer_date || '-'}
                      </td>

                      <td className="p-2 text-center text-slate-700 text-[11px] font-medium bg-blue-50/20">
                        {record.transfer_destination || '전북특별자치도교육청 기록관'}
                      </td>

                      <td className="p-2 text-center">
                        <button
                          onClick={() => handleCancelTransferSingle(record)}
                          className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 rounded text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                          title="기록관 이관 취소 (원래 보존대장으로 복귀)"
                        >
                          <RotateCcw className="w-3 h-3" />
                          이관 취소
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
