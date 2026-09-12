/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  RecordItem,
  DepartmentMeta,
  TaskCard,
  MenuKey,
  RetentionPeriod,
  FullExcelImportResult,
} from './types';
import {
  INITIAL_RECORDS,
  SAMPLE_TEST_RECORDS,
  INITIAL_TASK_CARDS,
  INITIAL_DEPARTMENT_META,
} from './data/initialData';
import { generateRecordNo } from './utils/recordUtils';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { CoverSummaryView } from './components/CoverSummaryView';
import { InputView } from './components/InputView';
import { RetentionListView } from './components/RetentionListView';
import { TaskCardsView } from './components/TaskCardsView';
import { LabelsView } from './components/LabelsView';
import { DisposalTargetView } from './components/DisposalTargetView';
import { DisposalListView } from './components/DisposalListView';
import { TransferListView } from './components/TransferListView';
import { WorkFormsView } from './components/WorkFormsView';
import { ExcelExportView } from './components/ExcelExportView';
import { ConfirmModal } from './components/ConfirmModal';

const STORAGE_KEY_RECORDS = 'school_archives_records_v2';
const STORAGE_KEY_CARDS = 'school_archives_cards_v2';
const STORAGE_KEY_META = 'school_archives_meta_v2';

export default function App() {
  // 1. 단일 원본 데이터 (Single Source of Truth) 관리: 초기 상태는 빈 배열 (요구사항 3)
  const [records, setRecords] = useState<RecordItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_RECORDS);
    if (saved) {
      try {
        const parsed: RecordItem[] = JSON.parse(saved);
        // 기존 레코드 중 record_no가 누락된 경우 자동 마이그레이션 보완
        let needsMigration = false;
        const updated = parsed.map((r, idx) => {
          if (!r.record_no && r.retention_period) {
            needsMigration = true;
            return {
              ...r,
              record_no: generateRecordNo(r.retention_period, parsed.slice(0, idx)),
            };
          }
          return r;
        });
        if (needsMigration) {
          localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(updated));
        }
        return updated;
      } catch (e) {
        console.error('Failed to parse saved records', e);
      }
    }
    return INITIAL_RECORDS;
  });

  const [taskCards, setTaskCards] = useState<TaskCard[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CARDS);
    if (saved) {
      try {
        const parsed: TaskCard[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // '교육공무직원및계약제교원채용서류' 삭제 반영 및 기본 과제카드 수정일을 2026-09-10으로 마이그레이션
          const filtered = parsed.filter(
            (c) => c.name !== '교육공무직원및계약제교원채용서류' && c.name?.trim() !== '교육공무직원및계약제교원채용서류'
          );
          if (filtered.length > 0) {
            return filtered.map((c) => {
              if (c.updated_at === '2024-01-01' || !c.updated_at) {
                return { ...c, updated_at: '2026-09-10' };
              }
              return c;
            });
          }
        }
      } catch (e) {
        console.error('Failed to parse saved cards', e);
      }
    }
    return INITIAL_TASK_CARDS;
  });

  const [meta, setMeta] = useState<DepartmentMeta>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_META);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved meta', e);
      }
    }
    return INITIAL_DEPARTMENT_META;
  });

  // 기본 화면을 「입력」 탭으로 설정 (사용자의 요청 시 즉시 입력 화면 표시)
  const [currentMenu, setCurrentMenu] = useState<MenuKey>('input');

  // 전역 확인 모달 상태
  const [appConfirmModal, setAppConfirmModal] = useState<{
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

  // 데이터 로컬 스토리지 자동 저장
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CARDS, JSON.stringify(taskCards));
  }, [taskCards]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_META, JSON.stringify(meta));
  }, [meta]);

  // 기록물 추가 (단건 또는 일괄)
  const handleAddRecords = (newRecords: RecordItem[]) => {
    setRecords((prev) => [...prev, ...newRecords]);
  };

  // 기록물 수정 (단건)
  const handleUpdateRecord = (updatedRecord: RecordItem) => {
    setRecords((prev) =>
      prev.map((r) => (r.record_id === updatedRecord.record_id ? updatedRecord : r))
    );
  };

  // 기록물 수정 (복수/일괄: 전체 자료 수정 모드에서 한꺼번에 반영)
  const handleUpdateRecords = (updatedList: RecordItem[]) => {
    const updateMap = new Map(updatedList.map((r) => [r.record_id, r]));
    setRecords((prev) =>
      prev.map((r) => (updateMap.has(r.record_id) ? updateMap.get(r.record_id)! : r))
    );
  };

  // 일반 삭제 (불필요한 자료 및 오입력 자료 완전 삭제 - 폐기목록에 남기지 않음)
  const handleDeleteRecords = (recordIds: string[]) => {
    const idSet = new Set(recordIds);
    setRecords((prev) => prev.filter((r) => !idSet.has(r.record_id)));
  };

  // 정식 입력완료 처리
  const handleCompleteRecords = (recordIds: string[]) => {
    const idSet = new Set(recordIds);
    setRecords((prev) =>
      prev.map((r) =>
        idSet.has(r.record_id)
          ? { ...r, is_completed: true, updated_at: new Date().toISOString().split('T')[0] }
          : r
      )
    );
  };

  // 14. 폐기 처리: 정식 관리 중인 기록물을 폐기 (폐기확정목록에 스냅샷 보존, 원본 탭 및 총괄 집계에서 제외)
  const handleDisposeRecords = (recordIds: string[], _reason?: string, customDate?: string) => {
    const idSet = new Set(recordIds);
    const today = new Date().toISOString().split('T')[0];
    const disposalDate = customDate && customDate.trim() ? customDate.trim() : today;
    setRecords((prev) =>
      prev.map((r) =>
        idSet.has(r.record_id)
          ? {
              ...r,
              is_disposed: true,
              disposal_date: disposalDate,
              is_disposal_deferred: false,
              updated_at: today,
            }
          : r
      )
    );
  };

  // 폐기대상에서 보류 처리: 폐기대상 목록에서만 제외되고 원본 보존기간 대장(10년, 5년, 3년, 1년)에는 그대로 안전하게 유지
  const handleDeferRecords = (recordIds: string[]) => {
    const idSet = new Set(recordIds);
    const today = new Date().toISOString().split('T')[0];
    setRecords((prev) =>
      prev.map((r) =>
        idSet.has(r.record_id)
          ? {
              ...r,
              is_disposal_deferred: true,
              updated_at: today,
            }
          : r
      )
    );
  };

  // 폐기 보류 해제: 다시 폐기대상 목록으로 복귀
  const handleUndeferRecords = (recordIds: string[]) => {
    const idSet = new Set(recordIds);
    const today = new Date().toISOString().split('T')[0];
    setRecords((prev) =>
      prev.map((r) =>
        idSet.has(r.record_id)
          ? {
              ...r,
              is_disposal_deferred: false,
              updated_at: today,
            }
          : r
      )
    );
  };

  // 폐기목록에서 원상 복원
  const handleRestoreRecords = (recordIds: string[]) => {
    const idSet = new Set(recordIds);
    const today = new Date().toISOString().split('T')[0];
    setRecords((prev) =>
      prev.map((r) =>
        idSet.has(r.record_id)
          ? {
              ...r,
              is_disposed: false,
              disposal_date: null,
              is_disposal_deferred: false,
              updated_at: today,
            }
          : r
      )
    );
  };

  // 기록관 이관 처리 (기록물 목록 -> 이관목록)
  const handleTransferRecords = (
    recordIds: string[],
    destination = '전북특별자치도교육청 기록관',
    customDate?: string
  ) => {
    const idSet = new Set(recordIds);
    const today = new Date().toISOString().split('T')[0];
    const transferDate = customDate && customDate.trim() ? customDate.trim() : today;
    const dest = destination && destination.trim() ? destination.trim() : '전북특별자치도교육청 기록관';
    setRecords((prev) =>
      prev.map((r) =>
        idSet.has(r.record_id)
          ? {
              ...r,
              is_transferred: true,
              transfer_date: transferDate,
              transfer_destination: dest,
              updated_at: today,
            }
          : r
      )
    );
  };

  // 이관목록에서 이관 취소 (원래 보존대장으로 복원)
  const handleCancelTransferRecords = (recordIds: string[]) => {
    const idSet = new Set(recordIds);
    const today = new Date().toISOString().split('T')[0];
    setRecords((prev) =>
      prev.map((r) =>
        idSet.has(r.record_id)
          ? {
              ...r,
              is_transferred: false,
              transfer_date: null,
              transfer_destination: null,
              updated_at: today,
            }
          : r
      )
    );
  };

  // 폐기목록에서 영구 삭제
  const handlePermanentDeleteRecords = (recordIds: string[]) => {
    const idSet = new Set(recordIds);
    setRecords((prev) => prev.filter((r) => !idSet.has(r.record_id)));
  };

  // 과제카드 CRUD
  const handleAddTaskCard = (card: TaskCard) => {
    setTaskCards((prev) => [card, ...prev]);
  };

  const handleUpdateTaskCard = (updatedCard: TaskCard) => {
    setTaskCards((prev) =>
      prev.map((c) => (c.id === updatedCard.id ? updatedCard : c))
    );
  };

  const handleDeleteTaskCard = (id: string) => {
    setTaskCards((prev) => prev.filter((c) => c.id !== id));
  };

  // 샘플 데이터 복원 (테스트용)
  const handleResetToSampleData = () => {
    setAppConfirmModal({
      isOpen: true,
      title: '테스트용 샘플 기록물 불러오기',
      message: '테스트용 샘플 기록물(25건)을 불러오시겠습니까?',
      detail: '현재 작업 중인 내용은 샘플 데이터로 대체됩니다.',
      confirmText: '불러오기',
      confirmVariant: 'primary',
      onConfirm: () => {
        setRecords(SAMPLE_TEST_RECORDS);
        setTaskCards(INITIAL_TASK_CARDS);
        setMeta({
          department: '전북초등학교',
          base_date: new Date().toISOString().split('T')[0],
          school_name: '전북특별자치도교육청',
          institution: '전북특별자치도교육청',
          manager_name: '행정실장',
        });
        setAppConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // 기록물 전체 비우기 (초기 빈 상태로 복귀)
  const handleClearAllRecords = () => {
    setAppConfirmModal({
      isOpen: true,
      title: '기록물 전체 비우기',
      message: '현재 등록된 모든 기록물을 비우고 초기 빈 상태(0건)로 초기화하시겠습니까?',
      detail: '⚠️ 초기화 시 등록된 기록물이 모두 삭제됩니다.',
      confirmText: '전체 비우기',
      confirmVariant: 'danger',
      onConfirm: () => {
        setRecords([]);
        setAppConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // 요구사항: 다른 컴퓨터 등에서 [Excel 내보내기]한 통합 백업 파일을 불러와 전체 대장 데이터 덮어씌우기
  const handleImportOverwrite = (result: FullExcelImportResult) => {
    // 1. records 상태 덮어씌우기
    setRecords(result.records);

    // 2. taskCards가 파싱되었으면 덮어씌우기
    if (result.taskCards && result.taskCards.length > 0) {
      setTaskCards(result.taskCards);
    }

    // 3. meta 정보가 파싱되었으면 덮어씌우기
    if (result.meta) {
      setMeta((prev) => {
        const schoolName = result.meta?.school_name || result.meta?.institution || prev.school_name;
        const institutionName = result.meta?.institution || result.meta?.school_name || prev.institution || schoolName;
        return {
          ...prev,
          ...result.meta,
          department: result.meta?.department || prev.department,
          base_date: result.meta?.base_date || prev.base_date,
          school_name: schoolName,
          institution: institutionName,
          manager_name: result.meta?.manager_name || prev.manager_name,
        };
      });
    }

    // 복원 완료 확인 모달 팝업
    setAppConfirmModal({
      isOpen: true,
      title: 'Excel 대장 데이터 불러오기 완료',
      message: `선택하신 엑셀 백업 파일에서 총 ${result.stats.totalRecords}건의 기록물을 성공적으로 불러와 덮어씌웠습니다.`,
      detail: `• 정상 보존대장: ${result.stats.activeRecords}건\n• 신규/미완료 대기: ${result.stats.pendingRecords}건\n• 폐기 처리건: ${result.stats.disposedRecords}건\n• 기록관 이관건: ${result.stats.transferredRecords}건\n• 과제카드 기준: ${result.stats.taskCardsCount}건\n• 불러온 파일명: ${result.sourceFileName}`,
      confirmText: '확인',
      confirmVariant: 'primary',
      onConfirm: () => {
        setAppConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleJumpToPeriodMenu = (period: RetentionPeriod) => {
    switch (period) {
      case '영구':
        setCurrentMenu('retention_permanent');
        break;
      case '준영구':
        setCurrentMenu('retention_semi_permanent');
        break;
      case '30년':
        setCurrentMenu('retention_30');
        break;
      case '10년':
        setCurrentMenu('retention_10');
        break;
      case '5년':
        setCurrentMenu('retention_5');
        break;
      case '3년':
        setCurrentMenu('retention_3');
        break;
      case '1년':
        setCurrentMenu('retention_1');
        break;
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 antialiased overflow-hidden">
      {/* 13개 고정 메뉴 좌측 사이드바 */}
      <Sidebar
        currentMenu={currentMenu}
        onSelectMenu={(menu) => setCurrentMenu(menu)}
        records={records}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          meta={meta}
          onUpdateMeta={setMeta}
          records={records}
          taskCards={taskCards}
          onOpenLabelModal={() => setCurrentMenu('labels')}
          onResetToSampleData={handleResetToSampleData}
          onClearAllRecords={handleClearAllRecords}
          onImportOverwrite={handleImportOverwrite}
        />

        {/* Dynamic Screen View */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {currentMenu === 'cover' && (
            <CoverSummaryView
              records={records}
              meta={meta}
              onUpdateMeta={setMeta}
              onSelectMenu={(menu) => setCurrentMenu(menu)}
              onOpenLabelModal={() => setCurrentMenu('labels')}
            />
          )}

          {currentMenu === 'input' && (
            <InputView
              records={records}
              taskCards={taskCards}
              meta={meta}
              onAddRecords={handleAddRecords}
              onUpdateRecord={handleUpdateRecord}
              onDeleteRecords={handleDeleteRecords}
              onCompleteRecords={handleCompleteRecords}
              onSelectPeriodMenu={handleJumpToPeriodMenu}
            />
          )}

          {currentMenu === 'retention_permanent' && (
            <RetentionListView
              currentPeriod="영구"
              records={records}
              onUpdateRecord={handleUpdateRecord}
              onUpdateRecords={handleUpdateRecords}
              onDeleteRecords={handleDeleteRecords}
              onDisposeRecords={handleDisposeRecords}
              onTransferRecords={handleTransferRecords}
              onOpenLabelModal={() => setCurrentMenu('labels')}
            />
          )}

          {currentMenu === 'retention_semi_permanent' && (
            <RetentionListView
              currentPeriod="준영구"
              records={records}
              onUpdateRecord={handleUpdateRecord}
              onUpdateRecords={handleUpdateRecords}
              onDeleteRecords={handleDeleteRecords}
              onDisposeRecords={handleDisposeRecords}
              onTransferRecords={handleTransferRecords}
              onOpenLabelModal={() => setCurrentMenu('labels')}
            />
          )}

          {currentMenu === 'retention_30' && (
            <RetentionListView
              currentPeriod="30년"
              records={records}
              onUpdateRecord={handleUpdateRecord}
              onUpdateRecords={handleUpdateRecords}
              onDeleteRecords={handleDeleteRecords}
              onDisposeRecords={handleDisposeRecords}
              onTransferRecords={handleTransferRecords}
              onOpenLabelModal={() => setCurrentMenu('labels')}
            />
          )}

          {currentMenu === 'retention_10' && (
            <RetentionListView
              currentPeriod="10년"
              records={records}
              onUpdateRecord={handleUpdateRecord}
              onUpdateRecords={handleUpdateRecords}
              onDeleteRecords={handleDeleteRecords}
              onDisposeRecords={handleDisposeRecords}
              onTransferRecords={handleTransferRecords}
              onOpenLabelModal={() => setCurrentMenu('labels')}
            />
          )}

          {currentMenu === 'retention_5' && (
            <RetentionListView
              currentPeriod="5년"
              records={records}
              onUpdateRecord={handleUpdateRecord}
              onUpdateRecords={handleUpdateRecords}
              onDeleteRecords={handleDeleteRecords}
              onDisposeRecords={handleDisposeRecords}
              onTransferRecords={handleTransferRecords}
              onOpenLabelModal={() => setCurrentMenu('labels')}
            />
          )}

          {currentMenu === 'retention_3' && (
            <RetentionListView
              currentPeriod="3년"
              records={records}
              onUpdateRecord={handleUpdateRecord}
              onUpdateRecords={handleUpdateRecords}
              onDeleteRecords={handleDeleteRecords}
              onDisposeRecords={handleDisposeRecords}
              onTransferRecords={handleTransferRecords}
              onOpenLabelModal={() => setCurrentMenu('labels')}
            />
          )}

          {currentMenu === 'retention_1' && (
            <RetentionListView
              currentPeriod="1년"
              records={records}
              onUpdateRecord={handleUpdateRecord}
              onUpdateRecords={handleUpdateRecords}
              onDeleteRecords={handleDeleteRecords}
              onDisposeRecords={handleDisposeRecords}
              onTransferRecords={handleTransferRecords}
              onOpenLabelModal={() => setCurrentMenu('labels')}
            />
          )}

          {currentMenu === 'task_cards' && (
            <TaskCardsView
              taskCards={taskCards}
              onAddTaskCard={handleAddTaskCard}
              onUpdateTaskCard={handleUpdateTaskCard}
              onDeleteTaskCard={handleDeleteTaskCard}
            />
          )}

          {currentMenu === 'labels' && (
            <LabelsView records={records} meta={meta} />
          )}

          {currentMenu === 'disposal_target' && (
            <DisposalTargetView
              records={records}
              meta={meta}
              onDisposeRecords={handleDisposeRecords}
              onDeferRecords={handleDeferRecords}
              onUndeferRecords={handleUndeferRecords}
            />
          )}

          {currentMenu === 'disposal' && (
            <DisposalListView
              records={records}
              onRestoreRecords={handleRestoreRecords}
              onPermanentDeleteRecords={handlePermanentDeleteRecords}
            />
          )}

          {currentMenu === 'transfer' && (
            <TransferListView
              records={records}
              meta={meta}
              onCancelTransferRecords={handleCancelTransferRecords}
              onPermanentDeleteRecords={handlePermanentDeleteRecords}
            />
          )}

          {currentMenu === 'forms' && (
            <WorkFormsView meta={meta} />
          )}

          {currentMenu === 'excel_export' && (
            <ExcelExportView
              records={records}
              meta={meta}
              taskCards={taskCards}
              onImportOverwrite={handleImportOverwrite}
              onImportRecords={handleAddRecords}
            />
          )}
        </main>
      </div>

      <ConfirmModal
        isOpen={appConfirmModal.isOpen}
        title={appConfirmModal.title}
        message={appConfirmModal.message}
        detail={appConfirmModal.detail}
        confirmText={appConfirmModal.confirmText}
        confirmVariant={appConfirmModal.confirmVariant}
        onConfirm={appConfirmModal.onConfirm}
        onCancel={() => setAppConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

