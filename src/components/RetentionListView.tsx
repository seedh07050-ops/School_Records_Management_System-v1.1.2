import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  RecordItem,
  RecordType,
  RetentionPeriod,
  RETENTION_PERIODS,
  DepartmentMeta,
} from '../types';
import {
  Search,
  Filter,
  ArrowUpDown,
  Trash2,
  Edit2,
  Check,
  X,
  Layers,
  AlertTriangle,
  Printer,
  FileEdit,
  Save,
  Archive,
  CheckCircle2,
  SendHorizontal,
  Calendar,
} from 'lucide-react';
import {
  calculateExpiryYear,
  updateRecordNoOnPeriodChange,
  recommendBoxNo,
  getExistingBoxNumbers,
} from '../utils/recordUtils';
import { ConfirmModal } from './ConfirmModal';

interface RetentionListViewProps {
  currentPeriod: RetentionPeriod;
  records: RecordItem[];
  meta?: DepartmentMeta;
  onUpdateRecord: (updatedRecord: RecordItem) => void;
  onUpdateRecords?: (updatedRecords: RecordItem[]) => void;
  onDeleteRecords?: (recordIds: string[]) => void;
  onDisposeRecords: (recordIds: string[], reason?: string, customDate?: string) => void;
  onTransferRecords?: (recordIds: string[], destination?: string, customDate?: string) => void;
  onOpenLabelModal: () => void;
}

type SortField = 'record_id' | 'title' | 'start_year' | 'end_year' | 'expiry_year' | 'box_no';
type SortOrder = 'asc' | 'desc';

export const RetentionListView: React.FC<RetentionListViewProps> = ({
  currentPeriod,
  records,
  meta,
  onUpdateRecord,
  onUpdateRecords,
  onDeleteRecords,
  onDisposeRecords,
  onTransferRecords,
  onOpenLabelModal,
}) => {
  // 1. 단일 원본(Source of Truth) 필터링: 활성(정식) & 미폐기 & 미이관 & 현재 보존기간 일치
  const periodRecords = useMemo(() => {
    return records.filter(
      (r) => r.is_completed && !r.is_disposed && !r.is_transferred && r.retention_period === currentPeriod
    );
  }, [records, currentPeriod]);

  // 검색 및 필터 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterBox, setFilterBox] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');

  // 정렬 상태
  const [sortField, setSortField] = useState<SortField>('box_no');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // 체크박스 선택된 레코드 ID 목록
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 사용자 안내 토스트 알림 상태
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // 폐기 및 이관 시 확정일자 입력 상태
  const [actionConfirmDate, setActionConfirmDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const actionConfirmDateRef = useRef<string>(new Date().toISOString().split('T')[0]);
  const [actionDestination, setActionDestination] = useState<string>('전북특별자치도교육청 기록관');
  const actionDestinationRef = useRef<string>('전북특별자치도교육청 기록관');
  const [actionType, setActionType] = useState<'dispose' | 'transfer' | null>(null);

  const handleActionDateChange = (val: string) => {
    setActionConfirmDate(val);
    actionConfirmDateRef.current = val;
  };

  const handleActionDestinationChange = (val: string) => {
    setActionDestination(val);
    actionDestinationRef.current = val;
  };

  // 인앱 확인 모달 상태 (브라우저 iframe의 confirm 차단 방지)
  const [confirmModalState, setConfirmModalState] = useState<{
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

  // 토스트 3.5초 후 자동 숨김
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 전체 자료 수정 모드 상태 (요구사항 2, 3, 4)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const [isFullEditMode, setIsFullEditMode] = useState(false);
  // 편집 중인 행들의 임시 데이터 맵 (key: record_id, value: RecordItem)
  const [editMap, setEditMap] = useState<Record<string, RecordItem>>({});
  // 사용자가 직접 상자번호를 입력/수정한 레코드 ID 추적 (자동 추천값으로 함부로 덮어쓰지 않기 위함 - 요구사항 7)
  const [manuallyEditedBoxIds, setManuallyEditedBoxIds] = useState<Set<string>>(new Set());

  // 일괄 변경 모달 상태 (추가 편의 기능)
  const [bulkChangeOpen, setBulkChangeOpen] = useState(false);
  const [bulkTargetBox, setBulkTargetBox] = useState('');
  const [bulkTargetShelf, setBulkTargetShelf] = useState('');
  const [bulkTargetPeriod, setBulkTargetPeriod] = useState<RetentionPeriod>(currentPeriod);

  // 고유 상자번호 및 생산년도 목록 (필터 드롭다운용)
  const uniqueBoxes = useMemo(() => {
    const boxes = Array.from(new Set(periodRecords.map((r) => r.box_no).filter(Boolean)));
    return (boxes as string[]).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [periodRecords]);

  const uniqueYears = useMemo(() => {
    const years = Array.from(new Set(periodRecords.map((r) => r.start_year).filter(Boolean)));
    return (years as number[]).sort((a, b) => b - a);
  }, [periodRecords]);

  // 검색/필터/정렬 적용된 목록 (조회 모드 및 편집 모드에서 테이블 표시 대상)
  const filteredAndSortedRecords = useMemo(() => {
    let result = periodRecords.filter((r) => {
      // 텍스트 검색
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchTitle = r.title.toLowerCase().includes(query);
        const matchId = (r.record_no || r.record_id).toLowerCase().includes(query);
        const matchBox = r.box_no.toLowerCase().includes(query);
        const matchShelf = r.shelf_no.toLowerCase().includes(query);
        const matchYear = String(r.start_year).includes(query) || String(r.end_year).includes(query);
        if (!matchTitle && !matchId && !matchBox && !matchShelf && !matchYear) {
          return false;
        }
      }

      // 유형 필터
      if (filterType !== 'all' && r.record_type !== filterType) {
        return false;
      }

      // 상자 필터
      if (filterBox !== 'all' && r.box_no !== filterBox) {
        return false;
      }

      // 년도 필터
      if (filterYear !== 'all' && String(r.start_year) !== filterYear) {
        return false;
      }

      return true;
    });

    // 정렬
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'record_id') {
        const idA = a.record_no || a.record_id;
        const idB = b.record_no || b.record_id;
        cmp = idA.localeCompare(idB, undefined, { numeric: true });
      } else if (sortField === 'title') {
        cmp = a.title.localeCompare(b.title);
      } else if (sortField === 'start_year') {
        cmp = a.start_year - b.start_year;
      } else if (sortField === 'end_year') {
        cmp = a.end_year - b.end_year;
      } else if (sortField === 'box_no') {
        cmp = a.box_no.localeCompare(b.box_no, undefined, { numeric: true });
      } else if (sortField === 'expiry_year') {
        const eyA = calculateExpiryYear(a.end_year, a.retention_period);
        const eyB = calculateExpiryYear(b.end_year, b.retention_period);
        cmp = eyA.localeCompare(eyB);
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [periodRecords, searchTerm, filterType, filterBox, filterYear, sortField, sortOrder]);

  // 체크박스 핸들러
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredAndSortedRecords.map((r) => r.record_id)));
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 전체 수정 모드 제어 (요구사항 2, 3, 4, 5, 6, 7)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleStartFullEdit = () => {
    if (filteredAndSortedRecords.length === 0) {
      setToastMessage({ text: '수정할 기록물이 없습니다.', type: 'info' });
      return;
    }
    const initialMap: Record<string, RecordItem> = {};
    filteredAndSortedRecords.forEach((r) => {
      initialMap[r.record_id] = { ...r };
    });
    setEditMap(initialMap);
    setManuallyEditedBoxIds(new Set());
    setIsFullEditMode(true);
    setToastMessage({
      text: '전체 자료 수정 모드가 활성화되었습니다. 내용을 수정한 후 상단의 [수정완료]를 누르세요.',
      type: 'info',
    });
  };

  const handleCancelFullEdit = () => {
    setIsFullEditMode(false);
    setEditMap({});
    setManuallyEditedBoxIds(new Set());
    setToastMessage({ text: '수정이 취소되었습니다.', type: 'info' });
  };

  const handleFieldChange = (
    recordId: string,
    field: keyof RecordItem,
    value: any
  ) => {
    setEditMap((prev) => {
      const current = prev[recordId];
      if (!current) return prev;

      const updated = { ...current };

      if (field === 'box_no') {
        updated.box_no = String(value);
        // 사용자가 직접 상자번호를 수정한 것으로 기록
        setManuallyEditedBoxIds((m) => new Set(m).add(recordId));
      } else if (field === 'end_year') {
        const num = parseInt(value, 10) || 0;
        updated.end_year = num;
        // 종료년도 변경 시: 기존에 상자번호가 입력되어 있고 사용자가 수동 고정하지 않은 경우에만 자동 갱신
        if (!manuallyEditedBoxIds.has(recordId) && updated.box_no && updated.box_no.trim() !== '') {
          updated.box_no = recommendBoxNo(updated.retention_period, num, records);
        }
      } else if (field === 'retention_period') {
        const newPeriod = value as RetentionPeriod;
        updated.retention_period = newPeriod;
        // 보존기간 변경 시 고유번호 접두사 자동 업데이트 (예: 5년-000064 -> 10년-000064)
        updated.record_no = updateRecordNoOnPeriodChange(
          updated.record_no,
          newPeriod,
          records,
          updated.record_id
        );
        // 기존에 상자번호가 입력되어 있고 사용자가 직접 상자번호를 고정하지 않은 경우에만 보존기간에 맞춰 자동 갱신
        if (!manuallyEditedBoxIds.has(recordId) && updated.box_no && updated.box_no.trim() !== '') {
          updated.box_no = recommendBoxNo(newPeriod, updated.end_year, records);
        }
      } else if (field === 'start_year') {
        updated.start_year = parseInt(value, 10) || 0;
      } else {
        (updated as any)[field] = value;
      }

      return { ...prev, [recordId]: updated };
    });
  };

  const handleSaveFullEdit = () => {
    const updatedItems: RecordItem[] = Object.values(editMap);
    if (updatedItems.length === 0) {
      setIsFullEditMode(false);
      return;
    }

    // 유효성 검사: 제목 필수 입력
    for (const item of updatedItems) {
      if (!item.title.trim()) {
        setToastMessage({
          text: `[기록물: ${item.record_no || item.record_id}]의 기록물철제목이 비어있습니다. 제목을 입력해주세요.`,
          type: 'error',
        });
        return;
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const finalUpdatedList = updatedItems.map((item) => ({
      ...item,
      updated_at: today,
    }));

    if (onUpdateRecords) {
      onUpdateRecords(finalUpdatedList);
    } else {
      finalUpdatedList.forEach((item) => onUpdateRecord(item));
    }

    setIsFullEditMode(false);
    setEditMap({});
    setManuallyEditedBoxIds(new Set());

    // 보존기간이 변경된 건수 계산
    const movedCount = finalUpdatedList.filter(
      (item) => item.retention_period !== currentPeriod
    ).length;

    if (movedCount > 0) {
      setToastMessage({
        text: `수정 완료: 총 ${finalUpdatedList.length}건이 성공적으로 저장되었습니다. (보존기간이 변경된 ${movedCount}건은 해당 보존기간 탭으로 이동되었습니다)`,
        type: 'success',
      });
    } else {
      setToastMessage({
        text: `수정 완료: 총 ${finalUpdatedList.length}건의 수정 내용이 성공적으로 저장되었습니다.`,
        type: 'success',
      });
    }
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 삭제 기능 (요구사항 8, 10)
  // 원본 데이터에서 영구 제거 (폐기목록에 남기지 않음)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) {
      setToastMessage({ text: '삭제할 기록물을 선택해주세요.', type: 'info' });
      return;
    }

    const count = selectedIds.size;
    const targetIds = Array.from(selectedIds);

    setConfirmModalState({
      isOpen: true,
      title: '기록물 영구 삭제 확인',
      message: `선택한 ${count}건의 기록물을 완전히 삭제하시겠습니까?`,
      detail: '⚠️ 삭제된 자료는 시스템에서 영구히 제거되며 복구할 수 없습니다.\n(폐기 후 보존하려면 [선택 항목 폐기]를 사용하세요)',
      confirmText: '영구 삭제',
      confirmVariant: 'danger',
      onConfirm: () => {
        if (onDeleteRecords) {
          onDeleteRecords(targetIds);
        }
        setSelectedIds(new Set());
        setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
        setToastMessage({
          text: `선택한 ${count}건의 기록물이 영구 삭제되었습니다.`,
          type: 'success',
        });
      },
    });
  };

  const handleDeleteSingle = (record: RecordItem) => {
    setConfirmModalState({
      isOpen: true,
      title: '기록물 영구 삭제 확인',
      message: `기록물 "${record.title}"을(를) 삭제하시겠습니까?`,
      detail: '⚠️ 삭제된 자료는 시스템에서 영구히 제거되며 복구할 수 없습니다.',
      confirmText: '영구 삭제',
      confirmVariant: 'danger',
      onConfirm: () => {
        if (onDeleteRecords) {
          onDeleteRecords([record.record_id]);
        }
        setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
        setToastMessage({
          text: `기록물 "${record.title}"이(가) 삭제되었습니다.`,
          type: 'success',
        });
      },
    });
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 폐기 기능 (요구사항 9, 10)
  // 현재 관리 화면 및 라벨에서 제외하고 「폐기목록」에 안전 보존
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleDisposeSelected = () => {
    if (selectedIds.size === 0) {
      setToastMessage({ text: '폐기할 기록물을 선택해주세요.', type: 'info' });
      return;
    }

    const count = selectedIds.size;
    const targetIds = Array.from(selectedIds);
    const today = new Date().toISOString().split('T')[0];
    handleActionDateChange(today);
    setActionType('dispose');

    setConfirmModalState({
      isOpen: true,
      title: '기록물 폐기 처리 확인',
      message: `선택한 ${count}건의 기록물을 폐기 처리하시겠습니까?`,
      detail: 'ℹ️ 폐기된 기록물은 현재 관리 목록에서 제외되며, [폐기확정목록] 탭에 안전하게 스냅샷 보존됩니다. 필요 시 언제든 복원할 수 있습니다.',
      confirmText: '폐기 처리',
      confirmVariant: 'rose',
      onConfirm: () => {
        const finalDate = actionConfirmDateRef.current || today;
        onDisposeRecords(targetIds, undefined, finalDate);
        setSelectedIds(new Set());
        setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
        setActionType(null);
        setToastMessage({
          text: `선택한 ${count}건의 기록물이 폐기 처리(폐기일자: ${finalDate})되어 [폐기확정목록]으로 이동했습니다.`,
          type: 'success',
        });
      },
    });
  };

  const handleDisposeSingle = (record: RecordItem) => {
    const today = new Date().toISOString().split('T')[0];
    handleActionDateChange(today);
    setActionType('dispose');

    setConfirmModalState({
      isOpen: true,
      title: '기록물 폐기 처리 확인',
      message: `기록물 "${record.title}"을(를) 폐기 처리하시겠습니까?`,
      detail: 'ℹ️ 폐기된 기록물은 현재 관리 목록에서 제외되며, [폐기확정목록] 탭에 안전하게 보존됩니다.',
      confirmText: '폐기 처리',
      confirmVariant: 'rose',
      onConfirm: () => {
        const finalDate = actionConfirmDateRef.current || today;
        onDisposeRecords([record.record_id], undefined, finalDate);
        setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
        setActionType(null);
        setToastMessage({
          text: `기록물 "${record.title}"이(가) 폐기 처리(폐기일자: ${finalDate})되었습니다.`,
          type: 'success',
        });
      },
    });
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 기록관 이관 기능 (요구사항 5)
  // 현재 관리 화면 및 라벨에서 제외하고 「이관목록」에 안전 보존
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleTransferSelected = () => {
    if (selectedIds.size === 0) {
      setToastMessage({ text: '이관할 기록물을 선택해주세요.', type: 'info' });
      return;
    }

    const count = selectedIds.size;
    const targetIds = Array.from(selectedIds);
    const today = new Date().toISOString().split('T')[0];
    handleActionDateChange(today);
    setActionType('transfer');

    setConfirmModalState({
      isOpen: true,
      title: '기록관 이관 처리 확인',
      message: `선택한 ${count}건의 기록물을 교육청 기록관 등으로 이관 처리하시겠습니까?`,
      detail: 'ℹ️ 이관된 기록물은 현재 보존 대장에서 제외되며, [이관목록] 탭에 안전하게 보존·관리됩니다. 필요 시 이관목록에서 언제든 이관 취소하여 원상 복원할 수 있습니다.',
      confirmText: '기록관 이관',
      confirmVariant: 'primary',
      onConfirm: () => {
        const finalDate = actionConfirmDateRef.current || today;
        const finalDest = actionDestinationRef.current || '전북특별자치도교육청 기록관';
        if (onTransferRecords) {
          onTransferRecords(targetIds, finalDest, finalDate);
        }
        setSelectedIds(new Set());
        setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
        setActionType(null);
        setToastMessage({
          text: `선택한 ${count}건의 기록물이 이관 처리(이관일자: ${finalDate})되어 [이관목록]으로 이동했습니다.`,
          type: 'success',
        });
      },
    });
  };

  const handleTransferSingle = (record: RecordItem) => {
    const today = new Date().toISOString().split('T')[0];
    handleActionDateChange(today);
    setActionType('transfer');

    setConfirmModalState({
      isOpen: true,
      title: '기록관 이관 처리 확인',
      message: `기록물 "${record.title}"을(를) 교육청 기록관으로 이관 처리하시겠습니까?`,
      detail: 'ℹ️ 이관된 기록물은 현재 보존 대장에서 제외되며, [이관목록] 탭에 안전하게 보존됩니다. 필요 시 이관목록에서 이관 취소할 수 있습니다.',
      confirmText: '기록관 이관',
      confirmVariant: 'primary',
      onConfirm: () => {
        const finalDate = actionConfirmDateRef.current || today;
        const finalDest = actionDestinationRef.current || '전북특별자치도교육청 기록관';
        if (onTransferRecords) {
          onTransferRecords([record.record_id], finalDest, finalDate);
        }
        setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
        setActionType(null);
        setToastMessage({
          text: `기록물 "${record.title}"이(가) 기록관으로 이관 처리(이관일자: ${finalDate})되었습니다.`,
          type: 'success',
        });
      },
    });
  };

  // 일괄 수정 적용 모달 핸들러 (선택 항목에 일괄 적용)
  const handleApplyBulkChange = () => {
    if (selectedIds.size === 0) return;

    const targetRecords = records.filter((r) => selectedIds.has(r.record_id));
    const updatedList: RecordItem[] = [];

    targetRecords.forEach((r) => {
      const updated = { ...r };
      if (bulkTargetBox.trim()) updated.box_no = bulkTargetBox.trim();
      if (bulkTargetShelf.trim()) updated.shelf_no = bulkTargetShelf.trim();
      if (bulkTargetPeriod !== currentPeriod) {
        updated.retention_period = bulkTargetPeriod;
        updated.record_no = updateRecordNoOnPeriodChange(
          updated.record_no,
          bulkTargetPeriod,
          records,
          updated.record_id
        );
        if (!bulkTargetBox.trim()) {
          updated.box_no = recommendBoxNo(bulkTargetPeriod, updated.end_year, records);
        }
      }
      updatedList.push(updated);
    });

    if (onUpdateRecords) {
      onUpdateRecords(updatedList);
    } else {
      updatedList.forEach((u) => onUpdateRecord(u));
    }

    setBulkChangeOpen(false);
    setSelectedIds(new Set());
    setToastMessage({
      text: `선택한 ${updatedList.length}건의 정보가 일괄 변경되었습니다.`,
      type: 'success',
    });
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Top Banner & Action Controls */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              보존기간: <span className="text-blue-700 font-extrabold">{currentPeriod}</span> 기록물철 관리대장
            </h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
              총 {periodRecords.length}건
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isFullEditMode
              ? '현재 [전체 자료 수정 모드]입니다. 표 안의 항목들을 자유롭게 수정한 후 [수정완료] 버튼을 눌러 일괄 저장하세요.'
              : `보존기간이 [${currentPeriod}]인 관리 대상 기록물 목록입니다. 수정이 필요할 경우 [수정] 버튼을 누르면 전체 행을 동시에 수정할 수 있습니다.`}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {isFullEditMode ? (
            /* 전체 자료 수정 모드 전용 버튼 (요구사항 3, 4) */
            <>
              <button
                id="btn-save-full-edit"
                type="button"
                onClick={handleSaveFullEdit}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
              >
                <Check className="w-4 h-4" />
                수정완료
              </button>
              <button
                id="btn-cancel-full-edit"
                type="button"
                onClick={handleCancelFullEdit}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
                수정취소
              </button>
            </>
          ) : (
            /* 일반 조회 모드 전용 버튼 (요구사항 2, 8, 9) */
            <>
              {selectedIds.size > 0 && (
                <>
                  <button
                    id="btn-delete-selected"
                    type="button"
                    onClick={handleDeleteSelected}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shadow-xs transition-colors"
                    title="선택한 기록물을 시스템에서 완전히 영구 삭제합니다 (폐기목록에 남지 않음)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    선택 항목 삭제 ({selectedIds.size})
                  </button>

                  <button
                    id="btn-transfer-selected"
                    type="button"
                    onClick={handleTransferSelected}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shadow-xs transition-colors"
                    title="선택한 기록물을 교육청 기록관으로 이관 처리하고 「이관목록」에 안전하게 보존합니다"
                  >
                    <SendHorizontal className="w-3.5 h-3.5" />
                    선택 항목 이관 ({selectedIds.size})
                  </button>

                  <button
                    id="btn-dispose-selected"
                    type="button"
                    onClick={handleDisposeSelected}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shadow-xs transition-colors"
                    title="선택한 기록물을 폐기 처리하고 「폐기목록」에 안전하게 보존합니다"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    선택 항목 폐기 ({selectedIds.size})
                  </button>

                  <button
                    id="btn-bulk-edit-modal"
                    type="button"
                    onClick={() => setBulkChangeOpen(true)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    일괄 변경 ({selectedIds.size})
                  </button>
                </>
              )}

              {/* 전체 수정 모드 진입 버튼 (요구사항 2, 3) */}
              <button
                id="btn-start-full-edit"
                type="button"
                onClick={handleStartFullEdit}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                title="해당 탭의 전체 기록물을 한꺼번에 수정 가능한 상태로 전환합니다"
              >
                <Edit2 className="w-3.5 h-3.5" />
                수정
              </button>

              <button
                type="button"
                onClick={onOpenLabelModal}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                라벨지 출력
              </button>
            </>
          )}
        </div>
      </div>

      {/* Editing Guide Banner (Active when full edit mode is on) */}
      {isFullEditMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileEdit className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>
              <strong>전체 자료 수정 모드 실행 중:</strong> 기록물철제목, 생산년도, 종료년도, 보존기간, 상자번호, 서가번호를 표에서 직접 수정한 후 상단의 <strong>[수정완료]</strong>를 클릭하세요. (보존기간을 변경한 행은 저장 시 변경된 보존기간 탭으로 자동 이동합니다)
            </span>
          </div>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="제목, 관리번호, 상자번호, 서가번호, 년도 검색..."
            className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-blue-600 bg-slate-50 focus:bg-white"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Selects */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-medium">유형:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1 bg-white"
            >
              <option value="all">전체</option>
              <option value="일반">일반</option>
              <option value="시청각">시청각</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-medium">상자:</span>
            <select
              value={filterBox}
              onChange={(e) => setFilterBox(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1 bg-white"
            >
              <option value="all">전체 상자</option>
              {uniqueBoxes.map((b) => (
                <option key={b} value={b}>
                  상자 {b}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-medium">생산년도:</span>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1 bg-white"
            >
              <option value="all">전체 년도</option>
              {uniqueYears.map((y) => (
                <option key={y} value={String(y)}>
                  {y}년
                </option>
              ))}
            </select>
          </div>

          {(searchTerm || filterType !== 'all' || filterBox !== 'all' || filterYear !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterType('all');
                setFilterBox('all');
                setFilterYear('all');
              }}
              className="text-blue-600 hover:text-blue-800 underline font-medium cursor-pointer"
            >
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-300 rounded-lg shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 divide-x divide-slate-300">
                <th className="p-2.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredAndSortedRecords.length > 0 &&
                      selectedIds.size === filteredAndSortedRecords.length
                    }
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    disabled={isFullEditMode}
                    className="rounded border-slate-400 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="p-2.5 w-12 text-center">순번</th>
                <th
                  onClick={() => toggleSort('record_id')}
                  className="p-2.5 w-32 text-center cursor-pointer hover:bg-slate-200"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>기록물 고유번호</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-2.5 w-20 text-center">유형</th>
                <th
                  onClick={() => toggleSort('start_year')}
                  className="p-2.5 w-24 text-center cursor-pointer hover:bg-slate-200"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>생산년도</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('end_year')}
                  className="p-2.5 w-24 text-center cursor-pointer hover:bg-slate-200"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>종료년도</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-2.5 w-24 text-center bg-blue-50/50">보존기간</th>
                <th
                  onClick={() => toggleSort('expiry_year')}
                  className="p-2.5 w-24 text-center cursor-pointer hover:bg-slate-200"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>만료연도</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('title')}
                  className="p-2.5 min-w-[280px] cursor-pointer hover:bg-slate-200"
                >
                  <div className="flex items-center gap-1">
                    <span>기록물철제목</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('box_no')}
                  className="p-2.5 w-32 text-center cursor-pointer hover:bg-slate-200"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>상자번호</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-2.5 w-20 text-center">서가번호</th>
                <th className="p-2.5 w-20 text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredAndSortedRecords.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400 text-sm">
                    {searchTerm || filterType !== 'all' || filterBox !== 'all' || filterYear !== 'all'
                      ? '검색 및 필터 조건과 일치하는 기록물이 없습니다.'
                      : `보존기간이 [${currentPeriod}]인 기록물이 아직 없습니다. [입력] 화면에서 등록하거나 다른 화면에서 보존기간을 변경하세요.`}
                  </td>
                </tr>
              ) : (
                filteredAndSortedRecords.map((record, idx) => {
                  const isSelected = selectedIds.has(record.record_id);

                  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  // 전체 수정 모드일 때: 행 전체 인라인 입력창 렌더링
                  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  if (isFullEditMode) {
                    const rowData = editMap[record.record_id] || record;
                    const calculatedExpiry = calculateExpiryYear(
                      rowData.end_year,
                      rowData.retention_period
                    );

                    return (
                      <tr
                        key={record.record_id}
                        className="bg-amber-50/40 divide-x divide-slate-200 hover:bg-amber-50/70 transition-colors"
                      >
                        {/* Checkbox (수정 모드에서는 비활성화) */}
                        <td className="p-2 text-center">
                          <input type="checkbox" disabled checked={false} />
                        </td>

                        {/* Sequence */}
                        <td className="p-2 text-center text-slate-500 font-mono">{idx + 1}</td>

                        {/* Record No / ID */}
                        <td className="p-2 text-center font-mono font-bold text-slate-800 text-xs">
                          <div className="text-blue-900">{rowData.record_no || record.record_no || record.record_id}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{record.record_id}</div>
                        </td>

                        {/* Record Type Select */}
                        <td className="p-1 text-center">
                          <select
                            value={rowData.record_type}
                            onChange={(e) =>
                              handleFieldChange(record.record_id, 'record_type', e.target.value as RecordType)
                            }
                            className="w-full border border-slate-300 rounded text-xs px-1 py-1 bg-white font-medium focus:outline-blue-600"
                          >
                            <option value="일반">일반</option>
                            <option value="시청각">시청각</option>
                          </select>
                        </td>

                        {/* Start Year */}
                        <td className="p-1 text-center">
                          <input
                            type="number"
                            value={rowData.start_year || ''}
                            onChange={(e) =>
                              handleFieldChange(record.record_id, 'start_year', e.target.value)
                            }
                            className="w-full border border-slate-300 rounded text-center text-xs py-1 font-semibold focus:outline-blue-600 bg-white"
                          />
                        </td>

                        {/* End Year */}
                        <td className="p-1 text-center">
                          <input
                            type="number"
                            value={rowData.end_year || ''}
                            onChange={(e) =>
                              handleFieldChange(record.record_id, 'end_year', e.target.value)
                            }
                            className="w-full border border-blue-400 rounded text-center text-xs py-1 font-bold text-blue-900 focus:outline-blue-600 bg-white"
                            title="종료년도 변경 시 만료연도가 자동 갱신됩니다"
                          />
                        </td>

                        {/* Retention Period (요구사항 5: 변경 시 저장 후 해당 탭으로 자동 이동) */}
                        <td className="p-1 text-center bg-blue-50/50">
                          <select
                            value={rowData.retention_period}
                            onChange={(e) =>
                              handleFieldChange(
                                record.record_id,
                                'retention_period',
                                e.target.value as RetentionPeriod
                              )
                            }
                            className="w-full border border-blue-500 rounded text-xs font-bold px-1 py-1 text-blue-900 bg-white focus:outline-blue-600"
                            title="보존기간 변경 시 [수정완료] 저장 후 해당 보존기간 탭으로 자동 이동합니다"
                          >
                            {RETENTION_PERIODS.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Expiry Year (자동 계산 표시 - 요구사항 6) */}
                        <td className="p-2 text-center font-bold text-slate-700">
                          {calculatedExpiry === '-' ? '-' : `${calculatedExpiry}년`}
                        </td>

                        {/* Title Input */}
                        <td className="p-1">
                          <input
                            type="text"
                            value={rowData.title}
                            onChange={(e) =>
                              handleFieldChange(record.record_id, 'title', e.target.value)
                            }
                            className="w-full border border-blue-400 rounded px-2 py-1 font-semibold text-slate-900 bg-white focus:outline-blue-600"
                            placeholder="기록물철제목 입력"
                          />
                          <div className="mt-1 flex items-center gap-1">
                            <span className="text-[10px] text-slate-500 shrink-0">생산부서:</span>
                            <input
                              type="text"
                              value={rowData.production_school || ''}
                              onChange={(e) =>
                                handleFieldChange(record.record_id, 'production_school', e.target.value)
                              }
                              placeholder="기본 처리과"
                              className="w-full text-[11px] border border-slate-300 rounded px-1.5 py-0.5 bg-white focus:outline-blue-600"
                            />
                          </div>
                        </td>

                        {/* Box No Input (datalist 연동 - 요구사항 7) */}
                        <td className="p-1 text-center">
                          <input
                            type="text"
                            value={rowData.box_no}
                            list={`box-list-${record.record_id}`}
                            onChange={(e) =>
                              handleFieldChange(record.record_id, 'box_no', e.target.value)
                            }
                            className="w-full border border-slate-300 rounded text-center text-xs py-1 font-mono font-bold text-blue-900 bg-white focus:outline-blue-600"
                            placeholder="예: 5년-2026-1"
                            title="기존 상자번호를 선택하거나 새 상자번호를 입력할 수 있습니다"
                          />
                          <datalist id={`box-list-${record.record_id}`}>
                            {getExistingBoxNumbers(rowData.retention_period, rowData.end_year, records).map((b) => (
                              <option key={b} value={b} />
                            ))}
                          </datalist>
                        </td>

                        {/* Shelf No Input */}
                        <td className="p-1 text-center">
                          <input
                            type="text"
                            value={rowData.shelf_no}
                            onChange={(e) =>
                              handleFieldChange(record.record_id, 'shelf_no', e.target.value)
                            }
                            className="w-full border border-slate-300 rounded text-center text-xs py-1 font-mono bg-white focus:outline-blue-600"
                            placeholder="A-01"
                          />
                        </td>

                        {/* Management status indicator in full edit mode */}
                        <td className="p-2 text-center text-[11px] font-bold text-amber-700 bg-amber-50">
                          수정중
                        </td>
                      </tr>
                    );
                  }

                  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  // 일반 조회 모드 (Read Mode) - 요구사항 2: 개별 [수정] 버튼 제거
                  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  const expiryYear = calculateExpiryYear(record.end_year, record.retention_period);

                  return (
                    <tr
                      key={record.record_id}
                      className={`divide-x divide-slate-200 hover:bg-blue-50/30 transition-colors ${
                        isSelected ? 'bg-blue-50/60' : idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(record.record_id)}
                          className="rounded border-slate-400 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* Sequence */}
                      <td className="p-2 text-center text-slate-500 font-mono">{idx + 1}</td>

                      {/* Record ID / Record No */}
                      <td className="p-2 text-center font-mono font-bold text-slate-800 text-xs">
                        <div className="text-blue-900">{record.record_no || record.record_id}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{record.record_id}</div>
                      </td>

                      {/* Type */}
                      <td className="p-2 text-center">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            record.record_type === '시청각'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {record.record_type}
                        </span>
                      </td>

                      {/* Start Year */}
                      <td className="p-2 text-center font-medium text-slate-800">
                        {record.start_year}년
                      </td>

                      {/* End Year */}
                      <td className="p-2 text-center font-medium text-slate-800">
                        {record.end_year}년
                      </td>

                      {/* Retention Period */}
                      <td className="p-2 text-center font-bold text-blue-900 bg-blue-50/30">
                        {record.retention_period}
                      </td>

                      {/* Expiry Year */}
                      <td className="p-2 text-center font-bold text-slate-700">
                        {expiryYear === '-' ? '-' : `${expiryYear}년`}
                      </td>

                      {/* Title */}
                      <td className="p-2">
                        <span className="font-semibold text-slate-900 leading-snug">
                          {record.title}
                        </span>
                        {record.production_school &&
                          record.production_school.trim() !== '' &&
                          (!meta?.department || record.production_school.trim() !== meta.department.trim()) && (
                            <div className="mt-0.5">
                              <span className="inline-block text-[10px] text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 font-medium">
                                생산: {record.production_school}
                              </span>
                            </div>
                          )}
                      </td>

                      {/* Box No */}
                      <td className="p-2 text-center font-mono font-bold text-blue-900">
                        {record.box_no || <span className="text-slate-400 font-normal">-</span>}
                      </td>

                      {/* Shelf No */}
                      <td className="p-2 text-center font-mono text-slate-700">
                        {record.shelf_no || '-'}
                      </td>

                      {/* Management column: 개별 삭제, 폐기 및 이관 버튼 제공 */}
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleTransferSingle(record)}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer transition-colors"
                            title="기록관 이관 처리 (이관목록에 보존)"
                          >
                            <SendHorizontal className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDisposeSingle(record)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                            title="기록물 폐기 처리 (폐기목록에 보존)"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSingle(record)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer transition-colors"
                            title="기록물 영구 삭제 (시스템에서 완전 제거)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Bottom Info */}
        <div className="p-3 bg-slate-50 border-t border-slate-300 flex items-center justify-between text-xs text-slate-500">
          <div>
            표시 항목: <strong className="text-slate-800">{filteredAndSortedRecords.length}</strong>건 / 전체 활성 {currentPeriod} 기록물: <strong className="text-slate-800">{periodRecords.length}</strong>건
          </div>
          <div className="text-[11px] text-slate-400">
            * 상단 [수정] 버튼을 클릭하면 전체 기록물을 한 번에 자유롭게 수정한 후 일괄 저장할 수 있습니다.
          </div>
        </div>
      </div>

      {/* Bulk Edit Modal (선택한 여러 건에 대한 상자/서가/보존기간 일괄 지정 팝업) */}
      {bulkChangeOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b pb-2 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              선택한 {selectedIds.size}건 일괄 변경
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  보존기간 일괄 변경 (선택)
                </label>
                <select
                  value={bulkTargetPeriod}
                  onChange={(e) => setBulkTargetPeriod(e.target.value as RetentionPeriod)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold bg-white"
                >
                  {RETENTION_PERIODS.map((p) => (
                    <option key={p} value={p}>
                      {p} {p === currentPeriod ? '(현재 보존기간 유지)' : `(선택 시 [${p}] 화면으로 이동)`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  상자번호 일괄 지정 (비워둘 시 기존값 유지)
                </label>
                <input
                  type="text"
                  placeholder="예: 5년-2026-1"
                  value={bulkTargetBox}
                  onChange={(e) => setBulkTargetBox(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  서가번호 일괄 지정 (비워둘 시 기존값 유지)
                </label>
                <input
                  type="text"
                  placeholder="예: B-02"
                  value={bulkTargetShelf}
                  onChange={(e) => setBulkTargetShelf(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setBulkChangeOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded hover:bg-slate-50 cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleApplyBulkChange}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 rounded hover:bg-blue-700 cursor-pointer"
              >
                변경사항 일괄 적용
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 인앱 확인 모달 (브라우저 confirm 차단 문제 해결 및 확정일자 입력) */}
      <ConfirmModal
        isOpen={confirmModalState.isOpen}
        title={confirmModalState.title}
        message={confirmModalState.message}
        detail={confirmModalState.detail}
        confirmText={confirmModalState.confirmText}
        confirmVariant={confirmModalState.confirmVariant}
        onConfirm={confirmModalState.onConfirm}
        onCancel={() => {
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
          setActionType(null);
        }}
      >
        {actionType === 'dispose' && (
          <div className="mt-3.5 p-3.5 bg-rose-50/70 border border-rose-200 rounded-lg text-xs space-y-2">
            <label className="block text-xs font-bold text-rose-950 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-rose-600" />
              폐기 확정일자 지정 (기본값: 오늘)
            </label>
            <input
              type="date"
              value={actionConfirmDate}
              onChange={(e) => handleActionDateChange(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-rose-300 rounded text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-2xs"
            />
            <p className="text-[11px] text-rose-700 leading-relaxed">
              💡 기본값은 시스템 오늘 날짜({new Date().toISOString().split('T')[0]})이며, 기록물 심의회 폐기 의결일자 또는 내부결재 일자에 맞춰 수정 가능합니다.
            </p>
          </div>
        )}

        {actionType === 'transfer' && (
          <div className="mt-3.5 p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs space-y-3">
            <div>
              <label className="block text-xs font-bold text-blue-950 mb-1 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600" />
                이관 확정일자 지정 (기본값: 오늘)
              </label>
              <input
                type="date"
                value={actionConfirmDate}
                onChange={(e) => handleActionDateChange(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-blue-300 rounded text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              />
              <p className="mt-1 text-[11px] text-blue-700 leading-relaxed">
                💡 기본값은 오늘 날짜이며, 실제 기록관 인계·인수 공문 시행일자에 맞춰 수정할 수 있습니다.
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-blue-950 mb-1 flex items-center gap-1.5">
                <SendHorizontal className="w-4 h-4 text-blue-600" />
                이관처 (인수기관)
              </label>
              <input
                type="text"
                value={actionDestination}
                onChange={(e) => handleActionDestinationChange(e.target.value)}
                placeholder="예: 전북특별자치도교육청 기록관"
                className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              />
            </div>
          </div>
        )}
      </ConfirmModal>

      {/* 액션 결과 토스트 알림 */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-xl text-xs font-semibold animate-in slide-in-from-bottom-3 duration-200 ${
            toastMessage.type === 'error'
              ? 'bg-red-600 text-white shadow-red-500/20'
              : toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-500/20'
              : 'bg-slate-800 text-white shadow-slate-900/20'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          ) : toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <FileEdit className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 p-0.5 hover:bg-white/20 rounded cursor-pointer transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
